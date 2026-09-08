import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   SENTINEL AI — Pune District Emergency Command
   ─────────────────────────────────────────────────────────────────────
   LIVE DATA SOURCES:
   • Overpass API   → real hospital + road counts per zone (OSM)
   • Open-Meteo API → live Pune weather, rain forecast
   • Groq AI        → llama3-70b threat analysis (free, fast)
     └ called ONLY on explicit user click — no background AI calls

   HOW TO ADD GROQ KEY:
   1. Go to https://console.groq.com/keys
   2. Create a free key (no credit card needed for llama3-70b)
   3. Set REACT_APP_GROQ_API_KEY in your .env
════════════════════════════════════════════════════════════════════════ */
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || "";

/* ─── Groq rate-limit guard ────────────────────────────────────────── */
// Track calls per minute — Groq free tier: ~30 RPM for llama3-70b
const groqCallLog = [];
const GROQ_RPM_LIMIT = 25; // stay safely under free tier limit

function canCallGroq() {
  const now = Date.now();
  // Purge calls older than 60s
  while (groqCallLog.length && now - groqCallLog[0] > 60000) groqCallLog.shift();
  return groqCallLog.length < GROQ_RPM_LIMIT;
}
function logGroqCall() { groqCallLog.push(Date.now()); }

/* ─── Zone seeds: coordinates + static PMC audit data ─────────────── */
const ZONE_SEEDS = [
  {
    id:"swargate",   name:"Swargate",    ward:"Kasba-Vishrambaug",  lat:18.5018, lng:73.8636,
    areaSqKm:2.1,  floodDepth:1.4, drainageQuality:0.28, hillProximity:0.12,
    nearRiver:true, riverName:"Mula-Mutha", encroachmentIndex:0.74, infraScore:31, medScore:38,
    neglect:[
      "Mula-Mutha bank: 60+ informal settlements built in active floodplain since 2015",
      "Storm drains rated for 12mm/hr — monsoon regularly delivers 80mm/hr",
      "2019 flood depth 1.4m: zero drainage infrastructure changed in 5 years",
      "Swargate MSRTC depot creates single-point bottleneck during any evacuation",
    ],
    recentEvents:[
      "Aug 2019: 72-hour submersion — 12,000 displaced, 3 confirmed deaths, ₹28cr damage",
      "Jul 2021: 0.8m flooding, MSRTC depot inundated, 800 buses stranded 4 days",
      "Jun 2023: Flash flood warning — 2,400 pre-emptively evacuated by PMC",
    ],
  },
  {
    id:"yerawada",   name:"Yerawada",    ward:"Yerawada-Kalas",     lat:18.5467, lng:73.8930,
    areaSqKm:3.9,  floodDepth:1.1, drainageQuality:0.33, hillProximity:0.18,
    nearRiver:true, riverName:"Mula", encroachmentIndex:0.61, infraScore:35, medScore:34,
    neglect:[
      "15,000 residents in Mula active floodplain with no flood wall or embankment",
      "Nagar Road: sole major egress — submerges at 30mm rain in <2 hours",
      "1 PHC per 100,000 residents (national norm: 1 per 30,000)",
    ],
    recentEvents:[
      "Sep 2019: 1.1m flood — 8,000 displaced, 2 deaths, army deployed for rescue",
      "Jul 2022: 400 residents trapped on rooftops — NDRF boats required",
      "Jun 2024: Mula at danger mark for 3 consecutive days, 1,200 on alert",
    ],
  },
  {
    id:"hadapsar",   name:"Hadapsar",    ward:"Haveli",             lat:18.5089, lng:73.9260,
    areaSqKm:6.8,  floodDepth:0.9, drainageQuality:0.41, hillProximity:0.22,
    nearRiver:false, encroachmentIndex:0.45, infraScore:47, medScore:52,
    neglect:[
      "Magarpatta + Phursungi IT expansion covered 400 acres of natural drainage channels",
      "Urban heat island effect: 3–4°C above city average, rising 0.3°C annually",
      "40% storm drains blocked by construction debris — PMC enforcement absent",
    ],
    recentEvents:[
      "Jun 2022: 320mm rain in 6h — Phursungi submerged for 4 days, ₹42cr loss",
      "May 2024: 44.2°C heatwave — 6 heat-stroke deaths, 340 hospitalised",
      "Jul 2023: Magarpatta-Hadapsar SH27 flooded 8 consecutive days",
    ],
  },
  {
    id:"katraj",     name:"Katraj",      ward:"Katraj-Kondhwa",     lat:18.4526, lng:73.8671,
    areaSqKm:4.2,  floodDepth:0.6, drainageQuality:0.52, hillProximity:0.68,
    nearRiver:false, encroachmentIndex:0.56, infraScore:42, medScore:45,
    neglect:[
      "200+ unauthorised buildings on Katraj ghat slope — no retaining walls",
      "Active quarrying destabilises 3km hillside — no regulatory action since 2020",
      "Ghat road is sole egress for 50,000 residents — fully blocks during landslide",
    ],
    recentEvents:[
      "Jul 2021: Minor slope failure — 300 evacuated from 12 buildings",
      "Aug 2022: Katraj lake overflow — 2.3km downstream flooded, ₹8cr damage",
      "2023: 3 unauthorised hillside structures collapsed post-rain, no casualties",
    ],
  },
  {
    id:"kondhwa",    name:"Kondhwa",     ward:"Katraj-Kondhwa",     lat:18.4677, lng:73.8854,
    areaSqKm:5.6,  floodDepth:0.8, drainageQuality:0.39, hillProximity:0.44,
    nearRiver:false, encroachmentIndex:0.62, infraScore:40, medScore:44,
    neglect:[
      "Kondhwa-Khurd: 1.2km hill-adjacent zone with zero retaining wall or drainage",
      "Construction debris blocks 60% of storm drains annually — seasonal issue since 2017",
    ],
    recentEvents:[
      "Jul 2022: 4 houses collapsed on slope — 22 displaced, 1 injury",
      "Aug 2023: Kondhwa Budruk flash flood — 800 affected, road cut for 3 days",
    ],
  },
  {
    id:"wanowrie",   name:"Wanowrie",    ward:"Wanowrie-Ramtekdi",  lat:18.4873, lng:73.8945,
    areaSqKm:3.8,  floodDepth:0.9, drainageQuality:0.35, hillProximity:0.25,
    nearRiver:false, encroachmentIndex:0.55, infraScore:38, medScore:42,
    neglect:[
      "Ramtekdi MIDC effluent enters floodwater — creates chemical hazard during inundation",
      "Stormwater network last upgraded 1998 — rated for 2.1 lakh population, now 4.8 lakh",
    ],
    recentEvents:[
      "Sep 2021: 0.9m submersion — 5,000 displaced, industrial runoff alert issued",
    ],
  },
  {
    id:"pimpri",     name:"Pimpri",      ward:"Pimpri-Chinchwad",   lat:18.6298, lng:73.7997,
    areaSqKm:8.2,  floodDepth:0.7, drainageQuality:0.44, hillProximity:0.14,
    nearRiver:true, riverName:"Pavana", encroachmentIndex:0.52, infraScore:49, medScore:56,
    neglect:[
      "MIDC industrial waste in Pavana: flood events create chemical + biological hazard",
      "25,000 MIDC workers housed in flood-prone informal settlements with no early warning",
    ],
    recentEvents:[
      "Aug 2021: Pavana flood — 25,000 affected, MIDC halted 4 days, ₹65cr industrial loss",
      "2022: Thergaon chemical plant flooded — HAZMAT deployed, 200m exclusion zone",
    ],
  },
  {
    id:"wakad",      name:"Wakad",       ward:"Pimpri-Chinchwad",   lat:18.5994, lng:73.7613,
    areaSqKm:4.5,  floodDepth:0.5, drainageQuality:0.58, hillProximity:0.08,
    nearRiver:false, encroachmentIndex:0.38, infraScore:55, medScore:60,
    neglect:[
      "Storm drain network designed for 2010 population (1.8L) — now serves 5.2L",
      "Wakad bridge low sector: 4,000 residents in annual repeat-flood corridor",
    ],
    recentEvents:[
      "Jul 2023: Wakad bridge area submerged — 800 relocated, IT access cut 6 hours",
    ],
  },
  {
    id:"kharadi",    name:"Kharadi",     ward:"Kharadi",            lat:18.5530, lng:73.9432,
    areaSqKm:4.1,  floodDepth:0.6, drainageQuality:0.50, hillProximity:0.10,
    nearRiver:false, encroachmentIndex:0.40, infraScore:53, medScore:55,
    neglect:[
      "EON IT park development filled 3 natural drainage channels — no mitigation built",
      "Nagar Road corridor: 180,000 daily commuters, zero alternate route in flood",
    ],
    recentEvents:[
      "Aug 2022: EON basement flood — ₹12cr IT equipment loss",
      "Jul 2023: Kharadi main road waterlogged 3 days, 60,000 daily commute disrupted",
    ],
  },
  {
    id:"shivajinagar", name:"Shivajinagar", ward:"Shivajinagar",   lat:18.5308, lng:73.8474,
    areaSqKm:2.8,  floodDepth:0.5, drainageQuality:0.55, hillProximity:0.05,
    nearRiver:true, riverName:"Mula", encroachmentIndex:0.31, infraScore:61, medScore:74,
    neglect:[
      "Mula riverside: 3,200 shanty residents in active floodplain, no permanent housing",
      "CBD traffic: emergency vehicle response delayed avg 8–12 min during peak hours",
    ],
    recentEvents:[
      "Jul 2023: Mula at danger mark — 1,200 riverside residents warned",
      "Jun 2024: Riverside road submerged, arterial traffic diverted 3 days",
    ],
  },
  {
    id:"kothrud",    name:"Kothrud",     ward:"Kothrud",            lat:18.5074, lng:73.8077,
    areaSqKm:5.1,  floodDepth:0.3, drainageQuality:0.68, hillProximity:0.31,
    nearRiver:false, encroachmentIndex:0.28, infraScore:65, medScore:71,
    neglect:[
      "Pashan lake: 50,000 downstream residents have no overflow early-warning siren",
      "Peak traffic delays emergency deployment by avg 10–15 min in western zones",
    ],
    recentEvents:[
      "Jul 2021: Localised flooding — PMC response within 4 hours, minimal damage",
      "2023: Peripheral hillside building partial collapse — no casualties",
    ],
  },
  {
    id:"aundh",      name:"Aundh",       ward:"Aundh-Baner",        lat:18.5589, lng:73.8078,
    areaSqKm:4.8,  floodDepth:0.35, drainageQuality:0.65, hillProximity:0.15,
    nearRiver:false, encroachmentIndex:0.25, infraScore:63, medScore:68,
    neglect:[
      "Pashan lake 95% capacity during peak monsoon — downstream 50,000 unprotected",
    ],
    recentEvents:[
      "Jul 2023: Baner-Pashan road waterlogged 3 days — PMC drain backlog cited",
      "Aug 2024: Lake water level hit 97% — emergency spillway opened without warning",
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   OVERPASS API — live hospital + major road counts from OpenStreetMap
════════════════════════════════════════════════════════════════════════ */
const osmCache = new Map();

async function fetchOSMCountsWithRetry(lat, lng, retries = 2) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (osmCache.has(cacheKey)) return osmCache.get(cacheKey);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchOSMCounts(lat, lng);
      if (result) { osmCache.set(cacheKey, result); return result; }
    } catch (error) {
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return null;
}

async function fetchOSMCounts(lat, lng) {
  const R = 0.017;
  const bb = `${lat-R},${lng-R},${lat+R},${lng+R}`;
  const query = `[out:json][timeout:10];
  (
    node["amenity"~"hospital|clinic|health_post|doctors"](${bb});
    way["amenity"~"hospital|clinic|health_post|doctors"](${bb});
    way["highway"~"primary|secondary|trunk|primary_link"](${bb});
  );
  out count;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method:"POST", body:query,
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!r.ok) return null;
    const d = await r.json();
    let hospitals = 0, roads = 0;
    if (d.elements) {
      d.elements.forEach(el => {
        if (el.tags) {
          if (["hospital","clinic","health_post","doctors"].includes(el.tags.amenity)) hospitals++;
          if (["primary","secondary","trunk","primary_link"].includes(el.tags.highway)) roads++;
        }
      });
    }
    return {
      hospitals: Math.max(1, hospitals),
      roads: Math.max(2, Math.min(14, Math.ceil(roads * 0.8))),
    };
  } catch { return null; }
}

async function fetchBatchOSMCounts(zones) {
  const results = [];
  for (let i = 0; i < zones.length; i++) {
    const result = await fetchOSMCountsWithRetry(zones[i].lat, zones[i].lng, 1);
    results.push(result);
    if (i < zones.length - 1) await new Promise(r => setTimeout(r, 3000));
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════
   OPEN-METEO — live Pune weather (free, no key)
════════════════════════════════════════════════════════════════════════ */
async function fetchWeather() {
  if (fetchWeather.cache && Date.now() - fetchWeather.cache.timestamp < 300000)
    return fetchWeather.cache.data;

  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=18.52&longitude=73.86" +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m" +
      "&hourly=precipitation&forecast_days=1&timezone=Asia/Kolkata";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const d = await (await fetch(url, { signal: controller.signal })).json();
    clearTimeout(timeoutId);
    const c = d.current;
    const WMO = {0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",
      51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Moderate rain",
      65:"Heavy rain",80:"Showers",81:"Moderate showers",82:"Violent showers",
      95:"Thunderstorm",99:"Severe thunderstorm"};
    const hrs = (d.hourly?.precipitation || []).slice(0,6);
    const rain6h = Math.round(hrs.reduce((a,b)=>a+(b||0),0)*10)/10;
    const result = {
      temp: c.temperature_2m, humidity: c.relative_humidity_2m,
      feelsLike: c.apparent_temperature,
      rain: Math.round((c.rain||0)*10)/10,
      windSpeed: Math.round(c.wind_speed_10m),
      windGusts: Math.round(c.wind_gusts_10m||0),
      condition: WMO[c.weather_code] || "Unknown",
      code: c.weather_code, rain6h,
      alert: (c.rain||0) > 15 || rain6h > 25,
      severeAlert: (c.rain||0) > 40 || rain6h > 60,
    };
    fetchWeather.cache = { data: result, timestamp: Date.now() };
    return result;
  } catch { return fetchWeather.cache?.data || null; }
}

/* ═══════════════════════════════════════════════════════════════════════
   RISK SCORING ENGINE
════════════════════════════════════════════════════════════════════════ */
function scoreZone(z) {
  const density = z.population / z.areaSqKm;
  const flood = Math.min(1,
    z.floodDepth   * 0.40 +
    (1-z.drainageQuality) * 0.28 +
    z.encroachmentIndex * 0.20 +
    (z.nearRiver ? 0.12 : 0)
  );
  const routesPer100k = (z.evacuationRoutes / z.population) * 1e5;
  const evacDeficit   = Math.min(1, Math.max(0, 1 - routesPer100k / 4.5));
  const hospPer100k   = (z.hospitals / z.population) * 1e5;
  const medDeficit    = Math.min(1, Math.max(0, 1 - hospPer100k / 2.5));
  const infraVuln     = 1 - z.infraScore / 100;
  const popPress      = Math.min(1, Math.log10(Math.max(1, density)) / 4.8);
  const hillFactor    = z.hillProximity * 0.65;
  const base =
    flood      * 0.30 +
    evacDeficit* 0.24 +
    medDeficit * 0.18 +
    infraVuln  * 0.14 +
    popPress   * 0.09 +
    hillFactor * 0.05;
  const compound = 1
    + (flood > 0.55 && evacDeficit > 0.5  ? 0.20 : 0)
    + (density > 40000 && medDeficit > 0.6 ? 0.10 : 0)
    + (z.hillProximity > 0.6 && evacDeficit > 0.4 ? 0.08 : 0);
  return {
    score: Math.min(93, Math.max(10, Math.round(base * 100 * compound))),
    flood, evacDeficit, medDeficit,
    density: Math.round(density),
    routesPer100k: Math.round(routesPer100k*10)/10,
    hospPer100k:   Math.round(hospPer100k*10)/10,
  };
}

function tier(s) {
  if (s >= 72) return {t:"CRITICAL", c:"#ef4444", bg:"#fee2e2"};
  if (s >= 52) return {t:"HIGH",     c:"#f97316", bg:"#ffedd5"};
  if (s >= 33) return {t:"MODERATE", c:"#eab308", bg:"#fef3c7"};
  return              {t:"LOW",      c:"#22c55e", bg:"#dcfce7"};
}

/* ═══════════════════════════════════════════════════════════════════════
   GROQ AI ANALYSIS — only called on explicit user click
   Claude API removed entirely. Uses REACT_APP_GROQ_API_KEY env var.
════════════════════════════════════════════════════════════════════════ */
async function runAI(zone, weather) {
  // Derive a plain-English weather situation for the prompt
  const rainNow   = weather?.rain    ?? 0;
  const rain6h    = weather?.rain6h  ?? 0;
  const condition = weather?.condition ?? "Unknown";
  const temp      = weather?.temp    ?? "--";
  const wind      = weather?.windSpeed ?? 0;

  // Weather severity classification — drives tone of entire analysis
  const wxSevere  = rainNow > 40  || rain6h > 60;
  const wxAlert   = rainNow > 15  || rain6h > 25;
  const wxMild    = rainNow <= 5  && rain6h <= 12 && wind < 40;
  const wxClear   = rainNow === 0 && rain6h <= 3  && condition.toLowerCase().match(/clear|partly|mainly/);

  const wxSituation = wxSevere ? `⚠ SEVERE ACTIVE RAIN: ${rainNow}mm now, ${rain6h}mm next 6h — flood conditions are ACTIVE right now.`
    : wxAlert   ? `⚠ RAIN ALERT: ${rainNow}mm now, ${rain6h}mm forecast 6h — elevated risk, drains may overwhelm.`
    : wxMild    ? `BENIGN CONDITIONS: ${rainNow}mm rain now, ${rain6h}mm expected next 6h, ${condition} at ${temp}°C. No acute weather threat.`
    : wxClear   ? `CLEAR / DRY: ${condition} at ${temp}°C. Zero precipitation active or forecast imminently.`
    : `NEUTRAL: ${condition} at ${temp}°C, ${rainNow}mm rain now, ${rain6h}mm next 6h.`;

  const prompt = `You are a calm, precise analyst at Pune Municipal Corporation Emergency Operations Center (EOC). Your job is to give ACCURATE, PROPORTIONATE risk assessments — neither alarmist nor dismissive. Weather conditions ALWAYS take priority over historical risk scores when determining current urgency.

═══ WEATHER SITUATION (evaluate THIS first) ═══
${wxSituation}
Wind: ${wind}km/h | Humidity: ${weather?.humidity ?? "--"}%

CRITICAL INSTRUCTION: If the weather situation is BENIGN or CLEAR, the urgency must reflect that reality. A zone may have bad historical flood data but if there is no rain now and none forecast, do NOT issue IMMEDIATE or 24H urgency unless there is another active non-weather hazard (e.g. active landslide, structural failure). Use 72H or STANDBY for preparedness framing instead. Casualties and economic loss estimates should reflect the CURRENT WEATHER WINDOW (typically next 72h), not the worst historical event.

═══ ZONE DATA ═══
Zone: ${zone.name} (${zone.ward} Ward)
Risk Score: ${zone.c.score}/100 | Tier: ${tier(zone.c.score).t}
Area: ${zone.areaSqKm}km² | Population: ~${zone.population.toLocaleString()} | Density: ${zone.c.density.toLocaleString()}/km²

Live OSM infrastructure:
- Medical facilities (1.8km radius): ${zone.hospitals} (${zone.c.hospPer100k}/100k; WHO min 2.5/100k)
- Major roads (1.8km radius): ${zone.evacuationRoutes} (${zone.c.routesPer100k}/100k; recommended 4+/100k)

Physical risk (PMC audit / NDMA):
- Flood history depth: ${zone.floodDepth}m | River-adjacent: ${zone.nearRiver?`YES — ${zone.riverName}`:"No"}
- Drainage efficiency: ${Math.round(zone.drainageQuality*100)}% | Floodplain encroachment: ${Math.round(zone.encroachmentIndex*100)}%
- Hill/landslide exposure: ${Math.round(zone.hillProximity*100)}%
- Infra score: ${zone.infraScore}/100 | Medical score: ${zone.medScore}/100
- Flood exposure factor: ${Math.round(zone.c.flood*100)}% | Evacuation deficit: ${Math.round(zone.c.evacDeficit*100)}%
- Lives in flood-risk zone: ~${zone.livesAtRisk.toLocaleString()}

Documented PMC failures: ${zone.neglect.join(" | ")}
Historical events: ${zone.recentEvents.join(" | ")}

═══ RESOURCE RULES ═══
- boats: ONLY if nearRiver=${zone.nearRiver} AND floodDepth > 0.7m AND active rain → ${zone.nearRiver && zone.floodDepth > 0.7 && wxAlert ? "YES" : "NO — 0 boats"}
- helicopters: only if score ≥ 65 OR hillProximity > 0.5 → ${zone.c.score >= 65 || zone.hillProximity > 0.5 ? "YES" : "NO — 0"}
- shelter beds: livesAtRisk × ${wxSevere ? "0.30 (active emergency)" : wxAlert ? "0.20" : "0.05 (standby only — no active threat)"}
- resource scale: if weather is BENIGN/CLEAR, scale ALL resource numbers DOWN by 60-70% — these are PREPAREDNESS postures, not active deployments

═══ TONE CALIBRATION ═══
${wxSevere ? "ACTIVE EMERGENCY TONE: Describe immediate threat, urgent deployment." :
  wxAlert  ? "ELEVATED WATCH TONE: Describe heightened readiness, pre-positioning." :
  wxMild   ? "PREPAREDNESS TONE: Describe structural vulnerabilities to address during dry window. No panic. Practical long-term actions." :
             "ROUTINE MONITORING TONE: Calm assessment of baseline vulnerabilities. No emergency language."}

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "summary": "2-sentence briefing that leads with current weather reality before mentioning structural risk",
  "primaryDriver": "${wxClear||wxMild ? "structural/infrastructure vulnerability (NOT weather — conditions are calm)" : "most important active risk factor"}",
  "scenario": "scenario calibrated to CURRENT weather window (72h), not worst-case historical",
  "negligence": "specific PMC/govt infrastructure failures that matter regardless of weather",
  "actions": ["action1","action2","action3","action4"],
  "resources": {
    "troops": <number — scaled to weather severity>,
    "ambulances": <number>,
    "fireEngines": <number>,
    "rescueTeams": <number>,
    "helicopters": <number — 0 if no qualifier>,
    "medStaff": <number>,
    "shelterBeds": <number — use 5% of livesAtRisk for calm weather, 20-30% for active emergency>,
    "waterTrucks": <number>,
    "boats": <number — 0 if no active rain or not river-adjacent>
  },
  "urgency": "${wxSevere?"IMMEDIATE":wxAlert?"24H":"72H or STANDBY — use STANDBY if conditions fully calm"}",
  "windowHours": <hours until situation changes — longer if calm weather>,
  "outlook": "WORSENING|STABLE|IMPROVING — base on weather trend, not just historical score",
  "casualties": "${wxMild||wxClear?"0–minimal if no rain materialises; up to X if monsoon arrives unexpectedly":"realistic range for current 72h window"}",
  "economicLoss": "₹X-Y crore — calibrated to current weather window",
  "longTerm": "specific infrastructure fix with cost estimate — this is most valuable when weather is calm",
  "alertLevel": "${wxSevere?"RED":wxAlert?"ORANGE":wxMild?"YELLOW":"GREEN — use GREEN for calm conditions even in high-risk zones"}",
  "weatherNote": "how TODAY's specific weather changes or maintains the risk level for this zone"
}`;

  // Groq only — no Claude fallback
  if (!GROQ_API_KEY) {
    return makeFallback(zone, weather);
  }

  if (!canCallGroq()) {
    console.warn("Groq rate limit reached — using local fallback");
    return makeFallback(zone, weather);
  }

  try {
    logGroqCall();
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_API_KEY}`},
      body:JSON.stringify({
        model:"llama3-70b-8192",
        max_tokens:900,
        temperature:0.3,
        messages:[{role:"user",content:prompt}]
      }),
    });
    const d = await r.json();
    const txt = d.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
    return parsed;
  } catch (e) {
    console.warn("Groq failed, using local fallback:", e);
    return makeFallback(zone, weather);
  }
}

