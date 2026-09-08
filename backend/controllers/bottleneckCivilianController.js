// backend/controllers/bottleneckCivilianController.js
// Dual-Mode Evacuation Bottleneck — Civilian Mode
// FULL REWRITE: Dynamic routes based on disaster type, intensity, time, mobility
// Routes now change based on all input factors — no static output

const axios = require('axios');

// ==================== DYNAMIC ZONE + ROUTE ENGINE ====================

/**
 * Returns disaster-specific route networks.
 * Routes differ per disaster type — flood avoids low ground, fire avoids wind corridors, etc.
 */
function getDisasterRouteNetwork(disasterType, timeOfDay, disasterIntensity) {
  const isNight = timeOfDay === 'night' || timeOfDay === '3AM';
  const isSevere = disasterIntensity >= 7;

  const networks = {
    flood: {
      description: 'Flood evacuation — avoid low-lying roads, prioritize elevated routes',
      zones: {
        'Flood Zone A (Low Ground)': {
          lat: 40.7074, lng: -74.0113,
          risk: 'HIGH',
          exits: [
            { routeName: 'Highland Elevated Expressway', destination: 'Hilltop Emergency Shelter', distance: 6, baseCapacity: 280, lat1: 40.7074, lng1: -74.0113, lat2: 40.7480, lng2: -74.0050, safeFromFlood: true },
            { routeName: 'Northern High Ground Route', destination: 'Upland Assembly Point', distance: 8, baseCapacity: 220, lat1: 40.7074, lng1: -74.0113, lat2: 40.7620, lng2: -73.9800, safeFromFlood: true },
            { routeName: 'Bridge Crossing East', destination: 'Eastern Dry Zone Hub', distance: 5, baseCapacity: isNight ? 150 : 240, lat1: 40.7074, lng1: -74.0113, lat2: 40.7200, lng2: -73.9500, safeFromFlood: !isSevere },
          ]
        },
        'Riverside District': {
          lat: 40.7525, lng: -74.0156,
          risk: isSevere ? 'CRITICAL' : 'MODERATE',
          exits: [
            { routeName: 'Emergency Levee Road', destination: 'Inland Safety Zone', distance: 4, baseCapacity: isSevere ? 160 : 300, lat1: 40.7525, lng1: -74.0156, lat2: 40.7700, lng2: -73.9900, safeFromFlood: true },
            { routeName: 'Western Bypass — Grade A', destination: 'Western Highlands', distance: 9, baseCapacity: 260, lat1: 40.7525, lng1: -74.0156, lat2: 40.7600, lng2: -74.1000, safeFromFlood: true },
          ]
        },
        'Downtown Core': {
          lat: 40.7128, lng: -74.0060,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Broadway Elevation Corridor', destination: 'Central Park High Ground', distance: 5, baseCapacity: 320, lat1: 40.7128, lng1: -74.0060, lat2: 40.7831, lng2: -73.9656, safeFromFlood: true },
            { routeName: 'East River Bridge Route', destination: 'Brooklyn Heights', distance: 4, baseCapacity: 280, lat1: 40.7128, lng1: -74.0060, lat2: 40.6960, lng2: -73.9990, safeFromFlood: !isSevere },
          ]
        }
      }
    },

    fire: {
      description: 'Fire evacuation — avoid wind direction, prioritize perpendicular escape',
      zones: {
        'Fire Perimeter Zone': {
          lat: 40.7580, lng: -73.9855,
          risk: 'CRITICAL',
          exits: [
            { routeName: 'Windward Cross-Route Alpha', destination: 'Fire Perimeter Assembly', distance: 3, baseCapacity: isSevere ? 180 : 350, lat1: 40.7580, lng1: -73.9855, lat2: 40.7480, lng2: -74.0100, safeFromFlood: true },
            { routeName: isNight ? 'Emergency Night Corridor' : 'Southern Escape Route', destination: isNight ? 'Lighted Assembly Point' : 'South Safety Zone', distance: 5, baseCapacity: isNight ? 200 : 300, lat1: 40.7580, lng1: -73.9855, lat2: 40.7200, lng2: -73.9700, safeFromFlood: true },
            { routeName: 'Underground Transit Evac', destination: 'Northern Terminal Hub', distance: 4, baseCapacity: isSevere ? 100 : 250, lat1: 40.7580, lng1: -73.9855, lat2: 40.7800, lng2: -73.9650, safeFromFlood: true },
          ]
        },
        'Smoke Affected Zone': {
          lat: 40.7400, lng: -73.9900,
          risk: 'HIGH',
          exits: [
            { routeName: 'Upwind Safety Corridor', destination: 'Clear Air Zone North', distance: 6, baseCapacity: 260, lat1: 40.7400, lng1: -73.9900, lat2: 40.7900, lng2: -73.9700, safeFromFlood: true },
            { routeName: 'Eastern Perpendicular Route', destination: 'Queens Safe Zone', distance: 7, baseCapacity: 220, lat1: 40.7400, lng1: -73.9900, lat2: 40.7282, lng2: -73.7949, safeFromFlood: true },
          ]
        },
        'Downtown Core': {
          lat: 40.7128, lng: -74.0060,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Waterfront Fire Exit', destination: 'Harbor Evacuation Point', distance: 2, baseCapacity: 200, lat1: 40.7128, lng1: -74.0060, lat2: 40.6900, lng2: -74.0200, safeFromFlood: true },
            { routeName: 'Broadway North Corridor', destination: 'Midtown Assembly', distance: 4, baseCapacity: 340, lat1: 40.7128, lng1: -74.0060, lat2: 40.7580, lng2: -73.9855, safeFromFlood: true },
          ]
        }
      }
    },

    earthquake: {
      description: 'Earthquake — avoid bridges, tunnels, tall buildings; use open ground routes',
      zones: {
        'High-Rise District': {
          lat: 40.7580, lng: -73.9855,
          risk: 'CRITICAL',
          exits: [
            { routeName: 'Open Ground Route — Park West', destination: 'Central Park Open Assembly', distance: 3, baseCapacity: 400, lat1: 40.7580, lng1: -73.9855, lat2: 40.7831, lng2: -73.9656, safeFromFlood: true },
            { routeName: 'Street-Level Eastern Corridor', destination: 'East River Open Ground', distance: 5, baseCapacity: isSevere ? 150 : 280, lat1: 40.7580, lng1: -73.9855, lat2: 40.7282, lng2: -73.7949, safeFromFlood: !isSevere },
          ]
        },
        'Financial District': {
          lat: 40.7074, lng: -74.0113,
          risk: 'HIGH',
          exits: [
            { routeName: 'Battery Park Ground Level', destination: 'Waterfront Open Space', distance: 2, baseCapacity: 300, lat1: 40.7074, lng1: -74.0113, lat2: 40.7000, lng2: -74.0200, safeFromFlood: true },
            { routeName: 'Northern Surface Road', destination: 'Tribeca Open Assembly', distance: 3, baseCapacity: 260, lat1: 40.7074, lng1: -74.0113, lat2: 40.7200, lng2: -74.0050, safeFromFlood: true },
          ]
        },
        'Downtown Core': {
          lat: 40.7128, lng: -74.0060,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Westside Open Highway', destination: 'Hudson River Park', distance: 4, baseCapacity: 350, lat1: 40.7128, lng1: -74.0060, lat2: 40.7400, lng2: -74.0100, safeFromFlood: true },
            { routeName: 'Cross-Street Ground Route', destination: 'East Village Open Ground', distance: 5, baseCapacity: 280, lat1: 40.7128, lng1: -74.0060, lat2: 40.7264, lng2: -73.9818, safeFromFlood: true },
          ]
        }
      }
    },

    hurricane: {
      description: 'Hurricane — move inland, avoid coast and flood zones',
      zones: {
        'Coastal Zone (High Risk)': {
          lat: 40.6960, lng: -74.1770,
          risk: 'CRITICAL',
          exits: [
            { routeName: 'Inland Emergency Highway', destination: 'Interior Safe Zone', distance: 12, baseCapacity: isSevere ? 200 : 380, lat1: 40.6960, lng1: -74.1770, lat2: 40.7580, lng2: -73.9855, safeFromFlood: true },
            { routeName: 'Northern Inland Route', destination: 'Northern Evacuation Hub', distance: 15, baseCapacity: 300, lat1: 40.6960, lng1: -74.1770, lat2: 40.8500, lng2: -73.9000, safeFromFlood: true },
          ]
        },
        'Downtown Core': {
          lat: 40.7128, lng: -74.0060,
          risk: 'HIGH',
          exits: [
            { routeName: isNight ? 'Night Inland Expressway' : 'Inland Expressway North', destination: 'Inland Assembly Center', distance: 10, baseCapacity: isNight ? 180 : 320, lat1: 40.7128, lng1: -74.0060, lat2: 40.8200, lng2: -73.9500, safeFromFlood: true },
            { routeName: 'Cross-State Evacuation Route', destination: 'Upstate Safety Hub', distance: 20, baseCapacity: 260, lat1: 40.7128, lng1: -74.0060, lat2: 41.0534, lng2: -73.5387, safeFromFlood: true },
          ]
        },
        'Midtown': {
          lat: 40.7580, lng: -73.9855,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Bronx-Northern Inland Route', destination: 'Bronx Safe Assembly', distance: 8, baseCapacity: 300, lat1: 40.7580, lng1: -73.9855, lat2: 40.8448, lng2: -73.8648, safeFromFlood: true },
            { routeName: 'Queens Inland Connector', destination: 'Queens Emergency Hub', distance: 9, baseCapacity: 280, lat1: 40.7580, lng1: -73.9855, lat2: 40.7282, lng2: -73.7949, safeFromFlood: true },
          ]
        }
      }
    },

    chemical: {
      description: 'Chemical — move perpendicular to wind, avoid contamination zone',
      zones: {
        'Contamination Zone': {
          lat: 40.7128, lng: -74.0060,
          risk: 'CRITICAL',
          exits: [
            { routeName: 'Perpendicular Escape — Upwind', destination: 'Decontamination Zone A', distance: 3, baseCapacity: isSevere ? 120 : 200, lat1: 40.7128, lng1: -74.0060, lat2: 40.7400, lng2: -73.9700, safeFromFlood: true },
            { routeName: 'Emergency Decon Corridor', destination: 'Medical Staging Area', distance: 2, baseCapacity: 150, lat1: 40.7128, lng1: -74.0060, lat2: 40.7000, lng2: -73.9900, safeFromFlood: true },
          ]
        },
        'Buffer Zone': {
          lat: 40.7300, lng: -74.0000,
          risk: 'HIGH',
          exits: [
            { routeName: 'Clear Zone Northern Exit', destination: 'Clean Air Assembly Point', distance: 5, baseCapacity: 250, lat1: 40.7300, lng1: -74.0000, lat2: 40.7700, lng2: -73.9600, safeFromFlood: true },
            { routeName: 'Eastern Perimeter Route', destination: 'East Side Decon Hub', distance: 6, baseCapacity: 200, lat1: 40.7300, lng1: -74.0000, lat2: 40.7400, lng2: -73.9400, safeFromFlood: true },
          ]
        },
        'Downwind Risk Area': {
          lat: 40.7500, lng: -73.9700,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Perpendicular North Route', destination: 'Northern Clean Zone', distance: 4, baseCapacity: 280, lat1: 40.7500, lng1: -73.9700, lat2: 40.7900, lng2: -73.9600, safeFromFlood: true },
            { routeName: 'Rapid Transit Corridor', destination: 'Queens Medical Hub', distance: 7, baseCapacity: 220, lat1: 40.7500, lng1: -73.9700, lat2: 40.7282, lng2: -73.7949, safeFromFlood: true },
          ]
        }
      }
    },

    unknown: {
      description: 'General emergency evacuation — optimal multi-hazard routes',
      zones: {
        'Downtown': {
          lat: 40.7128, lng: -74.0060,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Broadway General Evacuation', destination: 'Central Assembly Point', distance: 5, baseCapacity: 320, lat1: 40.7128, lng1: -74.0060, lat2: 40.7831, lng2: -73.9656, safeFromFlood: true },
            { routeName: 'East Side Emergency Route', destination: 'East Side Shelter', distance: 4, baseCapacity: 260, lat1: 40.7128, lng1: -74.0060, lat2: 40.7264, lng2: -73.9818, safeFromFlood: true },
            { routeName: 'West Side Expressway', destination: 'Hudson Safe Zone', distance: 6, baseCapacity: 300, lat1: 40.7128, lng1: -74.0060, lat2: 40.7400, lng2: -74.0200, safeFromFlood: true },
          ]
        },
        'Midtown': {
          lat: 40.7580, lng: -73.9855,
          risk: 'LOW',
          exits: [
            { routeName: 'Central Corridor North', destination: 'Bronx Assembly Area', distance: 7, baseCapacity: 300, lat1: 40.7580, lng1: -73.9855, lat2: 40.8448, lng2: -73.8648, safeFromFlood: true },
            { routeName: 'Queens Express Route', destination: 'Queens Safe Zone', distance: 8, baseCapacity: 350, lat1: 40.7580, lng1: -73.9855, lat2: 40.7282, lng2: -73.7949, safeFromFlood: true },
          ]
        },
        'Financial District': {
          lat: 40.7074, lng: -74.0060,
          risk: 'MODERATE',
          exits: [
            { routeName: 'Brooklyn Bridge Route', destination: 'Brooklyn Evacuation Hub', distance: 5, baseCapacity: 280, lat1: 40.7074, lng1: -74.0060, lat2: 40.6960, lng2: -73.9990, safeFromFlood: true },
            { routeName: 'Ferry Terminal Evacuation', destination: 'Jersey Shore Hub', distance: 3, baseCapacity: 200, lat1: 40.7074, lng1: -74.0060, lat2: 40.7050, lng2: -74.0200, safeFromFlood: true },
          ]
        }
      }
    }
  };

  return networks[disasterType] || networks['unknown'];
}

