// backend/controllers/bottleneckCommandController.js
// Command Mode — Authority + Incident GPS → 3 Dynamic Routes with REALISTIC congestion model
// Key insight: shortest/dangerous route gets highest congestion (damaged + panic traffic)
//              long safe detour is recommended BUT still moderately congested (everyone uses it)

const axios = require('axios');

// ══════════════════════════════════════════════════════════
// GEO MATH
// ══════════════════════════════════════════════════════════

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const la1 = lat1 * Math.PI / 180, la2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function destPoint(lat, lng, distKm, bearingDeg) {
  const R = 6371, d = distKm / R, b = bearingDeg * Math.PI / 180;
  const la1 = lat * Math.PI / 180, lo1 = lng * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: parseFloat((la2 * 180 / Math.PI).toFixed(6)), lng: parseFloat((lo2 * 180 / Math.PI).toFixed(6)) };
}

// ══════════════════════════════════════════════════════════
// ROUTE NAME GENERATOR
// ══════════════════════════════════════════════════════════

function routeName(type, dir, disasterType) {
  const D = { N:'Northern',S:'Southern',E:'Eastern',W:'Western',NE:'Northeast',NW:'Northwest',SE:'Southeast',SW:'Southwest' }[dir] || dir;
  const names = {
    flood:      { safe:`${D} Elevated Bypass Highway`,     moderate:`${D} Flood-Perimeter Road`,           dangerous:`${D} Submerged Zone Route`        },
    fire:       { safe:`${D} Firebreak Expressway`,        moderate:`${D} Smoke-Zone Perimeter Road`,      dangerous:`${D} Active Fire-Front Path`       },
    earthquake: { safe:`${D} Open-Ground Expressway`,      moderate:`${D} Surface Road Corridor`,          dangerous:`${D} Structural-Risk Route`        },
    hurricane:  { safe:`${D} Inland Shelter Highway`,      moderate:`${D} Storm-Perimeter Bypass`,         dangerous:`${D} Coastal Surge Zone Road`      },
    chemical:   { safe:`${D} Upwind Safe Expressway`,      moderate:`${D} Buffer-Zone Corridor`,           dangerous:`${D} Contamination Zone Route`     },
    unknown:    { safe:`${D} Primary Evacuation Highway`,  moderate:`${D} Secondary Bypass Road`,          dangerous:`${D} Emergency Access Path`        },
  };
  return (names[disasterType] || names.unknown)[type] || `${D} Route`;
}

function dangerReason(disasterType, intensity) {
  const severe = intensity >= 7;
  return ({
    flood:      severe ? 'Road submerged — vehicles at risk of being swept away by floodwater' : 'Partial flooding — road may become impassable as water rises',
    fire:       severe ? 'Route inside active fire perimeter — life-threatening smoke and flame exposure' : 'Adjacent to fire front — smoke, embers and heat hazard',
    earthquake: severe ? 'Infrastructure collapse risk — bridges and overpasses structurally compromised' : 'Road surface cracked and unstable — risk of further collapse',
    hurricane:  severe ? 'Storm surge and wind exceeds safe travel threshold — debris and flooding' : 'Coastal exposure — surge flooding and high-speed debris risk',
    chemical:   severe ? 'Inside contamination plume — immediate toxic exposure, lethal without PPE' : 'Downwind of spill — respiratory hazard without protective gear',
    unknown:    'Route passes through the active emergency zone — unknown hazards',
  })[disasterType] || 'Passes through active hazard zone';
}

// ══════════════════════════════════════════════════════════
// GENERATE 3 ROUTES (waypoints computed from real coordinates)
// ══════════════════════════════════════════════════════════