function makeFallback(zone, weather) {
  const s = zone.c.score;
  const f = s / 100;
  const pop = zone.population;

  const rainNow  = weather?.rain   ?? 0;
  const rain6h   = weather?.rain6h ?? 0;
  const wxSevere = rainNow > 40 || rain6h > 60;
  const wxAlert  = rainNow > 15 || rain6h > 25;
  const wxCalm   = rainNow <= 5 && rain6h <= 12;

  // Resource scale: full deployment for active emergency, reduced for calm
  const deployScale = wxSevere ? 1.0 : wxAlert ? 0.65 : wxCalm ? 0.25 : 0.4;
  const sc = (base) => Math.max(1, Math.round(base * f * deployScale * (0.7 + pop / 400000)));

  const needsBoats = zone.nearRiver && zone.floodDepth > 0.7 && wxAlert;
  const needsHeli  = (s >= 65 || zone.hillProximity > 0.5) && !wxCalm;

  // Shelter proportional to weather severity
  const shelterRate = wxSevere ? 0.30 : wxAlert ? 0.20 : 0.05;
  const shelter = Math.round(zone.livesAtRisk * shelterRate);

  const alertLevel = wxSevere ? (s>=52?"RED":"ORANGE") : wxAlert ? (s>=72?"ORANGE":"YELLOW") : wxCalm ? "GREEN" : "YELLOW";
  const urgency    = wxSevere ? (s>=52?"IMMEDIATE":"24H") : wxAlert ? "24H" : wxCalm ? "STANDBY" : "72H";

  const wx = weather
    ? wxCalm
      ? `Current conditions are calm (${weather.condition}, ${weather.temp}°C, ${rainNow}mm rain, ${rain6h}mm forecast). Structural vulnerabilities remain but no active weather threat.`
      : wxSevere
        ? `⚠ Active severe rain (${rainNow}mm now, ${rain6h}mm next 6h) — flood conditions are live.`
        : `⚠ Rain alert: ${rainNow}mm now, ${rain6h}mm forecast. Drainage stress expected.`
    : "Weather data unavailable.";

  const summaryWeather = wxCalm
    ? `Current weather is calm with ${rainNow}mm rain and clear forecast — no acute threat.`
    : wxSevere ? `Active severe rain (${rainNow}mm) is triggering flood conditions now.`
    : `Rain alert (${rainNow}mm now) elevates flood risk.`;

  return {
    summary: `${summaryWeather} ${zone.name} scores ${s}/100 (${tier(s).t}) — structural vulnerabilities ${wxCalm ? "are noted for future preparedness" : "are now active risk factors"}.`,
    primaryDriver: wxCalm
      ? `Infrastructure gap (${Math.round(zone.c.evacDeficit*100)}% evacuation deficit) — no current weather threat, but critical to fix before monsoon`
      : zone.floodDepth > 0.9
        ? `Active flood risk — ${zone.floodDepth}m historical depth with only ${Math.round(zone.drainageQuality*100)}% drainage capacity`
        : zone.hillProximity > 0.55
          ? `Landslide exposure (${Math.round(zone.hillProximity*100)}%) — single egress road`
          : `Evacuation deficit (${Math.round(zone.c.evacDeficit*100)}%) — ${zone.evacuationRoutes} roads for ${zone.population.toLocaleString()} residents`,
    scenario: wxCalm
      ? `No immediate threat. If monsoon rains arrive (>60mm/3h), ${Math.round(zone.livesAtRisk*0.20).toLocaleString()}–${Math.round(zone.livesAtRisk*0.40).toLocaleString()} residents could be at risk. Current dry window is optimal for infrastructure improvement.`
      : `Sustained rain will displace ${Math.round(zone.livesAtRisk*0.35).toLocaleString()}–${zone.livesAtRisk.toLocaleString()} residents within ${s>=70?"4–8":"12–24"} hours. ${zone.hospitals} local facilities will saturate in ~${Math.round(3+(1-f)*9)} hours.`,
    negligence: zone.neglect.slice(0,2).join(". ") + ".",
    actions: wxCalm ? [
      `Audit and clear ${zone.name} storm drains — use current dry window before monsoon`,
      `Survey ${Math.round(shelter * 5)} potential shelter locations in PMC schools/community halls`,
      `Inspect ${zone.hospitals} medical facilities for emergency surge capacity`,
      `Install early-warning flood sensors at ${zone.nearRiver ? `${zone.riverName} bank` : "low-lying zones"} before next monsoon`,
    ] : [
      `Pre-position ${sc(7)} NDRF teams at ${zone.nearRiver?`${zone.riverName} river bank`:"flood-prone sectors"}`,
      `Open ${Math.round(shelter*1.2).toLocaleString()} emergency shelter beds in PMC schools`,
      `Deploy ${sc(9)} mobile medical units — offset ${zone.hospitals} local facility deficit`,
      `Broadcast flood advisory via PA + SMS to ${zone.name} ward`,
    ],
    resources:{
      troops: sc(85), ambulances: sc(13), fireEngines: sc(8),
      rescueTeams: sc(6), helicopters: needsHeli ? sc(2) : 0,
      medStaff: sc(38), shelterBeds: shelter,
      waterTrucks: sc(9), boats: needsBoats ? sc(5) : 0,
    },
    urgency,
    windowHours: urgency==="IMMEDIATE"?2:urgency==="24H"?12:urgency==="72H"?48:168,
    outlook: wxSevere?"WORSENING":wxAlert?"STABLE":wxCalm?"IMPROVING":"STABLE",
    casualties: wxCalm
      ? `0 (current) — up to ${Math.max(1,Math.round(zone.livesAtRisk*0.003))} if monsoon arrives without preparation`
      : `${Math.max(1,Math.round(zone.livesAtRisk*0.0012))}–${Math.round(zone.livesAtRisk*0.005)}`,
    economicLoss: wxCalm
      ? `₹0 (current) — ₹${Math.round(s*pop/14000000)}–${Math.round(s*pop/6000000)} crore if monsoon event occurs`
      : `₹${Math.round(s*pop/14000000)}–₹${Math.round(s*pop/4000000)} crore`,
    longTerm: `Upgrade ${zone.name} stormwater network to 70mm/hr capacity (est. ₹${Math.round(s*0.4)}–${Math.round(s*1.1)} crore). Add ${Math.max(1,4-zone.evacuationRoutes)} emergency evacuation corridors.`,
    alertLevel,
    weatherNote: wx,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   LEAFLET LOADER
════════════════════════════════════════════════════════════════════════ */
function useLeaflet() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.L?.heatLayer) { setReady(true); return; }
    const css = h => {
      if (!document.querySelector(`link[href="${h}"]`)) {
        const l = document.createElement("link"); l.rel="stylesheet"; l.href=h;
        document.head.appendChild(l);
      }
    };
    const js = src => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        const iv = setInterval(() => {
          if (src.includes("heat") ? window.L?.heatLayer : window.L) { clearInterval(iv); res(); }
        }, 80); return;
      }
      const s = document.createElement("script");
      s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
    css("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css");
    js("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js")
      .then(()=>js("https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"))
      .then(()=>setReady(true)).catch(console.error);
  }, []);
  return ready;
}