// Haversine distance between two coords
function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Find nearest zone to user GPS position
function findNearestZone(userLat, userLng, network) {
  let nearest = null;
  let minDist = Infinity;
  Object.entries(network.zones).forEach(([name, zone]) => {
    const d = calcDist(userLat, userLng, zone.lat, zone.lng);
    if (d < minDist) { minDist = d; nearest = { name, ...zone, distanceFromUser: d }; }
  });
  return nearest;
}

// ==================== FACTOR-DRIVEN ROUTE SCORING ====================

function scoreRoutes(zone, affectedPopulation, familySize, mobilityType, disasterIntensity, timeOfDay, departureDelay) {
  const isNight = timeOfDay === 'night' || timeOfDay === '3AM';
  const isSevere = disasterIntensity >= 7;

  return zone.exits.map((exit, idx) => {
    let adjustedCapacity = exit.baseCapacity;

    // Disaster intensity degrades capacity
    if (disasterIntensity >= 9)      adjustedCapacity *= 0.55;
    else if (disasterIntensity >= 7) adjustedCapacity *= 0.70;
    else if (disasterIntensity >= 5) adjustedCapacity *= 0.85;

    // Night reduces effective capacity (visibility, panic, lighting)
    if (isNight) adjustedCapacity *= 0.75;

    // Vehicle evacuation needs more road space per person
    if (mobilityType === 'vehicle') adjustedCapacity *= 0.85;

    adjustedCapacity = Math.round(adjustedCapacity);

    // Load = population / routes, scaled by family size
    const load = (affectedPopulation / zone.exits.length) * Math.max(1, familySize * 0.3);
    const congestionRisk = Math.min(100, Math.round((load / adjustedCapacity) * 100));

    // Time to congest (minutes)
    const timeToCongest = Math.max(5, Math.round((adjustedCapacity / Math.max(1, load / 10)) * 5));

    // Base safety from congestion
    let safetyScore = 100 - congestionRisk;

    // Factor: mobility vs distance
    if (mobilityType === 'walking' && exit.distance > 5)     safetyScore -= 20;
    if (mobilityType === 'wheelchair' && exit.distance > 2)  safetyScore -= 30;
    if (mobilityType === 'vehicle' && exit.distance > 15)    safetyScore -= 10;

    // Factor: night time penalty for long routes
    if (isNight && exit.distance > 6) safetyScore -= 15;

    // Factor: severe disaster — routes marked unsafe get penalized
    if (isSevere && exit.safeFromFlood === false) safetyScore -= 25;

    // Factor: departure delay means congestion will have grown
    if (departureDelay > 15) safetyScore -= Math.round(departureDelay * 0.4);
    else if (departureDelay > 5) safetyScore -= Math.round(departureDelay * 0.2);

    // Factor: zone risk level
    const riskPenalty = { 'CRITICAL': 20, 'HIGH': 10, 'MODERATE': 5, 'LOW': 0 };
    safetyScore -= (riskPenalty[zone.risk] || 0);

    safetyScore = Math.max(10, Math.min(100, Math.round(safetyScore)));

    const mobilityFit =
      mobilityType === 'vehicle'    ? (exit.distance < 20 ? 'vehicle-optimal' : 'vehicle-long') :
      mobilityType === 'walking'    ? (exit.distance < 3  ? 'walking-suitable' : exit.distance < 6 ? 'walking-moderate' : 'walking-difficult') :
      mobilityType === 'wheelchair' ? (exit.distance < 2  ? 'accessible' : 'not-accessible') :
      'standard';

    // Estimated travel time
    const speedKmh = mobilityType === 'vehicle' ? 30 : mobilityType === 'walking' ? 4 : 2;
    const congestionDelay = Math.round((congestionRisk / 100) * (exit.distance / speedKmh) * 60 * 0.8);
    const baseTravelMin = Math.round((exit.distance / speedKmh) * 60);
    const estimatedTravelMinutes = baseTravelMin + congestionDelay + departureDelay;

    return {
      routeNumber: idx + 1,
      routeName: exit.routeName,
      destination: exit.destination,
      distanceKm: exit.distance,
      capacity: adjustedCapacity,
      congestionRiskPercent: congestionRisk,
      timeToCongestMinutes: timeToCongest,
      safetyScore,
      mobilityFit,
      estimatedTravelMinutes,
      mapCoords: {
        start: { lat: exit.lat1, lng: exit.lng1 },
        end:   { lat: exit.lat2, lng: exit.lng2 },
      },
    };
  }).sort((a, b) => b.safetyScore - a.safetyScore);
}