function generateRoutes(authLat, authLng, incLat, incLng, disasterType, intensity, timeOfDay, roadCondition) {
  const isNight = timeOfDay === 'night' || timeOfDay === '3AM';
  const isSevere = intensity >= 7;
  const D = haversine(authLat, authLng, incLat, incLng);      // direct distance km
  const B = bearing(authLat, authLng, incLat, incLng);        // bearing degrees
  const dir = ['N','NE','E','SE','S','SW','W','NW'][Math.round(B / 45) % 8];

  const condFactor = { normal: 1.0, damaged: 0.55, restricted: 0.32 }[roadCondition] ?? 1.0;
  const nightFactor = isNight ? 0.72 : 1.0;

  // ── BASE ROAD CAPACITIES (vehicles/min equivalent) ──────
  // These represent normal throughput of different road types
  // Safe detour = major highway = highest base capacity
  // Moderate = state highway = medium
  // Dangerous = local/disaster-zone road = lowest + heavily penalised
  const BASE_SAFE     = 420;   // major highway / expressway
  const BASE_MODERATE = 280;   // state road / arterial
  const BASE_DANGEROUS = 160;  // local road through affected zone

  // Disaster damage reduces capacity of ALL routes (roads need repairs)
  // But dangerous route (in disaster zone) is hit MUCH harder
  const disasterRoadPenalty = {
    flood:      { safe: 0.80, moderate: 0.65, dangerous: 0.20 }, // flood destroys roads near zone
    fire:       { safe: 0.85, moderate: 0.70, dangerous: 0.25 },
    earthquake: { safe: 0.75, moderate: 0.60, dangerous: 0.18 },
    hurricane:  { safe: 0.82, moderate: 0.68, dangerous: 0.22 },
    chemical:   { safe: 0.88, moderate: 0.72, dangerous: 0.30 },
    unknown:    { safe: 0.90, moderate: 0.78, dangerous: 0.40 },
  }[disasterType] || { safe: 0.90, moderate: 0.78, dangerous: 0.40 };

  // Intensity further degrades
  const intensityPenalty = intensity >= 9 ? 0.55 : intensity >= 7 ? 0.72 : intensity >= 5 ? 0.85 : 0.95;

  const capSafe     = Math.max(30, Math.round(BASE_SAFE     * disasterRoadPenalty.safe     * intensityPenalty * nightFactor * condFactor));
  const capModerate = Math.max(20, Math.round(BASE_MODERATE * disasterRoadPenalty.moderate * intensityPenalty * nightFactor * condFactor));
  const capDangerous= Math.max(8,  Math.round(BASE_DANGEROUS* disasterRoadPenalty.dangerous* intensityPenalty * nightFactor * condFactor));

  // ── WAYPOINTS ────────────────────────────────────────────
  // Safe: detour 50° left, adds ~45-55% extra distance
  const safeOffset = isSevere ? 55 : 45;
  const sWP1 = destPoint(authLat, authLng, D * 0.5, (B - safeOffset + 360) % 360);
  const sWP2 = destPoint(sWP1.lat, sWP1.lng, D * 0.6, (B + 22 + 360) % 360);
  const safeDist = parseFloat((D * (isSevere ? 1.60 : 1.48)).toFixed(1));

  // Moderate: slight 12° offset, ~5% longer
  const mWP1 = destPoint(authLat, authLng, D * 0.38, (B + 12 + 360) % 360);
  const mWP2 = destPoint(mWP1.lat, mWP1.lng, D * 0.48, (B - 5 + 360) % 360);
  const modDist = parseFloat((D * 1.07).toFixed(1));

  // Dangerous: 20° right, 8% shorter (directly through zone)
  const dWP1 = destPoint(authLat, authLng, D * 0.32, (B + 20 + 360) % 360);
  const dWP2 = destPoint(dWP1.lat, dWP1.lng, D * 0.52, (B - 12 + 360) % 360);
  const danDist = parseFloat((D * 0.92).toFixed(1));

  return [
    {
      id: 'ROUTE_A', type: 'safe', label: 'SAFE', dir,
      name: routeName('safe', dir, disasterType),
      description: `Wide detour via ${dir} direction — avoids the ${disasterType} affected zone completely`,
      riskReason: null,
      distanceKm: safeDist,
      capacity: capSafe,
      waypoints: [{ lat: authLat, lng: authLng }, sWP1, sWP2, { lat: incLat, lng: incLng }],
    },
    {
      id: 'ROUTE_B', type: 'moderate', label: 'MODERATE', dir,
      name: routeName('moderate', dir, disasterType),
      description: `Near-direct path skirting the hazard perimeter — faster but exposed to risk`,
      riskReason: `Passes along edge of ${disasterType} affected zone — partial exposure`,
      distanceKm: modDist,
      capacity: capModerate,
      waypoints: [{ lat: authLat, lng: authLng }, mWP1, mWP2, { lat: incLat, lng: incLng }],
    },
    {
      id: 'ROUTE_C', type: 'dangerous', label: 'DANGEROUS', dir,
      name: routeName('dangerous', dir, disasterType),
      description: `Shortest path — goes directly through or adjacent to the active ${disasterType} zone`,
      riskReason: dangerReason(disasterType, intensity),
      distanceKm: danDist,
      capacity: capDangerous,
      waypoints: [{ lat: authLat, lng: authLng }, dWP1, dWP2, { lat: incLat, lng: incLng }],
    },
  ];
}