/* ─── small UI atoms ────────────────────────────────────────────────── */
function Ring({ score, color, size=48, large }) {
  const sw = large?7:4.5, r=(size-sw*2-2)/2, circ=2*Math.PI*r, cx=size/2, cy=size/2;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 4px ${color}88)`}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:large?18:11,fontWeight:800,color,lineHeight:1}}>{score}</span>
        {large && <span style={{fontSize:8,color:"#94a3b8"}}>/100</span>}
      </div>
    </div>
  );
}

function Bar({ label, value, color, unit="%" }) {
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:10,color:"#64748b"}}>{label}</span>
        <span style={{fontSize:10,color,fontWeight:700}}>{value}{unit}</span>
      </div>
      <div style={{height:4,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,value)}%`,background:color,borderRadius:3,transition:"width 0.7s"}}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HEATMAP COLOR HELPER
   Maps risk score (0–100) to a color matching the tier system:
   LOW (0–32)      → green  (#22c55e)
   MODERATE (33–51)→ yellow (#eab308)
   HIGH (52–71)    → orange (#f97316)
   CRITICAL (72+)  → red    (#ef4444)
   Used to generate per-zone heat points with correct color intensity.
════════════════════════════════════════════════════════════════════════ */
function scoreToHeatValue(score) {
  // Map score to [0, 1] gradient position that aligns with our tier colours.
  // Leaflet.heat gradient keys: 0.0=green, 0.35=yellow, 0.60=orange, 0.85=red
  if (score < 33) return (score / 33) * 0.34;           // 0.00 – 0.34 → green
  if (score < 52) return 0.35 + ((score - 33) / 19) * 0.24; // 0.35 – 0.59 → yellow
  if (score < 72) return 0.60 + ((score - 52) / 20) * 0.24; // 0.60 – 0.84 → orange
  return 0.85 + ((score - 72) / 28) * 0.15;             // 0.85 – 1.00 → red
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const mapEl    = useRef(null);
  const mapRef   = useRef(null);
  const heatRef  = useRef(null);
  const mksRef   = useRef([]);
  const builtRef = useRef(false);
  const lfReady  = useLeaflet();

  const [zones,      setZones]      = useState([]);
  const [osmDone,    setOsmDone]    = useState(false);
  const [osmFailed,  setOsmFailed]  = useState(false);
  const [weather,    setWeather]    = useState(null);
  const [tab,        setTab]        = useState("map");
  const [mapMode,    setMapMode]    = useState("both");
  const [filterTier, setFilterTier] = useState("ALL");
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState(null);
  const [analysis,   setAnalysis]   = useState(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [groqRemaining, setGroqRemaining] = useState(GROQ_RPM_LIMIT);

  /* ── load live OSM data once ──────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const initialZones = ZONE_SEEDS.map(seed => {
          const pop = Math.round(seed.areaSqKm * 36000 + (1 - seed.infraScore/100) * 18000);
          const population = Math.min(420000, Math.max(100000, pop));
          const hospitals = Math.max(1, Math.round(seed.medScore / 18));
          const evacuationRoutes = Math.max(2, Math.round(seed.infraScore / 12));
          const z = { ...seed, population, hospitals, evacuationRoutes };
          const c = scoreZone(z);
          return { ...z, c, riskScore: c.score, livesAtRisk: Math.round(population * c.flood * 0.30), osmLive: false };
        }).sort((a,b)=>b.riskScore-a.riskScore);

        if (alive) { setZones(initialZones); setOsmDone(true); }

        const osmResults = await fetchBatchOSMCounts(ZONE_SEEDS);
        if (!alive) return;

        const enriched = ZONE_SEEDS.map((seed, index) => {
          const pop = Math.round(seed.areaSqKm * 36000 + (1 - seed.infraScore/100) * 18000);
          const population = Math.min(420000, Math.max(100000, pop));
          const osm = osmResults[index];
          const hospitals = osm ? Math.min(14, Math.max(1, osm.hospitals)) : Math.max(1, Math.round(seed.medScore / 18));
          const evacuationRoutes = osm ? Math.min(14, Math.max(2, Math.round(osm.roads * 0.65))) : Math.max(2, Math.round(seed.infraScore / 12));
          const z = { ...seed, population, hospitals, evacuationRoutes };
          const c = scoreZone(z);
          return { ...z, c, riskScore: c.score, livesAtRisk: Math.round(population * c.flood * 0.30), osmLive: !!osm };
        }).sort((a,b)=>b.riskScore-a.riskScore);

        if (alive) { setZones(enriched); setOsmFailed(false); }
      } catch {
        if (alive) setOsmFailed(true);
      }
    }

    run();
    return () => { alive = false; };
  }, []);

  /* ── weather ─────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchWeather().then(setWeather);
    const iv = setInterval(() => fetchWeather().then(setWeather), 600000);
    return () => clearInterval(iv);
  }, []);

  /* ── Groq RPM counter refresh ────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      while (groqCallLog.length && now - groqCallLog[0] > 60000) groqCallLog.shift();
      setGroqRemaining(GROQ_RPM_LIMIT - groqCallLog.length);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const stats = {
    critical: zones.filter(z=>z.riskScore>=72).length,
    high:     zones.filter(z=>z.riskScore>=52&&z.riskScore<72).length,
    moderate: zones.filter(z=>z.riskScore>=33&&z.riskScore<52).length,
    low:      zones.filter(z=>z.riskScore<33).length,
    lives:    zones.reduce((s,z)=>s+z.livesAtRisk,0),
    pop:      zones.reduce((s,z)=>s+z.population,0),
  };

  const filtered = zones.filter(z => {
    if (filterTier!=="ALL" && tier(z.riskScore).t !== filterTier) return false;
    if (search && !z.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  /* ── MAP INIT ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!lfReady || !mapEl.current || builtRef.current) return;
    builtRef.current = true;
    const L = window.L;
    const map = L.map(mapEl.current, {
      center:[18.52,73.87], zoom:12, minZoom:10, maxZoom:19,
      zoomControl:false, preferCanvas:true,
    });
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {attribution:"© OSM © CARTO",subdomains:"abcd",maxZoom:19}).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 300);
    return () => { map.remove(); mapRef.current=null; builtRef.current=false; };
  }, [lfReady]);

  useEffect(() => {
    if (tab==="map" && mapRef.current) {
      requestAnimationFrame(() => setTimeout(() => mapRef.current?.invalidateSize(), 80));
    }
  }, [tab]);

  /* ── BUILD HEATMAP + MARKERS ──────────────────────────────────────── */
  const buildLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.L || zones.length===0) return;
    const L = window.L;

    mksRef.current.forEach(m => { try { map.removeLayer(m); } catch {} });
    mksRef.current = [];
    if (heatRef.current) { try { map.removeLayer(heatRef.current); } catch {} heatRef.current=null; }

    const vis = filtered.length > 0 ? filtered : zones;

    /* ─────────────────────────────────────────────────────────────────
       HEATMAP — each zone gets a tight cluster sized to its areaSqKm.
       Heat intensity value maps exactly to the risk tier colour:
         0.00–0.32 → green  (LOW)
         0.33–0.58 → yellow (MODERATE)
         0.59–0.83 → orange (HIGH)
         0.84–1.00 → red    (CRITICAL)
       Radius is kept small (28px) so colours stay tightly bound to
       each marker position rather than bleeding across the whole map.
    ───────────────────────────────────────────────────────────────── */
    if ((mapMode==="heat"||mapMode==="both") && L.heatLayer) {
      const pts = [];
      vis.forEach(z => {
        const heatVal = scoreToHeatValue(z.riskScore);
        // Zone radius in degrees: sqrt(area/π) → tight, zone-proportional
        const radiusDeg = Math.sqrt(z.areaSqKm / Math.PI) * 0.009;
        // Dense core: 60% weight points in inner 30% of radius
        const coreCount = 18;
        const ringCount = 12;

        // Heavy centre point
        pts.push([z.lat, z.lng, heatVal]);
        pts.push([z.lat, z.lng, heatVal]);
        pts.push([z.lat, z.lng, heatVal]);

        // Core cluster — very tight around centre
        for (let i = 0; i < coreCount; i++) {
          const ang = (i / coreCount) * 2 * Math.PI;
          const r   = radiusDeg * 0.30 * Math.sqrt(Math.random());
          pts.push([z.lat + Math.sin(ang) * r * 0.7, z.lng + Math.cos(ang) * r, heatVal * 0.92]);
        }

        // Outer ring — stays within zone boundary, decays slightly
        for (let i = 0; i < ringCount; i++) {
          const ang = (i / ringCount) * 2 * Math.PI + 0.3;
          const r   = radiusDeg * (0.55 + Math.random() * 0.45);
          pts.push([z.lat + Math.sin(ang) * r * 0.7, z.lng + Math.cos(ang) * r, heatVal * 0.55]);
        }
      });

      heatRef.current = L.heatLayer(pts, {
        radius: 28,   // smaller = more zone-accurate, less bleed
        blur:   20,
        maxZoom: 15,
        max: 1.0,
        gradient: {
          0.00: "#dcfce7",
          0.16: "#86efac",
          0.32: "#4ade80",
          0.33: "#fef9c3",
          0.46: "#fde047",
          0.58: "#facc15",
          0.59: "#fed7aa",
          0.71: "#fb923c",
          0.83: "#f87171",
          0.84: "#fca5a5",
          1.00: "#ef4444",
        },
      });
      heatRef.current.addTo(map);
    }

    /* ─ markers ─ */
    if (mapMode==="markers"||mapMode==="both") {
      vis.forEach(z => {
        const {t:tl,c:col,bg} = tier(z.riskScore);
        const crit = z.riskScore >= 72;
        const sz   = Math.max(40, Math.min(64, 34+z.riskScore*0.30));
        const iconHtml = `<div style="position:relative;width:${sz}px;height:${sz}px">
          ${crit?`<div style="position:absolute;inset:-9px;border-radius:50%;border:2px solid ${col};animation:rp 2.2s ease-in-out infinite;opacity:0.3;pointer-events:none"></div><div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid ${col};animation:rp 2.2s ease-in-out infinite 0.8s;opacity:0.18;pointer-events:none"></div>`:""}
          <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#ffffff;border:2.5px solid ${col};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.1);cursor:pointer">
            <span style="font-size:${sz<46?12:14}px;font-weight:800;color:${col};font-family:monospace;line-height:1.1">${z.riskScore}</span>
            <span style="font-size:6px;color:#64748b;letter-spacing:0.5px;font-family:monospace">${tl}</span>
          </div></div>`;
        const tip = `<div style="background:#ffffff;border-radius:12px;padding:14px 16px;font-family:monospace;min-width:240px;box-shadow:0 12px 40px rgba(0,0,0,0.15);border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            <b style="color:${col};font-size:15px">${z.name}</b>
            <span style="background:${bg};color:${col};border-radius:4px;padding:2px 8px;font-size:9px;font-weight:800">${tl}</span>
          </div>
          <div style="color:#64748b;font-size:10px;margin-bottom:10px">${z.ward} · ${z.osmLive?"OSM live":"estimated"}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:10px;margin-bottom:10px">
            <div><span style="color:#64748b">Pop: </span><b style="color:#1e293b">~${z.population.toLocaleString()}</b></div>
            <div><span style="color:#64748b">Density: </span><b style="color:#1e293b">${z.c.density.toLocaleString()}/km²</b></div>
            <div><span style="color:#64748b">Hospitals: </span><b style="color:${z.hospitals<3?"#ef4444":"#1e293b"}">${z.hospitals}${z.hospitals<3?" ⚠":""}</b></div>
            <div><span style="color:#64748b">Roads: </span><b style="color:${z.evacuationRoutes<4?"#ef4444":"#1e293b"}">${z.evacuationRoutes}${z.evacuationRoutes<4?" ⚠":""}</b></div>
            <div><span style="color:#64748b">Flood: </span><b style="color:${z.floodDepth>0.8?"#ef4444":"#1e293b"}">${z.floodDepth}m</b></div>
            <div><span style="color:#64748b">Drainage: </span><b style="color:${z.drainageQuality<0.4?"#ef4444":"#1e293b"}">${Math.round(z.drainageQuality*100)}%</b></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px">
            ${[["Flood",Math.round(z.c.flood*100),"#3b82f6"],["Evac Gap",Math.round(z.c.evacDeficit*100),"#f97316"],["Med Gap",Math.round(z.c.medDeficit*100),"#ef4444"]]
              .map(([l,v,c])=>`<div style="background:#f8fafc;border-radius:5px;padding:5px 6px;text-align:center;border:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;margin-bottom:2px">${l}</div><div style="font-size:12px;font-weight:700;color:${c}">${v}%</div></div>`).join("")}
          </div>
          <div style="font-size:9px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px">⚠ ${z.neglect[0]}</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:5px;text-align:right">Click → AI analysis</div>
        </div>`;
        const mk = L.marker([z.lat,z.lng],{
          icon:L.divIcon({className:"",html:iconHtml,iconSize:[sz+20,sz+20],iconAnchor:[(sz+20)/2,(sz+20)/2]}),
          zIndexOffset:z.riskScore*10,
        });
        mk.bindTooltip(tip,{sticky:true,className:"stip",opacity:1,offset:[16,0]});
        mk.on("click",()=>{setSelected(z);setAnalysis(null);setTab("intel");});
        mk.addTo(map);
        mksRef.current.push(mk);
      });
    }
  }, [filtered, mapMode, zones]);

  useEffect(() => { if (lfReady && zones.length > 0) buildLayers(); }, [buildLayers, lfReady, zones]);

  /* ── AI analysis — only called on user click ─────────────────────── */
  async function runAnalysis(zone) {
    setAnalyzing(true); setAnalysis(null);
    const r = await runAI(zone, weather);
    setAnalysis(r); setAnalyzing(false);
  }

  const AC = {RED:"#ef4444",ORANGE:"#f97316",YELLOW:"#eab308",GREEN:"#22c55e"};
  const UC = {IMMEDIATE:"#ef4444","24H":"#f97316","72H":"#eab308",STANDBY:"#22c55e"};
  const OI = {WORSENING:"▲",STABLE:"◆",IMPROVING:"▼"};
  const OC = {WORSENING:"#ef4444",STABLE:"#eab308",IMPROVING:"#22c55e"};

  const groqLabel = !GROQ_API_KEY
    ? "⚠ No Groq key — local fallback"
    : `Groq llama3-70b · ${groqRemaining}/${GROQ_RPM_LIMIT} calls/min`;

  return (
    <div style={S.root}>
      <style>{ANIM}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <header style={S.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:30,color:"#3b82f6"}}>◈</span>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#1e293b",letterSpacing:4,lineHeight:1}}>SENTINEL AI</div>
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginTop:3}}>
                Pune EOC · {osmFailed?"OSM Fallback":"OSM Live"} · Open-Meteo · {groqLabel}
              </div>
            </div>
          </div>
          <div style={{width:1,height:34,background:"#e2e8f0",flexShrink:0}}/>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {[{v:stats.critical,l:"CRITICAL",c:"#ef4444"},{v:stats.high,l:"HIGH",c:"#f97316"},
              {v:stats.moderate,l:"MODERATE",c:"#eab308"},{v:stats.low,l:"LOW",c:"#22c55e"},
              {v:`${(stats.lives/1000).toFixed(0)}K`,l:"AT RISK",c:"#ef4444"},
              {v:`${(stats.pop/1e6).toFixed(2)}M`,l:"MONITORED",c:"#3b82f6"},
            ].map(({v,l,c})=>(
              <div key={l} style={{display:"flex",flexDirection:"column",alignItems:"center",background:"#f8fafc",borderRadius:8,padding:"6px 12px",gap:2,border:"1px solid #e2e8f0"}}>
                <span style={{color:c,fontSize:20,fontWeight:800,lineHeight:1}}>{osmDone?v:"…"}</span>
                <span style={{color:"#64748b",fontSize:7,letterSpacing:1.5}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {!osmDone && (
            <div style={{display:"flex",alignItems:"center",gap:7,background:"#f8fafc",borderRadius:8,padding:"5px 12px",border:"1px solid #e2e8f0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",borderWidth:2,borderStyle:"solid",borderColor:"#3b82f6",borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
              <span style={{fontSize:9,color:"#3b82f6"}}>Loading zones…</span>
            </div>
          )}
          {osmFailed && (
            <div style={{background:"#fee2e2",color:"#b91c1c",borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700}}>⚠ OSM Unavailable</div>
          )}
          {weather && (
            <div style={{display:"flex",alignItems:"center",gap:9,background:"#f8fafc",borderRadius:8,padding:"6px 12px",border:`1px solid ${weather.alert?"#f97316":"#e2e8f0"}`}}>
              <span style={{fontSize:18}}>{weather.code>=95?"⛈️":weather.rain>5?"🌧️":weather.code<=3?"☀️":"⛅"}</span>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#1e293b",lineHeight:1}}>{weather.temp}°C</div>
                <div style={{fontSize:8,color:"#64748b"}}>Pune Live</div>
              </div>
              {weather.alert && <div style={{background:"#fee2e2",color:"#b91c1c",borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700,animation:"blink 1.5s infinite"}}>⚠</div>}
            </div>
          )}
          {/* Groq quota indicator */}
          {GROQ_API_KEY && (
            <div style={{display:"flex",alignItems:"center",gap:6,background:"#f8fafc",borderRadius:8,padding:"5px 12px",border:`1px solid ${groqRemaining<5?"#ef4444":"#e2e8f0"}`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:groqRemaining>10?"#22c55e":groqRemaining>4?"#eab308":"#ef4444"}}/>
              <span style={{fontSize:9,color:"#64748b"}}>Groq {groqRemaining}/{GROQ_RPM_LIMIT}</span>
            </div>
          )}
          <div style={{background:"#fee2e2",borderRadius:7,padding:"5px 12px",fontSize:9,fontWeight:700,color:"#b91c1c",letterSpacing:2,animation:"blink 1.5s infinite",border:"1px solid #fecaca"}}>● LIVE</div>
        </div>
      </header>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════ */}
      <div style={S.toolbar}>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"nowrap"}}>
          {[["map","🗺 Map"],["zones","◉ Zones"],["intel","⚡ Intel"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{...S.navBtn,...(tab===k?S.navOn:{})}}>{l}</button>
          ))}
          <div style={{width:1,height:18,background:"#e2e8f0"}}/>
          {tab==="map" && (
            <>{[["both","⊛ Both"],["heat","🌡 Heat"],["markers","◉ Marks"]].map(([m,l])=>(
              <button key={m} onClick={()=>setMapMode(m)} style={{...S.fBtn,...(mapMode===m?S.fBtnOn:{})}}>{l}</button>
            ))}<div style={{width:1,height:18,background:"#e2e8f0"}}/></>
          )}
          {["ALL","CRITICAL","HIGH","MODERATE","LOW"].map(f=>{
            const c=f==="CRITICAL"?"#ef4444":f==="HIGH"?"#f97316":f==="MODERATE"?"#eab308":f==="LOW"?"#22c55e":"#64748b";
            return (
              <button key={f} onClick={()=>setFilterTier(f)}
                style={{...S.fBtn,...(filterTier===f?{...S.fBtnOn,color:c}:{})}}>{f}</button>
            );
          })}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search zone…" style={S.srch}/>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════ */}
      {/* KEY LAYOUT FIX: body is position:relative so the map can be
          absolutely positioned and NEVER collapses — other tabs render
          on top via z-index stacking, not by hiding the map container */}
      <div style={{...S.body, position:"relative"}}>

        {/* ─ MAP — always mounted at full size, hidden behind other tabs ── */}
        <div style={{
          position:"absolute", inset:0,
          background:"#ffffff",
          visibility: tab==="map" ? "visible" : "hidden",
          zIndex: tab==="map" ? 1 : 0,
        }}>
          {(!lfReady || zones.length===0) && tab==="map" && (
            <div style={{position:"absolute",inset:0,zIndex:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#ffffff"}}>
              <div style={{width:40,height:40,borderRadius:"50%",borderWidth:3,borderStyle:"solid",borderColor:"#e2e8f0",borderTopColor:"#3b82f6",animation:"spin 0.8s linear infinite"}}/>
              <span style={{color:"#64748b",fontSize:11,marginTop:14,letterSpacing:3}}>
                {!lfReady?"LOADING MAP…":"LOADING ZONES…"}
              </span>
            </div>
          )}
          <div ref={mapEl} style={{width:"100%",height:"100%"}}/>

          {/* legend — updated to show tier colours */}
          <div style={{position:"absolute",bottom:40,left:14,zIndex:1000,background:"#ffffff",borderRadius:10,padding:"13px 16px",minWidth:200,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",border:"1px solid #e2e8f0"}}>
            <div style={{fontSize:8,color:"#64748b",letterSpacing:2.5,marginBottom:7}}>RISK LEVEL</div>
            {/* Tier-accurate gradient bar */}
            <div style={{height:8,borderRadius:4,background:"linear-gradient(90deg,#22c55e 0%,#4ade80 33%,#eab308 35%,#facc15 59%,#f97316 60%,#fb923c 84%,#ef4444 100%)",marginBottom:6}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              {[["LOW","#22c55e"],["MOD","#eab308"],["HIGH","#f97316"],["CRIT","#ef4444"]].map(([l,c])=>(
                <span key={l} style={{fontSize:7,color:c,fontWeight:700}}>{l}</span>
              ))}
            </div>
            <div style={{borderTop:"1px solid #e2e8f0",paddingTop:8,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:9,color:"#64748b"}}>Hover → zone details</div>
              <div style={{fontSize:9,color:"#64748b"}}>Click → Groq AI analysis</div>
            </div>
          </div>
          <div style={{position:"absolute",top:12,left:14,zIndex:1000,background:"#ffffff",borderRadius:6,padding:"5px 12px",fontSize:10,color:"#64748b",border:"1px solid #e2e8f0",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
            {filtered.length} zones · Pune · {osmFailed?"Estimated data":"OSM live"}
          </div>
          {weather && (
            <div style={{position:"absolute",top:12,right:14,zIndex:1000,background:"#ffffff",borderRadius:6,padding:"5px 12px",fontSize:10,color:"#64748b",border:`1px solid ${weather.alert?"#f97316":"#e2e8f0"}`,boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
              {weather.temp}°C · {weather.condition} · Rain: {weather.rain}mm
              {weather.alert&&<span style={{color:"#ef4444",fontWeight:700,marginLeft:7}}>⚠ Rain alert</span>}
            </div>
          )}
        </div>

        {/* ─ ZONES LIST ───────────────────────────────────────────── */}
        {tab==="zones" && (
          <div style={{position:"absolute",inset:0,zIndex:2,overflowY:"auto",background:"#f8fafc"}}>
            {zones.length===0?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14}}>
                <div style={{width:36,height:36,borderRadius:"50%",borderWidth:3,borderStyle:"solid",borderColor:"#e2e8f0",borderTopColor:"#3b82f6",animation:"spin 0.8s linear infinite"}}/>
                <span style={{color:"#64748b",fontSize:11,letterSpacing:2}}>LOADING ZONES…</span>
              </div>
            ):(
              <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
                {filtered.map((z,i)=>{
                  const {t:tl,c:col,bg} = tier(z.riskScore);
                  return (
                    <div key={z.id} onClick={()=>{setSelected(z);setAnalysis(null);setTab("intel");}}
                      style={{background:"#ffffff",borderRadius:12,padding:"15px 17px",cursor:"pointer",border:"1px solid #e2e8f0",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                            <span style={{fontSize:10,color:col,fontWeight:800}}>#{i+1}</span>
                            <span style={{fontSize:14,fontWeight:800,color:"#1e293b"}}>{z.name}</span>
                            <span style={{background:bg,color:col,borderRadius:4,padding:"2px 7px",fontSize:8,fontWeight:700,letterSpacing:1}}>{tl}</span>
                            {z.osmLive && <span style={{fontSize:8,color:"#22c55e"}}>live</span>}
                          </div>
                          <div style={{fontSize:10,color:"#64748b"}}>{z.ward} · ~{z.population.toLocaleString()}</div>
                        </div>
                        <Ring score={z.riskScore} color={col} size={54}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
                        {[{l:"Flood Depth",v:`${z.floodDepth}m`,w:z.floodDepth>0.8},
                          {l:"Roads",v:z.evacuationRoutes,w:z.evacuationRoutes<4},
                          {l:"Hospitals",v:z.hospitals,w:z.hospitals<3},
                          {l:"Drainage",v:`${Math.round(z.drainageQuality*100)}%`,w:z.drainageQuality<0.4},
                          {l:"Pop/km²",v:z.c.density.toLocaleString(),w:z.c.density>50000},
                          {l:"Infra",v:`${z.infraScore}/100`,w:z.infraScore<40},
                        ].map(({l,v,w})=>(
                          <div key={l} style={{background:"#f8fafc",borderRadius:7,padding:"7px 9px",border:"1px solid #e2e8f0"}}>
                            <div style={{fontSize:7,color:"#64748b",marginBottom:2}}>{l}</div>
                            <div style={{fontSize:12,fontWeight:700,color:w?"#ef4444":"#334155"}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <Bar label="Flood Exposure"    value={Math.round(z.c.flood*100)}       color="#3b82f6"/>
                      <Bar label="Evacuation Deficit" value={Math.round(z.c.evacDeficit*100)} color="#f97316"/>
                      <Bar label="Medical Deficit"   value={Math.round(z.c.medDeficit*100)}  color="#ef4444"/>
                      {z.neglect[0] && (
                        <div style={{marginTop:10,background:"#fee2e2",borderRadius:6,padding:"6px 10px",fontSize:9,color:"#b91c1c",fontStyle:"italic",lineHeight:1.5,border:"1px solid #fecaca"}}>⚠ {z.neglect[0]}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─ INTEL ────────────────────────────────────────────────── */}
        {tab==="intel" && (
          <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",overflow:"hidden",background:"#f8fafc"}}>
            {/* sidebar */}
            <div style={{width:238,borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",background:"#ffffff",flexShrink:0,overflow:"hidden"}}>
              <div style={{fontSize:8,color:"#64748b",letterSpacing:2.5,padding:"11px 16px 9px",borderBottom:"1px solid #e2e8f0",fontWeight:700}}>
                SELECT ZONE {zones.length===0&&"· loading…"}
              </div>
              <div style={{overflowY:"auto",flex:1}}>
                {zones.map(z=>{
                  const {t:tl,c:col}=tier(z.riskScore), sel=selected?.id===z.id;
                  return (
                    <div key={z.id} onClick={()=>{setSelected(z);setAnalysis(null);}}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",
                        borderLeft:`3px solid ${sel?col:"transparent"}`,cursor:"pointer",
                        borderBottom:"1px solid #f1f5f9",background:sel?"#f8fafc":"transparent",transition:"background 0.15s"}}>
                      <Ring score={z.riskScore} color={col} size={38}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{z.name}</div>
                        <div style={{fontSize:9,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{z.ward}</div>
                        <div style={{fontSize:9,color:col,fontWeight:600,marginTop:1}}>{tl} · {z.riskScore}/100</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* main panel */}
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              {!selected?(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,textAlign:"center",padding:60}}>
                  <div style={{fontSize:52,opacity:0.2,marginBottom:18,color:"#94a3b8"}}>◈</div>
                  <div style={{fontSize:15,color:"#64748b",marginBottom:10,fontWeight:700}}>Select a zone for AI analysis</div>
                  <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.8,maxWidth:380}}>
                    {GROQ_API_KEY?"Groq llama3-70b (on-demand only)":"Local fallback — add REACT_APP_GROQ_API_KEY for AI analysis"} will analyse live OSM hospital/road counts,
                    real flood history, drainage data, and live Open-Meteo weather to produce precise resource deployment numbers.
                    AI is called only when you click the Analyse button — no background calls.
                  </div>
                </div>
              ):(() => {
                const {c:col,t:tl,bg} = tier(selected.riskScore);
                return (
                  <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
                    {/* zone banner */}
                    <div style={{background:"#ffffff",borderRadius:12,padding:"18px 22px",marginBottom:12,border:"1px solid #e2e8f0",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                            <h2 style={{margin:0,fontSize:22,fontWeight:800,color:"#1e293b"}}>{selected.name}</h2>
                            <span style={{background:bg,color:col,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700,letterSpacing:1}}>{tl}</span>
                            {selected.osmLive&&<span style={{fontSize:9,color:"#22c55e"}}>live</span>}
                          </div>
                          <div style={{fontSize:11,color:"#64748b",marginBottom:14}}>{selected.ward} Ward · {selected.lat.toFixed(4)}°N, {selected.lng.toFixed(4)}°E</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                            {[{icon:"👥",l:"Population",v:`~${selected.population.toLocaleString()}`},
                              {icon:"📐",l:"Pop Density",v:`${selected.c.density.toLocaleString()}/km²`},
                              {icon:"🏥",l:"Hospitals",v:selected.hospitals,w:selected.hospitals<3},
                              {icon:"🛣",l:"Roads",v:selected.evacuationRoutes,w:selected.evacuationRoutes<4},
                              {icon:"🌊",l:"Flood Depth",v:`${selected.floodDepth}m`,w:selected.floodDepth>0.8},
                              {icon:"🚰",l:"Drainage",v:`${Math.round(selected.drainageQuality*100)}%`,w:selected.drainageQuality<0.4},
                              {icon:"⚠",l:"Lives at Risk",v:`~${selected.livesAtRisk.toLocaleString()}`,w:true},
                            ].map(m=>(
                              <div key={m.l} style={{display:"flex",alignItems:"center",gap:9,background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
                                <span style={{fontSize:18}}>{m.icon}</span>
                                <div>
                                  <div style={{fontSize:8,color:"#64748b"}}>{m.l}</div>
                                  <div style={{fontSize:13,fontWeight:700,color:m.w?"#ef4444":"#334155"}}>{m.v}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Ring score={selected.riskScore} color={col} size={92} large/>
                      </div>
                      <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                        <Bar label="Flood Exposure"    value={Math.round(selected.c.flood*100)}       color="#3b82f6"/>
                        <Bar label="Evacuation Deficit" value={Math.round(selected.c.evacDeficit*100)} color="#f97316"/>
                        <Bar label="Medical Deficit"   value={Math.round(selected.c.medDeficit*100)}  color="#ef4444"/>
                      </div>
                      {!analysis && (
                        <div style={{marginTop:16}}>
                          {/* Groq quota warning if low */}
                          {GROQ_API_KEY && groqRemaining <= 3 && (
                            <div style={{background:"#fef3c7",borderRadius:6,padding:"5px 12px",fontSize:9,color:"#b45309",fontWeight:700,marginBottom:8,textAlign:"center",border:"1px solid #fde68a"}}>
                              ⚠ Only {groqRemaining} Groq API calls remaining this minute — analysis will use local fallback if exhausted
                            </div>
                          )}
                          <button onClick={()=>runAnalysis(selected)} disabled={analyzing}
                            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"13px",
                              background:"#3b82f6",color:"#fff",border:"none",borderRadius:9,
                              fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:1,
                              boxShadow:"0 2px 4px rgba(0,0,0,0.1)",opacity:analyzing?0.7:1}}>
                            {analyzing
                              ?<><div style={{width:14,height:14,borderRadius:"50%",borderWidth:2,borderStyle:"solid",borderColor:"rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.7s linear infinite"}}/> Analyzing…</>
                              :`⚡ Run ${GROQ_API_KEY?"predictive":"Local"} Threat Analysis`}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* weather */}
                    {weather && (
                      <div style={{background:"#ffffff",borderRadius:10,padding:"14px 16px",marginBottom:10,border:`1px solid ${weather.severeAlert?"#ef4444":weather.alert?"#f97316":"#e2e8f0"}`,boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
                        {weather.severeAlert&&<div style={{background:"#fee2e2",borderRadius:6,padding:"6px 12px",fontSize:10,color:"#b91c1c",fontWeight:700,marginBottom:10,textAlign:"center",letterSpacing:1,border:"1px solid #fecaca"}}>⚠ SEVERE RAIN ALERT — FLOOD RISK ELEVATED</div>}
                        {weather.alert&&!weather.severeAlert&&<div style={{background:"#fef3c7",borderRadius:6,padding:"5px 12px",fontSize:10,color:"#b45309",fontWeight:700,marginBottom:10,textAlign:"center",border:"1px solid #fde68a"}}>⚠ Rain alert active — monitor drainage</div>}
                        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
                          <span style={{fontSize:32}}>{weather.code>=95?"⛈️":weather.rain>5?"🌧️":weather.code<=3?"☀️":"⛅"}</span>
                          <div>
                            <div style={{fontSize:22,fontWeight:800,color:"#1e293b",lineHeight:1}}>{weather.temp}°C</div>
                            <div style={{fontSize:10,color:"#64748b"}}>{weather.condition}</div>
                          </div>
                          <div style={{marginLeft:"auto",textAlign:"right"}}>
                            <div style={{fontSize:9,color:"#64748b"}}>Feels like</div>
                            <div style={{fontSize:15,fontWeight:700,color:"#334155"}}>{weather.feelsLike}°C</div>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                          {[{l:"💧 Now",v:`${weather.rain}mm`,w:weather.rain>15},
                            {l:"🌧 6h",v:`${weather.rain6h}mm`,w:weather.rain6h>20},
                            {l:"💨 Wind",v:`${weather.windSpeed}km/h`,w:weather.windSpeed>50},
                            {l:"💦 Humid",v:`${weather.humidity}%`},
                          ].map(({l,v,w})=>(
                            <div key={l} style={{background:"#f8fafc",borderRadius:7,padding:"7px 10px",border:"1px solid #e2e8f0"}}>
                              <div style={{fontSize:9,color:"#64748b"}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:w?"#ef4444":"#334155"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{fontSize:8,color:"#94a3b8",marginTop:5,textAlign:"right"}}>Open-Meteo · Live · 10min refresh</div>
                      </div>
                    )}

                    {/* analyzing spinner */}
                    {analyzing && (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",gap:12,background:"#ffffff",borderRadius:12,marginBottom:12,border:"1px solid #e2e8f0"}}>
                        <div style={{width:52,height:52,borderRadius:"50%",border:"3px solid #e2e8f0",borderTopColor:"#3b82f6",animation:"spin 0.8s linear infinite"}}/>
                        <div style={{color:"#3b82f6",fontWeight:800,letterSpacing:3,fontSize:12}}>GROQ AI PROCESSING</div>
                        <div style={{color:"#94a3b8",fontSize:11}}>Analysing OSM data, flood history, weather, infrastructure deficits…</div>
                      </div>
                    )}

                    {/* results */}
                    {analysis && !analyzing && (
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {/* alert strip */}
                        <div style={{background:"#ffffff",borderRadius:12,padding:"14px 20px",border:`1px solid ${AC[analysis.alertLevel]}44`,boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:20,alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",gap:22,alignItems:"center",flexWrap:"wrap"}}>
                              {[{l:"ALERT",v:analysis.alertLevel,c:AC[analysis.alertLevel],sz:24},
                                {l:"URGENCY",v:analysis.urgency,c:UC[analysis.urgency],sz:20},
                                {l:"OUTLOOK",v:`${OI[analysis.outlook]} ${analysis.outlook}`,c:OC[analysis.outlook],sz:17},
                                {l:"WINDOW",v:`${analysis.windowHours}h`,c:"#1e293b",sz:21},
                              ].map(({l,v,c,sz})=>(
                                <div key={l}>
                                  <div style={{fontSize:8,color:"#64748b",letterSpacing:2,marginBottom:3}}>{l}</div>
                                  <div style={{fontSize:sz,fontWeight:800,color:c}}>{v}</div>
                                </div>
                              ))}
                            </div>
                            <button onClick={()=>setAnalysis(null)} style={{background:"#ffffff",color:"#64748b",borderRadius:7,padding:"6px 14px",fontSize:10,cursor:"pointer",fontFamily:"inherit",border:"1px solid #e2e8f0"}}>↺ Re-analyse</button>
                          </div>
                        </div>

                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <ICard span={2} label="◈ SITUATION SUMMARY">
                            <p style={T.body}>{analysis.summary}</p>
                            {analysis.primaryDriver && (
                              <div style={{marginTop:9,background:"#f8fafc",borderRadius:7,padding:"9px 12px",border:"1px solid #e2e8f0"}}>
                                <div style={{fontSize:8,color:"#64748b",letterSpacing:1.5,marginBottom:4}}>PRIMARY RISK DRIVER</div>
                                <div style={{fontSize:12,color:"#b45309",fontWeight:600}}>{analysis.primaryDriver}</div>
                              </div>
                            )}
                          </ICard>

                          <ICard label="💸 COST OF INACTION" dark>
                            <div style={{fontSize:22,fontWeight:800,color:"#ef4444",margin:"8px 0 3px"}}>{analysis.economicLoss}</div>
                            <div style={{fontSize:9,color:"#64748b",marginBottom:10}}>Estimated damage without response</div>
                            <div style={{fontSize:8,color:"#64748b",letterSpacing:1.5,marginBottom:4}}>CASUALTIES (NO ACTION)</div>
                            <div style={{fontSize:19,fontWeight:800,color:"#ef4444"}}>{analysis.casualties} lives</div>
                          </ICard>

                          <ICard label="🌧 LIVE WEATHER IMPACT" labelColor="#3b82f6">
                            <p style={{...T.body,color:"#2563eb"}}>{analysis.weatherNote}</p>
                          </ICard>

                          <ICard span={2} label="🔥 DISASTER SCENARIO" labelColor="#f97316">
                            <p style={{...T.body,color:"#b45309"}}>{analysis.scenario}</p>
                          </ICard>

                          <ICard span={2} label="⚠ NEGLIGENCE & SYSTEMIC FAILURES" labelColor="#ef4444">
                            <p style={{...T.body,color:"#b91c1c",marginBottom:10}}>{analysis.negligence}</p>
                            <div style={{borderTop:"1px solid #e2e8f0",paddingTop:12}}>
                              <div style={{fontSize:8,color:"#64748b",letterSpacing:2,marginBottom:8}}>DOCUMENTED PMC ISSUES</div>
                              {selected.neglect.map((n,i)=>(
                                <div key={i} style={{display:"flex",gap:10,marginBottom:6,alignItems:"flex-start"}}>
                                  <div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444",marginTop:5,flexShrink:0}}/>
                                  <span style={{fontSize:11,color:"#475569",lineHeight:1.65}}>{n}</span>
                                </div>
                              ))}
                            </div>
                          </ICard>

                          <ICard span={2} label="✓ IMMEDIATE ACTIONS" labelColor="#22c55e">
                            {analysis.actions?.map((a,i)=>(
                              <div key={i} style={{display:"flex",gap:12,marginBottom:9,alignItems:"flex-start"}}>
                                <div style={{width:24,height:24,borderRadius:"50%",background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#059669",fontWeight:800,flexShrink:0}}>{i+1}</div>
                                <span style={{fontSize:12,color:"#334155",lineHeight:1.7,paddingTop:3}}>{a}</span>
                              </div>
                            ))}
                          </ICard>

                          <ICard span={2} label="🚨 RESOURCE DEPLOYMENT">
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
                              {[{icon:"🪖",l:"Troops",k:"troops"},
                                {icon:"🚑",l:"Ambulances",k:"ambulances"},
                                {icon:"🚒",l:"Fire Engines",k:"fireEngines"},
                                {icon:"🔍",l:"Rescue Teams",k:"rescueTeams"},
                                {icon:"🚁",l:"Helicopters",k:"helicopters"},
                                {icon:"🩺",l:"Medical Staff",k:"medStaff"},
                                {icon:"⛺",l:"Shelter Beds",k:"shelterBeds"},
                                {icon:"🚰",l:"Water Trucks",k:"waterTrucks"},
                                {icon:"🚤",l:"Rescue Boats",k:"boats"},
                              ].map(({icon,l,k})=>{
                                const val = analysis.resources?.[k]||0;
                                const isZero = val===0;
                                return (
                                  <div key={k} style={{background:isZero?"#f8fafc":"#ffffff",borderRadius:9,padding:"12px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,border:`1px solid ${isZero?"#e2e8f0":"#cbd5e1"}`,opacity:isZero?0.5:1}}>
                                    <div style={{fontSize:26}}>{icon}</div>
                                    <div style={{fontSize:isZero?14:19,fontWeight:800,color:isZero?"#94a3b8":"#1e293b"}}>{val.toLocaleString()}</div>
                                    <div style={{fontSize:8,color:"#64748b",textAlign:"center"}}>{l}</div>
                                    {isZero&&<div style={{fontSize:7,color:"#94a3b8"}}>not needed</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{marginTop:12,padding:"9px 12px",background:"#f8fafc",borderRadius:7,fontSize:9,color:"#64748b",lineHeight:1.7,border:"1px solid #e2e8f0"}}>
                              🚤 Boats only deployed for river-adjacent zones with flood depth &gt;0.7m.<br/>
                              🚁 Helicopters for high-risk (≥65) or hill-exposed zones only.<br/>
                              ⛺ Shelter = 20% of lives-at-risk (realistic displacement rate).
                            </div>
                          </ICard>

                          <ICard span={2} label="◈ LONG-TERM POLICY" labelColor="#8b5cf6" dark>
                            <p style={{...T.body,color:"#6d28d9"}}>{analysis.longTerm}</p>
                          </ICard>

                          {selected.recentEvents?.length>0 && (
                            <ICard span={2} label={`📋 RECENT EVENTS — ${selected.name}`}>
                              {selected.recentEvents.map((e,i)=>(
                                <div key={i} style={{display:"flex",gap:10,marginBottom:6,alignItems:"flex-start"}}>
                                  <div style={{width:5,height:5,borderRadius:"50%",background:"#f97316",marginTop:5,flexShrink:0}}/>
                                  <span style={{fontSize:11,color:"#475569",lineHeight:1.65}}>{e}</span>
                                </div>
                              ))}
                            </ICard>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Info card helper ──────────────────────────────────────────────── */
function ICard({children,span,label,labelColor="#64748b",dark}) {
  return (
    <div style={{background:dark?"#f8fafc":"#ffffff",borderRadius:10,padding:"16px 18px",gridColumn:span?`span ${span}`:undefined,border:"1px solid #e2e8f0",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>
      <div style={{fontSize:9,color:labelColor,fontWeight:700,letterSpacing:2,marginBottom:10}}>{label}</div>
      {children}
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const S = {
  root:    {display:"flex",flexDirection:"column",height:"100vh",background:"#f8fafc",color:"#1e293b",fontFamily:"'JetBrains Mono','IBM Plex Mono',monospace",overflow:"hidden"},
  hdr:     {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",background:"#ffffff",borderBottom:"1px solid #e2e8f0",flexShrink:0},
  toolbar: {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 20px",background:"#ffffff",borderBottom:"1px solid #e2e8f0",flexShrink:0,gap:8,overflowX:"auto"},
  body:    {flex:1,overflow:"hidden",display:"flex",flexDirection:"column"},
  navBtn:  {background:"transparent",color:"#64748b",borderRadius:7,padding:"6px 15px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:1,whiteSpace:"nowrap",border:"1px solid #e2e8f0",outline:"none"},
  navOn:   {background:"#f1f5f9",color:"#3b82f6",borderColor:"#3b82f6"},
  fBtn:    {background:"transparent",color:"#64748b",borderRadius:5,padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit",letterSpacing:0.8,whiteSpace:"nowrap",border:"1px solid #e2e8f0",outline:"none"},
  fBtnOn:  {background:"#f1f5f9",color:"#334155",borderColor:"#94a3b8"},
  srch:    {background:"#ffffff",color:"#1e293b",borderRadius:7,padding:"7px 14px",fontSize:10,fontFamily:"inherit",border:"1px solid #e2e8f0",outline:"none",minWidth:155,flexShrink:0},
};
const T = {
  body: {fontSize:12,color:"#475569",lineHeight:1.8,margin:0},
};
const ANIM = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.28} }
  @keyframes rp    { 0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.55);opacity:0} }
  .stip .leaflet-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:#f1f5f9}
  ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
`;