// ==================== GROQ AI GUIDANCE ====================

async function generateCivilianAIGuidance(routeAnalysis, userContext, zoneInfo) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) { console.warn('⚠️  GROQ_API_KEY missing'); return null; }

  const top3 = routeAnalysis.slice(0, 3);
  const routeLines = top3.map((r, i) =>
    `Route ${i+1}: "${r.routeName}" → ${r.destination} | Safety: ${r.safetyScore}/100 | Congestion: ${r.congestionRiskPercent}% | Est. travel: ${r.estimatedTravelMinutes} min | Distance: ${r.distanceKm} km | Mobility: ${r.mobilityFit}`
  ).join('\n');

  const systemPrompt = `You are an emergency evacuation AI advisor. You MUST respond with ONLY a JSON object. No markdown, no explanation, no preamble. Just the raw JSON.`;

  const userPrompt = `Disaster: ${userContext.disasterType} (Intensity ${userContext.disasterIntensity}/10)
Zone: ${zoneInfo.name} (Risk: ${zoneInfo.risk})
Evacuee: Family of ${userContext.familySize}, mobility: ${userContext.mobilityType}, departure delay: ${userContext.departureDelay} min
Time: ${userContext.timeOfDay || 'day'}

Routes available:
${routeLines}

Respond ONLY with this exact JSON structure:
{
  "safetySummary": "One sentence: current threat level and key risk factor",
  "routeExplanation": "One to two sentences: why the top route is best given the disaster type and evacuee profile",
  "urgencyLevel": "CRITICAL",
  "timeAdvice": "One sentence: specific timing advice based on departure delay and congestion",
  "finalConclusion": "TAKE Route 1: [route name]. Go to [destination]. [One specific action for this disaster type]."
}`;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }, { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } });

    const content = (res.data.choices[0]?.message?.content || '').trim();
    console.log('🤖 Groq raw response:', content.substring(0, 200));

    // Strip markdown fences if present
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error('❌ Groq civilian error:', err.response?.data || err.message);
    return null;
  }
}