// ══════════════════════════════════════════════════════════
// REALISTIC CONGESTION MODEL
//
// Core insight: in an emergency, ALL routes get used — including dangerous ones.
// Safe route: MOST people use it (authority recommended it) → high actual congestion
//             BUT it has highest capacity → moderate-high congestion %
// Moderate:   Second-most traffic, medium capacity → high congestion %  
// Dangerous:  Still gets panic traffic + has badly damaged capacity → WORST congestion
//             People use it because it's shortest even knowing the risk
//
// Traffic split (realistic panic behavior):
//   Safe:      40–50% of evacuees use it (majority follow official guidance)
//   Moderate:  30–35% (people who don't want the long detour)
//   Dangerous: 15–25% (panic, ignorance, or proximity — NOT recommended but happens)
// ══════════════════════════════════════════════════════════

function analyzeRouteCongestion(routes, affectedPop, evacuationRatePerMin, timeOfDay, disasterIntensity) {
  const isNight = timeOfDay === 'night' || timeOfDay === '3AM';

  // Panic behavior: higher intensity + night → more people take dangerous shortcut
  // and more people rush all routes simultaneously
  const panicLevel = Math.min(2.0,
    1.0
    + (disasterIntensity - 5) * 0.08   // +0.08 per intensity point above 5
    + (isNight ? 0.25 : 0)             // night adds 25%
  );
  const panicMult = parseFloat(Math.max(1.0, panicLevel).toFixed(2));

  // Effective demand: people trying to evacuate (all at once in panic)
  const effectiveDemand = Math.round(affectedPop * panicMult);

  // Panic-adjusted traffic split
  // At higher panic (intensity ≥ 8), more people take dangerous shortcut recklessly
  const dangerShare  = Math.min(0.30, 0.15 + (disasterIntensity - 5) * 0.025 + (isNight ? 0.05 : 0));
  const safeShare    = Math.max(0.38, 0.50 - (disasterIntensity - 5) * 0.015);
  const modShare     = Math.max(0.25, 1.0 - safeShare - dangerShare);

  const shareMap = { ROUTE_A: safeShare, ROUTE_B: modShare, ROUTE_C: dangerShare };
  const totalShare = safeShare + modShare + dangerShare;

  // Flow rate per route in ppl/min (how fast people arrive at this route's entrance)
  const systemFlowRate = Math.min(effectiveDemand, evacuationRatePerMin * panicMult);

  const analyzed = routes.map(route => {
    const share       = (shareMap[route.id] || 0.25) / totalShare;  // normalised
    const routeLoad   = Math.round(effectiveDemand * share);         // people on this route
    const flowOnRoute = Math.round(systemFlowRate * share);          // ppl/min arriving

    // Congestion % = how full is the route?
    // capacity is in vehicles equivalent per minute
    // We compare arrival flow to route capacity
    const rawCongestion  = flowOnRoute / Math.max(1, route.capacity);
    const congestionPct  = Math.min(99, Math.round(rawCongestion * 100));

    // Overload: if rawCongestion > 1.0, route is overloaded
    const overloadRatio  = parseFloat(rawCongestion.toFixed(2));
    const severity       = overloadRatio >= 3.0 ? 'Critical'
                         : overloadRatio >= 2.0 ? 'High'
                         : overloadRatio >= 1.2 ? 'Moderate'
                         : overloadRatio >= 0.7 ? 'Moderate' : 'Low';

    // Time to congest (minutes) = how long until queue builds to standstill
    // When flow > capacity, congestion builds at rate (flow - capacity) ppl/min
    // Road "full" when accumulated overflow exceeds route holding buffer (capacity * 10 min buffer)
    let timeToCongest;
    if (overloadRatio <= 0.6) {
      timeToCongest = 999; // won't congest
    } else if (overloadRatio <= 1.0) {
      timeToCongest = Math.round(60 / (overloadRatio * 0.5)); // slow buildup
    } else {
      const overflow     = flowOnRoute - route.capacity;          // excess ppl/min beyond capacity
      const buffer       = route.capacity * 8;                    // road can absorb 8 min worth
      timeToCongest      = Math.max(2, Math.round(buffer / Math.max(1, overflow)));
    }

    // Safety score — holistic danger assessment
    // Factors: congestion, disaster zone proximity, time of day, overload
    let safety = 100;
    safety -= congestionPct * 0.6;                    // congestion reduces safety
    safety -= overloadRatio > 1 ? 20 : 0;            // overloaded = dangerous
    safety -= route.type === 'dangerous' ? 38 : 0;   // in disaster zone
    safety -= route.type === 'moderate'  ? 10 : 0;   // near zone perimeter
    safety += route.type === 'safe'      ? 8  : 0;   // bonus for avoiding zone
    safety -= isNight ? 8 : 0;                        // night reduces safety
    safety  = Math.max(5, Math.min(95, Math.round(safety)));

    // Travel time estimate
    // Speed degrades: safe route = 45 km/h (clear road), moderate = 35, dangerous = 25 (damaged road)
    const speedMap  = { safe: 45, moderate: 35, dangerous: 25 };
    const baseSpeed = speedMap[route.type] || 35;
    const baseMin   = Math.round((route.distanceKm / baseSpeed) * 60);
    // Congestion delay: proportional to overload
    const congDelay = Math.round(overloadRatio * baseMin * 0.55);
    const travelMin = baseMin + congDelay;

    // Why is this route classified this way? (for UI explanation)
    const rationale = route.type === 'safe'
      ? `Avoids disaster zone entirely. Higher capacity road (${route.capacity} units/min). Recommended despite longer distance.`
      : route.type === 'moderate'
      ? `Skirts the hazard perimeter. Medium capacity (${route.capacity} units/min). Balances speed and safety.`
      : `Passes through active disaster zone. Road severely damaged (${route.capacity} units/min capacity remaining). Shortest but most dangerous — high panic traffic on degraded infrastructure.`;

    return {
      ...route,
      routeLoad,
      flowOnRoute,
      routeCapacity: route.capacity,
      congestionRiskPercent: congestionPct,
      overloadRatio,
      severity,
      timeToCongest: timeToCongest === 999 ? null : timeToCongest,
      safetyScore: safety,
      estimatedTravelMinutes: travelMin,
      trafficShare: parseFloat((share * 100).toFixed(1)),
      rationale,
    };
  });

  // Network-level congestion = worst single route (not average — a jammed route affects all)
  const networkCongestion = Math.max(...analyzed.map(r => r.congestionRiskPercent));

  return {
    routes: analyzed,
    panicMultiplier: panicMult,
    effectiveDemand,
    networkCongestion,
    systemFlowRate: Math.round(systemFlowRate),
  };
}