// ==================== MAIN ENDPOINT ====================

exports.simulateCivilianMode = async (req, res) => {
  try {
    const {
      userLatitude,
      userLongitude,
      preparednessScore = 60,
      disasterType = 'unknown',
      familySize = 1,
      mobilityType = 'walking',
      departureDelay = 0,
      disasterIntensity = 6,
      affectedPopulation = 1000,
      timeOfDay = 'day',
    } = req.body;

    console.log('\n🚁 [Civilian Mode] Request:', JSON.stringify(req.body, null, 2));

    if (userLatitude == null || userLongitude == null) {
      return res.status(400).json({ success: false, message: 'userLatitude and userLongitude are required' });
    }

    const lat = Number(userLatitude);
    const lng = Number(userLongitude);
    const intensity = Number(disasterIntensity);
    const pop = Number(affectedPopulation);
    const fam = Number(familySize);
    const delay = Number(departureDelay);

    // Get disaster-specific network
    const network = getDisasterRouteNetwork(disasterType, timeOfDay, intensity);
    console.log(`📍 Network: ${disasterType} — ${network.description}`);

    // Find nearest zone
    const zone = findNearestZone(lat, lng, network);
    if (!zone) return res.status(400).json({ success: false, message: 'No evacuation zone found' });
    console.log(`📍 Nearest zone: ${zone.name} (${zone.distanceFromUser.toFixed(2)} km away)`);

    // Score and rank routes
    const scoredRoutes = scoreRoutes(zone, pop, fam, mobilityType, intensity, timeOfDay, delay);

    const recommendedRoute = scoredRoutes[0];

    const avgCongestion = Math.round(scoredRoutes.reduce((s, r) => s + r.congestionRiskPercent, 0) / scoredRoutes.length);
    const evacuationTimeEstimate = recommendedRoute.estimatedTravelMinutes;

    // AI guidance
    let aiGuidance = null;
    try {
      aiGuidance = await generateCivilianAIGuidance(scoredRoutes, {
        disasterType, disasterIntensity: intensity, familySize: fam,
        mobilityType, departureDelay: delay, timeOfDay,
      }, { name: zone.name, risk: zone.risk });
      console.log('✅ AI guidance:', aiGuidance ? 'generated' : 'null');
    } catch (e) {
      console.error('⚠️  AI guidance failed:', e.message);
    }

    return res.status(200).json({
      success: true,
      disasterNetwork: {
        type: disasterType,
        description: network.description,
      },
      zone: {
        name: zone.name,
        riskLevel: zone.risk,
        distanceFromUser: parseFloat(zone.distanceFromUser.toFixed(2)),
        coords: { lat: zone.lat, lng: zone.lng },
      },
      userLocation: { lat, lng },
      routeAnalysis: scoredRoutes,
      recommendedRoute: {
        routeNumber: scoredRoutes.indexOf(recommendedRoute) + 1,
        routeName: recommendedRoute.routeName,
        destination: recommendedRoute.destination,
        distanceKm: recommendedRoute.distanceKm,
        safetyScore: recommendedRoute.safetyScore,
        congestionRiskPercent: recommendedRoute.congestionRiskPercent,
        estimatedTravelMinutes: recommendedRoute.estimatedTravelMinutes,
        mapCoords: recommendedRoute.mapCoords,
      },
      evacuationTimeEstimate,
      congestionRiskPercent: avgCongestion,
      aiGuidance: aiGuidance || null,
    });

  } catch (err) {
    console.error('❌ Civilian error:', err);
    res.status(500).json({ success: false, message: 'Civilian simulation failed', error: err.message });
  }
};