// ══════════════════════════════════════════════════════════
// GROQ AI
// ══════════════════════════════════════════════════════════

async function generateCommandAI(data) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('⚠️ GROQ_API_KEY not found in process.env. Keys present:', Object.keys(process.env).filter(k => k.includes('GROQ') || k.includes('API')));
    return null;
  }
  console.log('🔑 Groq key found, length:', key.length);

  const routeLines = data.routes.map((r, i) =>
    `  Route ${i+1} [${r.label}] "${r.name}": ${r.distanceKm}km | safety=${r.safetyScore}/100 | congestion=${r.congestionRiskPercent}% (${r.severity}) | travel=${r.estimatedTravelMinutes}min | overload=${r.overloadRatio}x | ${r.trafficShare}% of evacuees use it${r.riskReason ? ' | RISK: ' + r.riskReason : ''}`
  ).join('\n');

  const t1 = Math.max(2, Math.round(data.evacuationMinutes / 4));
  const t2 = Math.max(5, Math.round(data.evacuationMinutes / 2));

  const prompt = `INCIDENT COMMAND BRIEF:
Authority position: ${data.authLat.toFixed(5)}, ${data.authLng.toFixed(5)} — ${data.authorityAddress || 'command post'}
Incident location: ${data.incLat.toFixed(5)}, ${data.incLng.toFixed(5)} — ${data.incidentAddress || 'reported site'}
Disaster: ${data.disasterType.toUpperCase()} | Intensity: ${data.intensity}/10 | Time: ${data.timeOfDay}
Affected population: ${data.population.toLocaleString()} | Panic multiplier: ${data.panicMult}x
Network congestion: ${data.networkCongestion}% | Evacuation time: ${data.evacuationMinutes} min

ROUTES COMPUTED:
${routeLines}

LOGIC: Safe route is longer but avoids disaster zone. Dangerous route is shortest but heavily damaged and congested. Decision must weigh travel time against life risk.

Respond with ONLY this raw JSON (no markdown, no backticks):
{
  "primaryCommand": "Take [exact route name]. [One sentence: why safer despite longer distance for ${data.disasterType}].",
  "avoidRoute": "Avoid [exact dangerous route name]. [Specific hazard: ${data.riskReason}].",
  "situationAssessment": "[Sentence about disaster severity at intensity ${data.intensity}/10]. [Sentence about current congestion and time pressure].",
  "resourceDeployment": ["Deploy [specific resource] at [location on safe route] to [purpose]", "Station [specific resource] at [choke point] to [purpose]"],
  "disasterWarning": "Ground responders: [one specific ${data.disasterType} safety instruction].",
  "timelineOrder": "T+0min: [first action]. T+${t1}min: [checkpoint action]. T+${t2}min: [progress check]. T+${data.evacuationMinutes}min: [completion target]."
}`;

  try {
    console.log('📡 Calling Groq API...');
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an emergency command AI. Respond ONLY with a raw JSON object. No markdown, no backticks, no explanation. Start your response with { and end with }.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.15,
      max_tokens: 700,
    }, {
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const raw = (res.data.choices?.[0]?.message?.content || '').trim();
    console.log('🤖 Groq response (first 300 chars):', raw.substring(0, 300));

    const cleaned = raw.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      console.log('✅ Groq JSON parsed successfully');
      return parsed;
    }
    console.warn('⚠️ No JSON found in Groq response');
    return null;
  } catch (err) {
    console.error('❌ Groq API error:', {
      status:  err.response?.status,
      data:    err.response?.data,
      message: err.message,
    });
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// MAIN ENDPOINT
// ══════════════════════════════════════════════════════════

exports.simulateCommandMode = async (req, res) => {
  try {
    const {
      authorityLatitude,
      authorityLongitude,
      authorityAddress   = '',
      incidentLatitude,
      incidentLongitude,
      incidentAddress    = '',
      affectedPopulation = 5000,
      disasterIntensity  = 6,
      disasterType       = 'unknown',
      evacuationLoad     = 50,
      roadCapacityMultiplier = 'normal',
      timeOfDay          = 'day',
    } = req.body;

    console.log('\n🎖️ [Command] Request body:', JSON.stringify(req.body, null, 2));

    if (authorityLatitude == null || authorityLongitude == null)
      return res.status(400).json({ success: false, message: 'authorityLatitude and authorityLongitude required.' });
    if (incidentLatitude == null || incidentLongitude == null)
      return res.status(400).json({ success: false, message: 'incidentLatitude and incidentLongitude required.' });

    const authLat  = Number(authorityLatitude);
    const authLng  = Number(authorityLongitude);
    const incLat   = Number(incidentLatitude);
    const incLng   = Number(incidentLongitude);
    const pop      = Number(affectedPopulation);
    const intensity= Number(disasterIntensity);
    const evacRate = Number(evacuationLoad);

    const directDist  = haversine(authLat, authLng, incLat, incLng);
    const mainBearing = bearing(authLat, authLng, incLat, incLng);
    const dirLabel    = ['N','NE','E','SE','S','SW','W','NW'][Math.round(mainBearing / 45) % 8];

    // 1. Generate routes (geometry only)
    const rawRoutes = generateRoutes(
      authLat, authLng, incLat, incLng,
      disasterType, intensity, timeOfDay, roadCapacityMultiplier
    );

    // 2. Realistic congestion analysis
    const { routes, panicMultiplier, effectiveDemand, networkCongestion, systemFlowRate } =
      analyzeRouteCongestion(rawRoutes, pop, evacRate, timeOfDay, intensity);

    const evacuationMinutes = Math.max(1, Math.round(pop / evacRate));

    const confidenceLevel = networkCongestion > 80 ? 58
                          : networkCongestion > 60 ? 72
                          : networkCongestion > 40 ? 84 : 92;

    // Cascade analysis
    const cascadingRisk = routes.map(r => ({
      failedRoute: r.name,
      fallbackRoutes: routes.filter(x => x.id !== r.id).map(x => {
        const extraLoad  = Math.round(r.flowOnRoute * 0.65);
        const newFlow    = x.flowOnRoute + extraLoad;
        const newCong    = Math.min(99, Math.round((newFlow / Math.max(1, x.routeCapacity)) * 100));
        return { name: x.name, type: x.type, cascadeDelay: Math.round(extraLoad / Math.max(1, x.routeCapacity) * 8), newCongestion: newCong };
      }),
    }));

    // Groq AI
    let aiSummary = null;
    try {
      aiSummary = await generateCommandAI({
        authLat, authLng, incLat, incLng,
        authorityAddress, incidentAddress,
        disasterType, intensity, timeOfDay,
        population: pop, panicMult: panicMultiplier,
        networkCongestion, evacuationMinutes,
        routes,
        riskReason: routes.find(r => r.type === 'dangerous')?.riskReason || '',
      });
    } catch (e) { console.error('⚠️ AI outer error:', e.message); }

    const disasterLabels = { flood:'🌊 Flood', fire:'🔥 Fire/Wildfire', earthquake:'🌍 Earthquake', hurricane:'🌀 Hurricane', chemical:'☣️ Chemical/HAZMAT', unknown:'🚨 Emergency' };

    return res.status(200).json({
      success: true,
      authorityLocation: { lat: authLat, lng: authLng, address: authorityAddress || `${authLat.toFixed(5)}, ${authLng.toFixed(5)}` },
      incidentLocation:  { lat: incLat,  lng: incLng,  address: incidentAddress  || `${incLat.toFixed(5)}, ${incLng.toFixed(5)}`  },
      routeSummary: {
        directDistanceKm: parseFloat(directDist.toFixed(2)),
        bearingDegrees:   parseFloat(mainBearing.toFixed(1)),
        directionLabel:   dirLabel,
      },
      disasterContext: {
        type: disasterType,
        label: disasterLabels[disasterType] || '🚨 Emergency',
        intensity,
        timeOfDay,
      },
      simulation: {
        networkCongestionPercent: networkCongestion,
        systemFlowRate,
        effectiveDemand,
        totalEvacuationTimeMinutes: evacuationMinutes,
        panicMultiplier,
        confidenceLevel,
        routes,
        recommendedRoute: routes.find(r => r.type === 'safe') || routes[0],
        topBottlenecks: [...routes].sort((a,b) => b.overloadRatio - a.overloadRatio).slice(0,2).map(r => ({
          routeName: r.name, routeType: r.label, overloadRatio: r.overloadRatio,
          severity: r.severity, congestionRiskPercent: r.congestionRiskPercent,
          timeToCongest: r.timeToCongest,
        })),
        cascadingRisk,
      },
      aiSummary: aiSummary || null,
    });

  } catch (err) {
    console.error('❌ Command error:', err.stack);
    res.status(500).json({ success: false, message: 'Simulation failed', error: err.message });
  }
};