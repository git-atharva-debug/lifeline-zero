import { useState, useEffect, useRef } from "react";

// ── SYSTEM PROMPTS ─────────────────────────────────────────────────────────────
const FORECAST_PROMPT = `You are AEGIS — a pre-disaster severity forecasting system. Output ONLY strict JSON, no markdown, no backticks.

JSON SCHEMA:
{
  "headline": "String",
  "disaster_type": "String",
  "predicted_severity": "Number 1-10",
  "severity_label": "String — Minor / Moderate / Serious / Severe / Catastrophic",
  "confidence_pct": "Number 1-100",
  "peak_window": "String",
  "affected_radius_km": "Number",
  "population_at_risk": "String",
  "what_to_expect": { "next_6hrs": "String", "next_24hrs": "String", "next_72hrs": "String" },
  "severity_drivers": [
    { "factor": "String — Historical Risk / Weather Intensity / Population Density / Infrastructure Vulnerability", "score": "Number 1-10", "explanation": "String" }
  ],
  "should_i_evacuate": { "answer": "YES / MAYBE / NO", "reasoning": "String", "if_yes_go_to": "String" },
  "right_now_checklist": [{ "urgency": "DO THIS NOW / Do this soon / Good to do", "task": "String", "why": "String" }],
  "danger_myths": [{ "myth": "String", "reality": "String" }],
  "historical_parallel": { "event": "String", "similarity": "String", "outcome": "String" },
  "vulnerable_groups_alert": ["String"],
  "reassurance": "String"
}
RULES: right_now_checklist = exactly 6 items. severity_drivers = exactly 4 items. danger_myths = exactly 3 items. Write for a scared 14-year-old on a phone.`;

const PREPAREDNESS_PROMPT = `You are AEGIS Preparedness Analyst. Output ONLY strict JSON, no markdown.

JSON SCHEMA:
{
  "overall_score": "Number 0-100",
  "risk_level": "Critical / High / Moderate / Low",
  "risk_badge": "String",
  "survival_probability": "Number 0-100",
  "context_alert": "String or null",
  "breakdown": {
    "kit":      { "label": "Emergency Kit",       "score": "Number 0-100", "weight": "30%" },
    "evac":     { "label": "Evacuation Planning", "score": "Number 0-100", "weight": "25%" },
    "family":   { "label": "Family Plan",         "score": "Number 0-100", "weight": "20%" },
    "contacts": { "label": "Emergency Contacts",  "score": "Number 0-100", "weight": "15%" },
    "drills":   { "label": "Drills & Practice",   "score": "Number 0-100", "weight": "10%" }
  },
  "warnings": ["String"],
  "strengths": ["String"],
  "top_priority": "String",
  "reassurance": "String"
}`;

// ── API HELPERS ────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, payload) {
  const key = process.env.REACT_APP_GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 3000,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("Groq error:", e);
    return null;
  }
}

async function callGrok(systemPrompt, payload) {
  const key = process.env.REACT_APP_GROK_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "grok-3",
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("Grok error:", e);
    return null;
  }
}

async function callAI(systemPrompt, payload) {
  const groq = await callGroq(systemPrompt, payload);
  if (groq) return { data: groq, engine: "groq" };
  const grok = await callGrok(systemPrompt, payload);
  if (grok) return { data: grok, engine: "grok" };
  return null;
}

function getWeatherCondition(code) {
  const map = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
    77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
    82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return map[code] || "Unknown";
}

async function fetchWeather(lat, lon) {
  try {
    // Fetch weather dynamically
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
    );

    if (!weatherRes.ok) {
      throw new Error("Weather API error");
    }

    const weather = await weatherRes.json();

    // Fetch location name dynamically
    const locationRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );

    if (!locationRes.ok) {
      throw new Error("Location API error");
    }

    const location = await locationRes.json();

    return {
      location: {
        name:
          location.address?.city ||
          location.address?.town ||
          location.address?.village ||
          location.address?.municipality ||
          "",
        region:
          location.address?.state ||
          location.address?.county ||
          location.address?.country ||
          "",
        lat,
        lon
      },

      current: {
        temp_c: weather.current.temperature_2m,
        humidity: weather.current.relative_humidity_2m,
        feelslike_c: weather.current.apparent_temperature,
        wind_kph: weather.current.wind_speed_10m,
        precipitation_mm: weather.current.precipitation,

        condition: {
          text: getWeatherCondition(weather.current.weather_code)
        }
      }
    };

  } catch (e) {
    console.error("Weather error:", e);
    return null;
  }
}

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
function buildMockForecast(inputs) {
  const t = (inputs.disasterType || "").toLowerCase();
  const isCyclone = t.includes("cyclone") || t.includes("hurricane");
  const isFlood = t.includes("flood");
  const wind = Number(inputs.windSpeed) || 0;
  const rain = Number(inputs.rainfall) || 0;
  const highPop = inputs.populationDensity === "high";
  const isCoastal = inputs.coastalProximity === "yes";
  const isOld = inputs.infrastructureAge === "old";
  const isFloodZone = inputs.floodZone === "yes";

  let sev = 5;
  if (isCyclone) sev = wind > 150 ? 9 : wind > 100 ? 7 : 5;
  else if (isFlood) sev = rain > 200 ? 8 : rain > 100 ? 6 : 4;
  if (highPop) sev = Math.min(10, sev + 1);
  if (isCoastal) sev = Math.min(10, sev + 1);
  if (isOld) sev = Math.min(10, sev + 1);
  if (isFloodZone) sev = Math.min(10, sev + 1);

  const labels = ["", "Minor", "Minor", "Moderate", "Moderate", "Serious", "Serious", "Severe", "Severe", "Catastrophic", "Catastrophic"];
  const evacAnswer = sev >= 7 ? "YES" : sev >= 5 ? "MAYBE" : "NO";

  return {
    headline: isCyclone
      ? `A powerful cyclone is approaching ${inputs.region} — conditions will become life-threatening within hours.`
      : isFlood
        ? `Severe flooding expected in ${inputs.region} — low-lying areas face serious inundation risk.`
        : `A ${inputs.disasterType} is threatening ${inputs.region} with significant potential for harm.`,
    disaster_type: inputs.disasterType,
    predicted_severity: sev,
    severity_label: labels[sev],
    confidence_pct: 72,
    peak_window: isCyclone ? "Next 6–18 hours" : isFlood ? "Next 12–36 hours" : "Next 24–48 hours",
    affected_radius_km: isCyclone ? Math.round(wind * 0.7) || 120 : isFlood ? 60 : 40,
    population_at_risk: highPop ? "3.1 million people" : "750,000 people",
    what_to_expect: {
      next_6hrs: "Conditions will begin deteriorating. This is your window to act.",
      next_24hrs: "The event will reach peak intensity. Remain indoors and follow official guidance.",
      next_72hrs: "Immediate danger will ease but secondary risks remain — contaminated water, damaged roads.",
    },
    severity_drivers: [
      { factor: "Historical Risk", score: 6, explanation: "This region has moderate historical exposure to this disaster type." },
      { factor: "Weather Intensity", score: isCyclone && wind > 100 ? 8 : rain > 150 ? 7 : 5, explanation: "Current weather measurements indicate a significant event in progress." },
      { factor: "Population Density", score: highPop ? 8 : 5, explanation: highPop ? "Dense population increases evacuation complexity." : "Manageable population in the impact zone." },
      { factor: "Infrastructure Vulnerability", score: isOld ? 7 : isFloodZone ? 6 : 4, explanation: isOld ? "Older buildings may not withstand severe conditions." : "Infrastructure is reasonably resilient." },
    ],
    should_i_evacuate: {
      answer: evacAnswer,
      reasoning:
        evacAnswer === "YES"
          ? "The severity forecast indicates staying in place is not safe. Leaving now while roads are passable is the safest decision."
          : evacAnswer === "MAYBE"
            ? "Depends on your location. Ground floors and riverside areas should evacuate. Upper floors of strong buildings may shelter in place."
            : "Sheltering in place is appropriate in a strong building. Stay indoors and follow official updates.",
      if_yes_go_to: "The nearest government relief shelter or a relative's home on higher ground",
    },
    right_now_checklist: [
      { urgency: "DO THIS NOW", task: "Decide whether to evacuate and act immediately", why: "Every hour you wait, roads become more dangerous." },
      { urgency: "DO THIS NOW", task: "Fill every container with clean drinking water", why: "Water may be contaminated or cut off for days." },
      { urgency: "DO THIS NOW", task: "Charge all phones and power banks fully", why: "Your phone is your lifeline for emergency alerts." },
      { urgency: "Do this soon", task: "Gather ID, medicine, and documents in a waterproof bag", why: "These are hard to replace and may be needed immediately after." },
      { urgency: "Do this soon", task: "Tell someone outside the area your location and plan", why: "If communication fails, someone needs to know where you are." },
      { urgency: "Good to do", task: "Switch off electrical mains before you leave", why: "Reduces risk of electrical fires and surge damage." },
    ],
    danger_myths: [
      { myth: "\"I'll wait to see how bad it gets before deciding.\"", reality: "By the time it's visibly dangerous, evacuation routes are often already blocked." },
      { myth: "\"My house survived past storms, so it will be fine.\"", reality: "Each disaster is different. Past survival does not guarantee future safety." },
      { myth: "\"Authorities always exaggerate warnings.\"", reality: "Warnings are based on scientific data. Underreaction kills far more than overreaction." },
    ],
    historical_parallel: {
      event: isCyclone ? "Cyclone Amphan (2020)" : isFlood ? "2013 Uttarakhand Floods" : "Cyclone Fani (2019)",
      similarity: "Comparable intensity and geographic conditions to the current forecast.",
      outcome: isCyclone
        ? "Killed 100+ people — but mass evacuation of 3M saved tens of thousands."
        : "Caused widespread destruction with thousands of casualties in unprepared areas.",
    },
    vulnerable_groups_alert: [
      "Elderly people living alone — need physical help evacuating",
      "People with disabilities who cannot evacuate quickly",
      "Infants and young children — dehydrate and overheat faster than adults",
      "People in ground floors or basements in flood-prone areas",
    ],
    reassurance: "You have time right now to make decisions that will keep your family safe — use it.",
  };
}

function buildMockPreparedness(inputs, disasterCtx) {
  const kitCount = inputs.kitItems.filter(Boolean).length;
  const kitScore = Math.round((kitCount / 7) * 100);
  const evacScore = inputs.evacRouteSaved ? 100 : 0;
  const familyScore = inputs.familyPlanDone ? 100 : 0;
  const contactsScore = Math.min(100, Math.round((inputs.contactsCount / 5) * 100));
  const drillScore = Math.min(100, Math.round((inputs.drillCount / 3) * 100));
  const overall = Math.round(
    kitScore * 0.3 + evacScore * 0.25 + familyScore * 0.2 + contactsScore * 0.15 + drillScore * 0.1
  );
  const riskLevel = overall >= 75 ? "Low" : overall >= 50 ? "Moderate" : overall >= 30 ? "High" : "Critical";
  const riskBadge =
    overall >= 75 ? "WELL PREPARED" : overall >= 50 ? "PARTIALLY READY" : overall >= 30 ? "HIGH RISK" : "CRITICALLY UNPREPARED";
  const sevPenalty = disasterCtx ? -5 * Math.max(0, disasterCtx.predicted_severity - 5) : 0;
  const survival = Math.min(98, Math.max(30, overall + sevPenalty));

  const warnings = [];
  if (kitScore < 50) warnings.push("Your emergency kit is critically incomplete — water, food, and first aid are essential.");
  if (!inputs.evacRouteSaved) warnings.push("No confirmed evacuation route. Identify at least 2 exit routes today.");
  if (!inputs.familyPlanDone) warnings.push("No family emergency plan in place — define a meeting point today.");
  if (inputs.contactsCount < 3) warnings.push("Store at least 3 emergency contacts on paper — phones fail during disasters.");

  const contextAlert =
    disasterCtx && disasterCtx.predicted_severity >= 6 && overall < 60
      ? `With a ${disasterCtx.severity_label} ${disasterCtx.disaster_type} at severity ${disasterCtx.predicted_severity}/10 approaching, your preparedness level is dangerously low. ${kitScore < 50 ? "Your kit gaps are especially critical." : "Prioritize your evacuation plan immediately."}`
      : null;

  return {
    overall_score: overall,
    risk_level: riskLevel,
    risk_badge: riskBadge,
    survival_probability: survival,
    context_alert: contextAlert,
    breakdown: {
      kit: { label: "Emergency Kit", score: kitScore, weight: "30%" },
      evac: { label: "Evacuation Planning", score: evacScore, weight: "25%" },
      family: { label: "Family Plan", score: familyScore, weight: "20%" },
      contacts: { label: "Emergency Contacts", score: contactsScore, weight: "15%" },
      drills: { label: "Drills & Practice", score: drillScore, weight: "10%" },
    },
    warnings: warnings.slice(0, 4),
    strengths: [
      ...(kitScore >= 80 ? ["Strong emergency kit — you're physically ready to shelter or move"] : []),
      ...(inputs.evacRouteSaved && inputs.familyPlanDone ? ["Excellent planning — routes and family coordination in place"] : []),
    ].slice(0, 2),
    top_priority: !inputs.evacRouteSaved
      ? "Map and memorize 2 evacuation routes from your home and share them with your family today."
      : kitScore < 50
        ? "Build your emergency kit — water (3L/person/day for 72 hrs), food, first aid, and flashlight are the bare minimum."
        : "Complete your family emergency plan and define a meeting point everyone knows.",
    reassurance: "Every step you take today makes you dramatically safer tomorrow.",
  };
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
const DISASTER_TYPES = ["Cyclone", "Flood", "Flash Flood", "Earthquake", "Landslide", "Heatwave", "Wildfire", "Tsunami", "Storm Surge", "Hazmat Leak"];
const D_ICONS = {
  Cyclone: "🌀", Flood: "🌊", "Flash Flood": "💧", Earthquake: "🪨",
  Landslide: "⛰️", Heatwave: "🌡️", Wildfire: "🔥", Tsunami: "🌊",
  "Storm Surge": "🌊", "Hazmat Leak": "☢️",
};
const FORECAST_MSGS = [
  "🛰  Pulling live weather data...",
  "📚  Cross-referencing historical records...",
  "🏘  Analysing population density...",
  "🤖  Running AI severity model...",
  "🧮  Computing probability vectors...",
  "📋  Building your preparedness guide...",
];
const PREP_MSGS = [
  "🤖  Sending your data to AI...",
  "📊  Scoring your kit & plans...",
  "⚠️  Identifying critical gaps...",
  "🎯  Generating personalized advice...",
];
const KIT_ITEMS = [
  { id: "water", label: "72-hour water supply (3L/person/day)", icon: "💧" },
  { id: "food", label: "Non-perishable food for 3 days", icon: "🥫" },
  { id: "aid", label: "First aid kit + prescription meds", icon: "🩺" },
  { id: "torch", label: "Flashlight / hand-crank torch", icon: "🔦" },
  { id: "docs", label: "ID, insurance & medical copies", icon: "📄" },
  { id: "cash", label: "Emergency cash (ATMs may be offline)", icon: "💵" },
  { id: "warmth", label: "Blankets / emergency thermal gear", icon: "🧥" },
];

// ── COLOR HELPERS ──────────────────────────────────────────────────────────────
function getSevColors(score) {
  if (score >= 9) return { color: "#ef233c", bg: "rgba(239,35,60,0.05)", ring: "rgba(239,35,60,0.3)" };
  if (score >= 7) return { color: "#ff6b2b", bg: "rgba(255,107,43,0.05)", ring: "rgba(255,107,43,0.25)" };
  if (score >= 5) return { color: "#f4a011", bg: "rgba(244,160,17,0.05)", ring: "rgba(244,160,17,0.25)" };
  if (score >= 3) return { color: "#4ade80", bg: "rgba(74,222,128,0.05)", ring: "rgba(74,222,128,0.2)" };
  return { color: "#60a5fa", bg: "rgba(96,165,250,0.05)", ring: "rgba(96,165,250,0.2)" };
}

function getRiskColors(level) {
  const map = {
    Critical: { color: "#ef233c", bg: "rgba(239,35,60,0.05)", border: "rgba(239,35,60,0.2)", ring: "rgba(239,35,60,0.25)" },
    High: { color: "#ff6b2b", bg: "rgba(255,107,43,0.05)", border: "rgba(255,107,43,0.2)", ring: "rgba(255,107,43,0.25)" },
    Moderate: { color: "#f4a011", bg: "rgba(244,160,17,0.05)", border: "rgba(244,160,17,0.2)", ring: "rgba(244,160,17,0.25)" },
    Low: { color: "#4ade80", bg: "rgba(74,222,128,0.04)", border: "rgba(74,222,128,0.15)", ring: "rgba(74,222,128,0.2)" },
  };
  return map[level] || map.Critical;
}

function getEvacColors(answer) {
  if (answer === "YES") return { color: "#ef233c", bg: "rgba(239,35,60,0.05)", border: "rgba(239,35,60,0.2)" };
  if (answer === "MAYBE") return { color: "#f4a011", bg: "rgba(244,160,17,0.04)", border: "rgba(244,160,17,0.2)" };
  return { color: "#4ade80", bg: "rgba(74,222,128,0.03)", border: "rgba(74,222,128,0.15)" };
}

// ── SMALL UI COMPONENTS ────────────────────────────────────────────────────────
function UrgencyDot({ urgency }) {
  const c = urgency === "DO THIS NOW" ? "#ef233c" : urgency === "Do this soon" ? "#f4a011" : "#60a5fa";
  return (
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}`, flexShrink: 0, marginTop: 7 }} />
  );
}

function FactorBar({ score, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(score * 10), 150); }, [score]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      <div style={{ flex: 1, height: 5, background: "rgba(0,0,0,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 99, transition: "width 1.2s cubic-bezier(0.34,1.2,0.64,1)", boxShadow: `0 0 6px ${color}88` }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color, minWidth: 18, textAlign: "right", fontFamily: "monospace" }}>{score}</span>
    </div>
  );
}

function AnimBar({ value, color, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), delay + 80);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ height: 5, background: "rgba(0,0,0,0.05)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 99, transition: `width 0.9s cubic-bezier(.4,0,.2,1) ${delay}ms`, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

function AnimNum({ target, duration = 1200, suffix = "" }) {
  const [n, setN] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return <>{n}{suffix}</>;
}

function ScoreRing({ score, color, ring }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const [fill, setFill] = useState(0);
  useEffect(() => { setTimeout(() => setFill((score / 100) * circ), 120); }, [score, circ]);
  return (
    <svg width="176" height="176" viewBox="0 0 176 176" style={{ overflow: "visible" }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={88 + (r + 10) * Math.cos(a)} y1={88 + (r + 10) * Math.sin(a)}
            x2={88 + (r + 15) * Math.cos(a)} y2={88 + (r + 15) * Math.sin(a)}
            stroke="rgba(0,0,0,0.07)" strokeWidth="1.5"
          />
        );
      })}
      <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="11" />
      <circle
        cx="88" cy="88" r={r} fill="none" stroke={color} strokeWidth="11"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 88 88)"
        style={{ filter: `drop-shadow(0 0 10px ${ring})`, transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
      />
      {score > 3 && (
        <circle
          cx={88 + r * Math.cos((score / 100) * Math.PI * 2 - Math.PI / 2)}
          cy={88 + r * Math.sin((score / 100) * Math.PI * 2 - Math.PI / 2)}
          r="6" fill={color}
          style={{ filter: `drop-shadow(0 0 7px ${color})` }}
        />
      )}
    </svg>
  );
}

function EngineBadge({ engine }) {
  const cfg = {
    groq: { label: "⚡ GROQ AI", color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)" },
    grok: { label: "⚡ GROK-3", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)" },
    mock: { label: "🔄 SIMULATION", color: "#f4a011", bg: "rgba(244,160,17,0.08)", border: "rgba(244,160,17,0.25)" },
  }[engine] || { label: "🔄 SIMULATION", color: "#f4a011", bg: "rgba(244,160,17,0.08)", border: "rgba(244,160,17,0.25)" };
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: "2px 9px", fontSize: "0.58rem", color: cfg.color, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em" }}>
      {cfg.label}
    </div>
  );
}

function WeatherBadge({ label, value, icon }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "0.5rem 0.7rem", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
      <div style={{ fontSize: "0.55rem", color: "#2563eb", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{icon} {label}</div>
      <div style={{ fontSize: "0.85rem", color: "#1e293b", fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function LoadingScreen({ msgs, msgIndex, subtitle }) {
  return (
    <div style={{ minHeight: "88vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem", background: "#ffffff" }}>
      <div style={{ position: "relative", width: 88, height: 88 }}>
        <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(59,130,246,0.22)", animation: "pulseRing 2.2s ease infinite" }} />
        <div style={{ position: "absolute", inset: -22, borderRadius: "50%", border: "1px solid rgba(59,130,246,0.1)", animation: "pulseRing 2.2s ease infinite", animationDelay: "0.5s" }} />
        <svg width="88" height="88" style={{ position: "absolute", animation: "spin 1.1s linear infinite" }}>
          <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(59,130,246,0.07)" strokeWidth="3" />
          <circle cx="44" cy="44" r="38" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeDasharray="52 200" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>🛡️</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontSize: "1.05rem", marginBottom: 7, color: "#1e293b" }}>{subtitle}</div>
        <div style={{ fontFamily: "monospace", fontSize: "0.73rem", color: "#3b82f6", minHeight: 20 }}>{msgs[msgIndex]}</div>
      </div>
    </div>
  );
}

// ── CSS STRING ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Sora:wght@700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#ffffff;}
  .root{font-family:'DM Sans',sans-serif;color:#1e293b;background:#ffffff;min-height:100vh;padding-bottom:6rem;}
  .bg-grid{position:fixed;inset:0;background-image:radial-gradient(rgba(59,130,246,0.03) 1px,transparent 1px);background-size:28px 28px;pointer-events:none;z-index:0;}
  .z1{position:relative;z-index:1;}
  .topbar{background:rgba(255,255,255,0.95);backdrop-filter:blur(18px);border-bottom:1px solid rgba(0,0,0,0.06);padding:1.1rem 1.5rem;display:flex;align-items:center;gap:1rem;position:sticky;top:0;z-index:100;box-shadow:0 4px 20px rgba(0,0,0,0.02);}
  .brand-icon{width:36px;height:36px;background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;border:1px solid rgba(37,99,235,0.2);flex-shrink:0;box-shadow:0 0 18px rgba(37,99,235,0.15);}
  .wrap{max-width:760px;margin:0 auto;padding:0 1rem;}
  .rw{max-width:760px;margin:0 auto;padding:0 1rem 2rem;opacity:0;transform:translateY(14px);transition:opacity 0.5s ease,transform 0.5s ease;}
  .rw.visible{opacity:1;transform:none;}
  .section-header{font-family:'DM Sans',sans-serif;font-size:1.2rem;font-weight:700;color:#0f172a;margin:1.8rem 0 1rem;display:flex;align-items:center;gap:8px;border-bottom:2px solid #3b82f6;padding-bottom:0.4rem;}
  .card{background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 4px 20px rgba(0,0,0,0.02);}
  label{display:block;font-size:0.7rem;color:#475569;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;}
  input,select,textarea{width:100%;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:0.65rem 1rem;color:#1e293b;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;transition:all 0.2s;}
  input:focus,select:focus,textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
  select option{background:#ffffff;}
  textarea{resize:vertical;line-height:1.65;}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.65rem;}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:0.65rem;}
  .segmented{display:flex;border:1px solid rgba(0,0,0,0.08);border-radius:10px;overflow:hidden;background:#ffffff;}
  .seg-btn{flex:1;padding:0.6rem 0.3rem;border:none;background:transparent;color:#64748b;cursor:pointer;font-size:0.8rem;font-weight:600;transition:all 0.2s;font-family:'DM Sans',sans-serif;}
  .seg-btn:hover{background:rgba(59,130,246,0.05);color:#2563eb;}
  .seg-btn.active{background:rgba(59,130,246,0.08);color:#2563eb;font-weight:700;}
  .type-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0.5rem;}
  .type-btn{padding:0.6rem 0.2rem;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:#ffffff;color:#64748b;cursor:pointer;font-size:0.75rem;text-align:center;transition:all 0.2s;font-family:'DM Sans',sans-serif;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,0.02);}
  .type-btn:hover{border-color:#3b82f6;color:#2563eb;transform:translateY(-1px);box-shadow:0 4px 12px rgba(59,130,246,0.1);}
  .type-btn.active{border-color:#3b82f6;background:rgba(59,130,246,0.04);color:#2563eb;font-weight:700;}
  .detect-btn{width:100%;padding:0.9rem;background:linear-gradient(135deg,rgba(16,185,129,0.04),rgba(59,130,246,0.04));border:1px solid rgba(16,185,129,0.2);border-radius:12px;color:#059669;font-family:'Sora',sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:10px;background:#ffffff;}
  .detect-btn:hover{background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08));transform:translateY(-1px);box-shadow:0 8px 22px rgba(16,185,129,0.1);border-color:#10b981;}
  .go-btn{width:100%;margin-top:1.4rem;padding:1rem;background:linear-gradient(135deg,#1e40af,#2563eb,#3b82f6);border:none;border-radius:14px;color:#fff;font-family:'Sora',sans-serif;font-size:1rem;font-weight:800;cursor:pointer;transition:all 0.2s;box-shadow:0 8px 26px rgba(37,99,235,0.15);}
  .go-btn:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(37,99,235,0.25);}
  .go-btn:disabled{background:#e2e8f0;color:#94a3b8;box-shadow:none;cursor:not-allowed;transform:none;}
  .status-bar{border-radius:10px;padding:0.7rem 1rem;font-size:0.8rem;margin-top:0.65rem;font-family:monospace;}
  .status-info{background:rgba(59,130,246,0.04);border:1px solid rgba(59,130,246,0.15);color:#2563eb;}
  .status-success{background:rgba(74,222,128,0.04);border:1px solid rgba(74,222,128,0.15);color:#059669;}
  .status-error{background:rgba(239,35,60,0.04);border:1px solid rgba(239,35,60,0.15);color:#dc2626;}
  .weather-live{background:rgba(16,185,129,0.02);border:1px solid rgba(16,185,129,0.1);border-radius:14px;padding:1rem;margin-top:0.65rem;background:#ffffff;}
  .mode-tabs{display:flex;gap:4px;background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;padding:4px;}
  .mode-btn{padding:0.5rem 1rem;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:600;transition:all 0.2s;background:transparent;color:#64748b;}
  .mode-btn:hover{background:rgba(59,130,246,0.05);color:#2563eb;}
  .mode-btn.active{background:rgba(59,130,246,0.08);color:#2563eb;border:1px solid rgba(59,130,246,0.2);}
  .collapsible-header{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:0.8rem 0;border-bottom:1px solid rgba(0,0,0,0.04);user-select:none;}
  .collapsible-header:hover{color:#2563eb;}
  .collapsible-header:last-of-type{border-bottom:none;}
  .caret{font-size:0.6rem;transition:transform 0.2s;display:inline-block;}
  .caret.open{transform:rotate(180deg);}
  .tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:6px;}
  .tl-line{width:2px;background:rgba(0,0,0,0.04);margin:0 4px;flex-shrink:0;}
  .kit-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;cursor:pointer;margin-bottom:10px;transition:all 0.2s;width:100%;background:#ffffff;border:1px solid transparent;}
  .kit-item:hover{transform:translateX(4px);border-color:rgba(59,130,246,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.02);}
  .kit-item.checked{border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.02);}
  .kit-item.unchecked{border:1px solid rgba(0,0,0,0.06);background:#ffffff;}
  .checkbox{width:22px;height:22px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .checkbox.checked{background:#3b82f6;border:2px solid #3b82f6;box-shadow:0 0 12px rgba(59,130,246,0.3);}
  .checkbox.unchecked{background:transparent;border:2px solid rgba(59,130,246,0.3);}
  .toggle{width:54px;height:28px;border-radius:14px;position:relative;cursor:pointer;transition:all 0.22s;flex-shrink:0;background:#ffffff;}
  .toggle.on{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);box-shadow:0 0 12px rgba(59,130,246,0.15);}
  .toggle.off{background:#ffffff;border:1px solid rgba(0,0,0,0.1);}
  .toggle-dot{position:absolute;top:4px;width:18px;height:18px;border-radius:50%;transition:left 0.22s cubic-bezier(.4,0,.2,1);}
  .toggle-dot.on{left:30px;background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,0.4);}
  .toggle-dot.off{left:4px;background:#94a3b8;}
  .counter-btn{width:38px;height:38px;border-radius:10px;background:#ffffff;border:1px solid rgba(59,130,246,0.2);color:#2563eb;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .counter-btn:hover{background:rgba(59,130,246,0.05);transform:scale(1.05);border-color:#3b82f6;}
  .prep-tabs{display:flex;gap:0;border-bottom:1px solid rgba(0,0,0,0.06);margin-bottom:1rem;}
  .prep-tab-btn{flex:1;padding:0.7rem 0.5rem;border:none;background:transparent;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:600;transition:all 0.2s;text-align:center;color:#64748b;}
  .prep-tab-btn:hover{color:#2563eb;background:rgba(59,130,246,0.02);}
  .prep-tab-btn.active{color:#2563eb;border-bottom:2px solid #3b82f6;}
  .api-tip{background:rgba(59,130,246,0.02);border:1px solid rgba(59,130,246,0.1);border-radius:12px;padding:0.9rem 1.1rem;margin-bottom:1.2rem;font-size:0.85rem;color:#2563eb;line-height:1.65;}
  .api-tip code{background:rgba(59,130,246,0.05);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:0.7rem;}
  .score-ring-wrap{width:176px;height:176px;position:relative;display:inline-block;}
  .score-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulseRing{0%,100%{opacity:0.3;transform:scale(1);}50%{opacity:0.6;transform:scale(1.04);}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
  .fade-up{animation:fadeUp 0.22s ease;}
  @media(max-width:560px){.g2,.g3,.g4,.type-grid{grid-template-columns:1fr 1fr;}}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AegisComplete() {
  const [mode, setMode] = useState("forecast");

  // Forecast state
  const [fStep, setFStep] = useState("input");
  const [fResult, setFResult] = useState(null);
  const [fEngine, setFEngine] = useState("mock");
  const [fMsgIdx, setFMsgIdx] = useState(0);
  const [fReportId, setFReportId] = useState("");
  const [fAnimIn, setFAnimIn] = useState(false);
  const [fOpen, setFOpen] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [wStatus, setWStatus] = useState({ type: "", msg: "" });
  const [fInputs, setFInputs] = useState({
    disasterType: "Cyclone", region: "", alertText: "",
    windSpeed: "", rainfall: "", temperature: "", humidity: "", weatherCondition: "",
    populationDensity: "medium", coastalProximity: "no",
    infrastructureAge: "mixed", floodZone: "no", historicalFrequency: "medium",
  });
  const setF = (k, v) => setFInputs(p => ({ ...p, [k]: v }));

  // Prep state
  const [pStep, setPStep] = useState("input");
  const [pResult, setPResult] = useState(null);
  const [pEngine, setPEngine] = useState("mock");
  const [pMsgIdx, setPMsgIdx] = useState(0);
  const [pAnimIn, setPAnimIn] = useState(false);
  const [pTab, setPTab] = useState("kit");
  const [kitItems, setKitItems] = useState({});
  const [evacRoute, setEvacRoute] = useState(false);
  const [familyPlan, setFamilyPlan] = useState(false);
  const [contacts, setContacts] = useState(0);
  const [drills, setDrills] = useState(0);
  const kitChecked = KIT_ITEMS.filter(i => kitItems[i.id]).length;

  // Weather detection
  const detectWeather = () => {
    setWStatus({ type: "info", msg: "📡 Requesting location access..." });
    if (!navigator.geolocation) {
      setWStatus({ type: "error", msg: "❌ Geolocation not supported." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setWStatus({ type: "info", msg: "🛰️ Fetching live weather..." });
        const d = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        if (!d) {
          setWStatus({ type: "error", msg: "❌ Weather API failed. Add REACT_APP_WEATHER_API_KEY or enter manually." });
          return;
        }
        const loc = `${d.location.name}, ${d.location.region}`;
        setWeatherData(d);
        setFInputs(p => ({
          ...p,
          region: p.region || loc,
          windSpeed: Math.round(d.current.wind_kph).toString(),
          rainfall: Math.round(d.current.precipitation_mm || 0).toString(),
          temperature: Math.round(d.current.temp_c).toString(),
          humidity: d.current.humidity.toString(),
          weatherCondition: d.current.condition.text,
        }));
        setWStatus({ type: "success", msg: `✅ Live data loaded — ${loc} · ${d.current.condition.text}` });
      },
      () => setWStatus({ type: "error", msg: "❌ Location denied. Enter data manually." })
    );
  };

  // Run forecast
  const runForecast = async () => {
    if (!fInputs.region) return;
    setFStep("loading");
    setFMsgIdx(0);
    setFReportId(`AEGIS-${Date.now().toString(36).toUpperCase()}`);
    await new Promise(r => setTimeout(r, 3200));
    const payload = {
      ...fInputs,
      weatherData: weatherData
        ? { condition: weatherData.current.condition.text, temp_c: weatherData.current.temp_c, humidity: weatherData.current.humidity, wind_kph: weatherData.current.wind_kph }
        : null,
    };
    const res = await callAI(FORECAST_PROMPT, payload);
    if (res) { setFResult(res.data); setFEngine(res.engine); }
    else { setFResult(buildMockForecast(fInputs)); setFEngine("mock"); }
    setFStep("result");
  };

  // Run preparedness
  const runPrep = async () => {
    setPStep("loading");
    setPMsgIdx(0);
    await new Promise(r => setTimeout(r, 2400));
    const kitArr = KIT_ITEMS.map(i => !!kitItems[i.id]);
    const payload = {
      kitItems: kitArr,
      kitLabels: KIT_ITEMS.map((item, i) => ({ item: item.label, checked: kitArr[i] })),
      evacRouteSaved: evacRoute,
      familyPlanDone: familyPlan,
      contactsCount: contacts,
      drillCount: drills,
      disasterContext: fResult
        ? { disaster_type: fResult.disaster_type, predicted_severity: fResult.predicted_severity, severity_label: fResult.severity_label, region: fInputs.region, peak_window: fResult.peak_window, should_evacuate: fResult.should_i_evacuate?.answer }
        : null,
    };
    const res = await callAI(PREPAREDNESS_PROMPT, payload);
    if (res) { setPResult(res.data); setPEngine(res.engine); }
    else {
      setPResult(buildMockPreparedness(
        { kitItems: kitArr, evacRouteSaved: evacRoute, familyPlanDone: familyPlan, contactsCount: contacts, drillCount: drills },
        fResult
      ));
      setPEngine("mock");
    }
    setPStep("result");
  };

  // Loading message cycling
  useEffect(() => {
    let iv;
    if (fStep === "loading") iv = setInterval(() => setFMsgIdx(p => (p + 1) % FORECAST_MSGS.length), 950);
    return () => clearInterval(iv);
  }, [fStep]);

  useEffect(() => {
    let iv;
    if (pStep === "loading") iv = setInterval(() => setPMsgIdx(p => (p + 1) % PREP_MSGS.length), 750);
    return () => clearInterval(iv);
  }, [pStep]);

  useEffect(() => {
    if (fStep === "result") setTimeout(() => setFAnimIn(true), 80);
    else setFAnimIn(false);
  }, [fStep]);

  useEffect(() => {
    if (pStep === "result") setTimeout(() => setPAnimIn(true), 80);
    else setPAnimIn(false);
  }, [pStep]);

  const resetForecast = () => { setFStep("input"); setFResult(null); setFAnimIn(false); setFOpen(null); };
  const resetPrep = () => { setPStep("input"); setPResult(null); setPAnimIn(false); setPTab("kit"); };
  const hasAI = !!(process.env.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROK_API_KEY);

  // ── Topbar ──────────────────────────────────────────────────────────────────
  function Topbar({ showBack, onBack, engine, reportId }) {
    return (
      <div className="topbar">
        <div className="brand-icon">🛡️</div>
        <div>
          <div style={{
            fontFamily: "Sora, sans-serif",
            fontSize: "1.4rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            AEGIS System
          </div>
          <div style={{ fontSize: "0.6rem", color: "#64748b", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {reportId ? `${reportId} · ${new Date().toLocaleTimeString()}` : "Pre-disaster Intelligence · AI-powered"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div className="mode-tabs">
            <button className={`mode-btn ${mode === "forecast" ? "active" : "inactive"}`} onClick={() => setMode("forecast")}>🌀 Forecast</button>
            <button className={`mode-btn ${mode === "prep" ? "active" : "inactive"}`} onClick={() => setMode("prep")}>
              🛡 Prep Score
              {fResult && <span style={{ marginLeft: 5, fontSize: "0.55rem", color: "#059669", fontFamily: "monospace" }}>LINKED</span>}
            </button>
          </div>
          {engine && <EngineBadge engine={engine} />}
          {showBack && (
            <button onClick={onBack} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "0.4rem 0.8rem", color: "#64748b", cursor: "pointer", fontSize: "0.75rem", transition: "all 0.2s" }}>
              ← New
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── FORECAST INPUT ──────────────────────────────────────────────────────────
  if (mode === "forecast" && fStep === "input") return (
    <div className="root"><style>{CSS}</style>
      <div className="bg-grid" />
      <div className="z1">
        <Topbar engine={null} />
        <div className="wrap" style={{ paddingTop: "1.8rem" }}>
          {!hasAI && (
            <div className="api-tip">
              <strong>⚡ Optional:</strong> Add <code>REACT_APP_GROQ_API_KEY</code>, <code>REACT_APP_WEATHER_API_KEY</code> to your .env for live AI + weather. Running simulation otherwise.
            </div>
          )}

          <div className="section-header">Step 1 — Auto-Import Live Weather</div>
          <div className="card">
            <button className="detect-btn" onClick={detectWeather}>
              AUTO-DETECT MY LOCATION & CURRENT WEATHER
            </button>
            {wStatus.msg && <div className={`status-bar status-${wStatus.type}`}>{wStatus.msg}</div>}
            {weatherData && (
              <div className="weather-live">
                <div style={{ fontSize: "0.6rem", color: "#059669", fontFamily: "monospace", marginBottom: 9, letterSpacing: "0.1em" }}>
                  LIVE — {fInputs.region}
                </div>
                <div className="g4">
                  <WeatherBadge icon="🌡️" label="Temp" value={`${weatherData.current.temp_c}°C`} />
                  <WeatherBadge icon="💨" label="Wind" value={`${weatherData.current.wind_kph} km/h`} />
                  <WeatherBadge icon="💧" label="Humidity" value={`${weatherData.current.humidity}%`} />
                  <WeatherBadge icon="☁️" label="Sky" value={weatherData.current.condition.text.split(" ").slice(0, 2).join(" ")} />
                </div>
              </div>
            )}
          </div>

          <div className="section-header">Step 2 — Select Disaster Type</div>
          <div className="card">
            <div className="type-grid">
              {DISASTER_TYPES.map(t => (
                <button key={t} className={`type-btn ${fInputs.disasterType === t ? "active" : ""}`} onClick={() => setF("disasterType", t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="section-header">Step 3 — Confirm Location & Alert</div>
          <div className="card">
            <div style={{ marginBottom: "0.75rem" }}>
              <label>Your Region / District *</label>
              <input placeholder="e.g., Puri District, Odisha" value={fInputs.region} onChange={e => setF("region", e.target.value)} />
            </div>
            <div>
              <label>Paste Government / IMD Alert Text (optional)</label>
              <textarea rows={3} placeholder="Paste any official warning or bulletin here..." value={fInputs.alertText} onChange={e => setF("alertText", e.target.value)} />
            </div>
          </div>

          <div className="section-header">Step 4 — Weather Data (auto-filled or manual)</div>
          <div className="card">
            <div className="g3">
              <div><label>Wind Speed (km/h)</label><input type="number" placeholder="e.g., 160" value={fInputs.windSpeed} onChange={e => setF("windSpeed", e.target.value)} /></div>
              <div><label>Rainfall (mm / 24h)</label><input type="number" placeholder="e.g., 200" value={fInputs.rainfall} onChange={e => setF("rainfall", e.target.value)} /></div>
              <div><label>Temperature (°C)</label><input type="number" placeholder="e.g., 42" value={fInputs.temperature} onChange={e => setF("temperature", e.target.value)} /></div>
            </div>
          </div>

          <div className="section-header">Step 5 — Local Factors</div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              ["Population density?", "populationDensity", [["low", "Sparse / Rural"], ["medium", "Moderate"], ["high", "Dense City"]]],
              ["Near coast, river, or low-lying land?", "coastalProximity", [["no", "No — Inland"], ["yes", "Yes — Coastal / River"]]],
              ["Age of most buildings?", "infrastructureAge", [["new", "New (post-2000)"], ["mixed", "Mixed"], ["old", "Old (pre-1980)"]]],
              ["Known flood zone?", "floodZone", [["no", "No"], ["yes", "Yes — Flooded Before"]]],
              ["How often has this disaster hit here?", "historicalFrequency", [["low", "Rarely"], ["medium", "Sometimes"], ["high", "Frequently"]]],
            ].map(([lbl, key, opts]) => (
              <div key={key}>
                <label>{lbl}</label>
                <div className="segmented">
                  {opts.map(([v, l]) => (
                    <button key={v} className={`seg-btn ${fInputs[key] === v ? "active" : ""}`} onClick={() => setF(key, v)}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="go-btn" disabled={!fInputs.region} onClick={runForecast}>
            GENERATE AEGIS SEVERITY FORECAST
          </button>
          <div style={{ textAlign: "center", marginTop: "0.6rem", fontSize: "0.6rem", color: "#94a3b8" }}>
            Always follow official NDMA / IMD / State Government advisories. Emergency: 112
          </div>
        </div>
      </div>
    </div>
  );

  // ── FORECAST LOADING ────────────────────────────────────────────────────────
  if (mode === "forecast" && fStep === "loading") return (
    <div className="root"><style>{CSS}</style>
      <div className="bg-grid" /><div className="z1">
        <Topbar engine={null} />
        <LoadingScreen msgs={FORECAST_MSGS} msgIndex={fMsgIdx} subtitle="AEGIS is analysing..." />
      </div>
    </div>
  );

  // ── FORECAST RESULT ─────────────────────────────────────────────────────────
  if (mode === "forecast" && fStep === "result" && fResult) {
    const sev = getSevColors(fResult.predicted_severity);
    const evac = getEvacColors(fResult.should_i_evacuate?.answer);
    const phaseColors = ["#3b82f6", sev.color, "#0ea5e9"];
    return (
      <div className="root"><style>{CSS}</style>
        <div className="bg-grid" /><div className="z1">
          <Topbar showBack onBack={resetForecast} engine={fEngine} reportId={fReportId} />
          <div className={`rw ${fAnimIn ? "visible" : ""}`} style={{ paddingTop: "1.6rem" }}>

            {/* Hero card */}
            <div className="card" style={{ background: `linear-gradient(135deg,#ffffff,${sev.bg})`, borderColor: `${sev.color}20`, marginBottom: "0.65rem" }}>
              <div style={{ display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 94, height: 94, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `2px solid ${sev.color}`, boxShadow: `0 0 26px ${sev.ring}`, position: "relative", background: "#ffffff" }}>
                  <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `1px solid ${sev.color}`, opacity: 0.18 }} />
                  <div style={{ fontFamily: "Sora, sans-serif", fontSize: "2rem", fontWeight: 800, color: sev.color, lineHeight: 1 }}>{fResult.predicted_severity}</div>
                  <div style={{ fontSize: "0.48rem", color: `${sev.color}`, opacity: 0.6, letterSpacing: "0.1em", marginTop: 1 }}>OUT OF 10</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "0.38rem", flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "Sora, sans-serif", fontSize: "1.2rem", fontWeight: 800, color: sev.color }}>{fResult.severity_label}</div>
                    <div style={{ background: `${sev.color}10`, border: `1px solid ${sev.color}30`, borderRadius: 6, padding: "2px 9px", fontSize: "0.69rem", color: sev.color, fontWeight: 700 }}>{fResult.disaster_type}</div>
                    {weatherData && <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "2px 8px", fontSize: "0.62rem", color: "#059669", fontFamily: "monospace" }}>LIVE DATA</div>}
                  </div>
                  <p style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.62, marginBottom: "0.8rem" }}>{fResult.headline}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(108px,1fr))", gap: "0.38rem" }}>
                    {[["⏱", "Peak window", fResult.peak_window], ["📏", "Radius", `${fResult.affected_radius_km} km`], ["👥", "At risk", fResult.population_at_risk], ["🎯", "Confidence", `${fResult.confidence_pct}%`]].map(([ic, lb, val]) => (
                      <div key={lb} style={{ background: "#ffffff", borderRadius: 8, padding: "0.38rem 0.62rem", border: "1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: "0.53rem", color: "#64748b", marginBottom: 2 }}>{ic} {lb}</div>
                        <div style={{ fontFamily: "monospace", fontSize: "0.76rem", color: "#0f172a", fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Prep score CTA */}
            <div style={{ background: "rgba(59,130,246,0.02)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "0.65rem", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2563eb", marginBottom: 3 }}>🛡️ Know your survival odds?</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>Run AEGIS Preparedness Score — AI evaluates your kit, plans, and contacts against this exact {fResult.severity_label} scenario.</div>
              </div>
              <button onClick={() => setMode("prep")} style={{ flexShrink: 0, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 9, padding: "0.5rem 0.9rem", color: "#2563eb", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700, whiteSpace: "nowrap", transition: "all 0.2s" }}>
                Run Score →
              </button>
            </div>

            {/* Evacuate */}
            <div style={{ background: evac.bg, border: `1px solid ${evac.border}`, borderRadius: 14, padding: "1.1rem", marginBottom: "0.65rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "0.55rem", color: evac.color, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Should I evacuate?</div>
                <div style={{ fontFamily: "Sora, sans-serif", fontSize: "1.85rem", fontWeight: 800, color: evac.color, lineHeight: 1 }}>{fResult.should_i_evacuate?.answer}</div>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.84rem", lineHeight: 1.65, color: "#475569", marginBottom: "0.48rem" }}>{fResult.should_i_evacuate?.reasoning}</p>
                {fResult.should_i_evacuate?.answer !== "NO" && (
                  <div style={{ fontSize: "0.76rem", color: evac.color, background: `${evac.border}15`, borderRadius: 7, padding: "0.38rem 0.68rem" }}>
                    📍 <strong>Go to:</strong> {fResult.should_i_evacuate?.if_yes_go_to}
                  </div>
                )}
              </div>
            </div>

            {/* What to expect */}
            <div className="card">
              <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>What to expect</div>
              {[["Next 6 hours", fResult.what_to_expect?.next_6hrs, phaseColors[0]], ["Next 24 hours", fResult.what_to_expect?.next_24hrs, phaseColors[1]], ["Next 72 hours", fResult.what_to_expect?.next_72hrs, phaseColors[2]]].map(([lbl, txt, col], i) => (
                <div key={i} style={{ display: "flex", gap: "0.95rem", padding: "0.75rem 0", borderBottom: i < 2 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="tl-dot" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
                    {i < 2 && <div className="tl-line" style={{ flex: 1, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "0.58rem", color: col, fontWeight: 600, marginBottom: 3 }}>{lbl}</div>
                    <div style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>{txt}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Severity drivers */}
            <div className="card">
              <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>Why this severity score?</div>
              {(fResult.severity_drivers || []).map((d, i) => (
                <div key={i} style={{ marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: "0.8rem", color: "#0f172a", fontWeight: 600, flex: 1 }}>{d.factor}</span>
                    <FactorBar score={d.score} color={sev.color} />
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.5 }}>{d.explanation}</div>
                </div>
              ))}
            </div>

            {/* Checklist */}
            <div className="card">
              <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>What to do right now</div>
              {(fResult.right_now_checklist || []).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "0.62rem 0", borderBottom: i < (fResult.right_now_checklist.length - 1) ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                  <UrgencyDot urgency={item.urgency} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.83rem", color: "#0f172a", fontWeight: 600, marginBottom: 2 }}>{item.task}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5 }}>{item.why}</div>
                  </div>
                  <div style={{ fontSize: "0.54rem", color: "#94a3b8", fontFamily: "monospace", textAlign: "right", minWidth: 72, paddingTop: 3 }}>{item.urgency}</div>
                </div>
              ))}
            </div>

            {/* Collapsibles */}
            <div className="card">
              {[
                {
                  key: "history", icon: "📖", label: "Historical comparison",
                  content: () => (
                    <div style={{ paddingTop: "0.8rem", paddingBottom: "0.2rem" }} className="fade-up">
                      <div style={{ background: "rgba(59,130,246,0.02)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 10, padding: "0.8rem" }}>
                        <div style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "#2563eb", marginBottom: 3 }}>{fResult.historical_parallel?.event}</div>
                        <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.58, marginBottom: 5 }}>{fResult.historical_parallel?.similarity}</p>
                        <p style={{ fontSize: "0.81rem", color: "#0f172a", lineHeight: 1.58 }}>⚡ <strong>Outcome:</strong> {fResult.historical_parallel?.outcome}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "myths", icon: "🚫", label: "Dangerous myths",
                  content: () => (
                    <div style={{ paddingTop: "0.8rem", paddingBottom: "0.2rem" }} className="fade-up">
                      {(fResult.danger_myths || []).map((m, i) => (
                        <div key={i} style={{ background: "rgba(239,35,60,0.02)", border: "1px solid rgba(239,35,60,0.1)", borderRadius: 10, padding: "0.75rem", marginBottom: "0.45rem" }}>
                          <div style={{ fontSize: "0.77rem", color: "#dc2626", marginBottom: 4 }}>❌ MYTH: {m.myth}</div>
                          <div style={{ fontSize: "0.8rem", color: "#0f172a", lineHeight: 1.54 }}>✅ REALITY: {m.reality}</div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "vuln", icon: "🫂", label: "Who is most at risk?",
                  content: () => (
                    <div style={{ paddingTop: "0.5rem", paddingBottom: "0.2rem" }} className="fade-up">
                      {(fResult.vulnerable_groups_alert || []).map((g, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, padding: "0.52rem 0", borderBottom: i < fResult.vulnerable_groups_alert.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", fontSize: "0.82rem", color: "#475569", lineHeight: 1.5 }}>
                          <span style={{ color: "#f4a011", flexShrink: 0 }}>⚠</span>{g}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ].map(({ key, icon, label, content }) => (
                <div key={key}>
                  <div className="collapsible-header" onClick={() => setFOpen(p => p === key ? null : key)}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                      <span>{icon}</span>
                      <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#0f172a" }}>{label}</span>
                    </div>
                    <span className={`caret ${fOpen === key ? "open" : ""}`}>▼</span>
                  </div>
                  {fOpen === key && content()}
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", padding: "1rem", background: "rgba(74,222,128,0.02)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, marginBottom: "0.8rem" }}>
              <div style={{ fontSize: "0.84rem", color: "#059669", lineHeight: 1.65, fontStyle: "italic" }}>💚 {fResult.reassurance}</div>
            </div>
            <div style={{ textAlign: "center", fontSize: "0.58rem", color: "#94a3b8", fontFamily: "monospace" }}>
              AEGIS · {fEngine === "groq" ? "Groq AI (Llama 3.3 70B)" : fEngine === "grok" ? "Grok-3" : "Simulation Engine"} · Follow official NDMA / IMD advisories · Emergency: 112
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PREP INPUT ──────────────────────────────────────────────────────────────
  if (mode === "prep" && pStep === "input") return (
    <div className="root"><style>{CSS}</style>
      <div className="bg-grid" /><div className="z1">
        <Topbar engine={null} />
        <div className="wrap" style={{ paddingTop: "1.8rem" }}>

          {fResult ? (
            <div style={{ background: "rgba(255,107,43,0.02)", border: "1px solid rgba(255,107,43,0.15)", borderRadius: 12, padding: "0.8rem 1rem", marginBottom: "1rem", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>{D_ICONS[fResult.disaster_type] || "🌀"}</div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#ff6b2b", fontFamily: "monospace", marginBottom: 2 }}>⚡ LINKED TO ACTIVE FORECAST</div>
                <div style={{ fontSize: "0.82rem", color: "#0f172a" }}>{fResult.severity_label} {fResult.disaster_type} · Severity {fResult.predicted_severity}/10 · {fInputs.region}</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>Your preparedness will be scored against this specific threat context.</div>
              </div>
            </div>
          ) : (
            <div className="api-tip">💡 Run the <strong>Severity Forecast</strong> first for AI-personalized advice tied to an active disaster threat. Or continue for a general assessment.</div>
          )}

          <div className="prep-tabs">
            {[["kit", `🧰 Kit (${kitChecked}/${KIT_ITEMS.length})`], ["plans", "🗺️ Plans"], ["contacts", "📞 Contacts & Drills"]].map(([id, label]) => (
              <button key={id} className={`prep-tab-btn ${pTab === id ? "active" : "inactive"}`} onClick={() => setPTab(id)}>{label}</button>
            ))}
          </div>

          {pTab === "kit" && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.9rem", lineHeight: 1.55 }}>
                Check every item you currently have <strong style={{ color: "#2563eb" }}>packed and ready</strong>.
              </div>
              {KIT_ITEMS.map(item => (
                <div key={item.id} className={`kit-item ${kitItems[item.id] ? "checked" : "unchecked"}`} onClick={() => setKitItems(p => ({ ...p, [item.id]: !p[item.id] }))}>
                  <div className={`checkbox ${kitItems[item.id] ? "checked" : "unchecked"}`}>
                    {kitItems[item.id] && (
                      <svg width="11" height="9" viewBox="0 0 11 9">
                        <path d="M1 4.5l3 3 6-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: kitItems[item.id] ? "#0f172a" : "#64748b" }}>{item.label}</span>
                </div>
              ))}
              <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setPTab("plans")} style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#2563eb", padding: "0.5rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s" }}>
                  Next →
                </button>
              </div>
            </div>
          )}

          {pTab === "plans" && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.9rem", lineHeight: 1.55 }}>
                Planning is worth <strong style={{ color: "#2563eb" }}>45% of your score</strong>.
              </div>
              {[
                ["Evacuation route confirmed (2+ alternates)", "You know at least 2 exit routes and shared them with your household.", evacRoute, () => setEvacRoute(v => !v)],
                ["Family emergency plan completed", "Meeting point defined, roles assigned, communication protocol in place.", familyPlan, () => setFamilyPlan(v => !v)],
              ].map(([title, desc, val, toggle]) => (
                <div key={title} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.95rem 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ flex: 1, paddingRight: 14 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: "0.73rem", color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                  <div className={`toggle ${val ? "on" : "off"}`} onClick={toggle}>
                    <div className={`toggle-dot ${val ? "on" : "off"}`} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.9rem" }}>
                <button onClick={() => setPTab("kit")} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.08)", color: "#64748b", padding: "0.5rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s" }}>← Back</button>
                <button onClick={() => setPTab("contacts")} style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#2563eb", padding: "0.5rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s" }}>Next →</button>
              </div>
            </div>
          )}

          {pTab === "contacts" && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.9rem", lineHeight: 1.55 }}>Offline contacts and practice drills make the difference when phones fail.</div>
              <div style={{ marginBottom: "1.2rem" }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Offline emergency contacts stored</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.7rem" }}>Written on paper, not just in your phone. 5 = full score.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.6rem" }}>
                  <button className="counter-btn" onClick={() => setContacts(v => Math.max(0, v - 1))}>−</button>
                  <span style={{ fontFamily: "monospace", fontSize: "1.4rem", color: "#0f172a", minWidth: 28, textAlign: "center" }}>{contacts}</span>
                  <button className="counter-btn" onClick={() => setContacts(v => Math.min(5, v + 1))}>+</button>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>contacts</span>
                </div>
                <AnimBar value={Math.round((contacts / 5) * 100)} color="#3b82f6" />
              </div>
              <div style={{ marginBottom: "0.9rem" }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Emergency drills in last 12 months</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.7rem" }}>Fire drills, evacuation rehearsals, family practice. 3 = full score.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.6rem" }}>
                  <button className="counter-btn" onClick={() => setDrills(v => Math.max(0, v - 1))}>−</button>
                  <span style={{ fontFamily: "monospace", fontSize: "1.4rem", color: "#0f172a", minWidth: 28, textAlign: "center" }}>{drills}</span>
                  <button className="counter-btn" onClick={() => setDrills(v => Math.min(5, v + 1))}>+</button>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>drills</span>
                </div>
                <AnimBar value={Math.round((drills / 3) * 100)} color="#f4a011" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button onClick={() => setPTab("plans")} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.08)", color: "#64748b", padding: "0.5rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s" }}>← Back</button>
                <button onClick={runPrep} style={{ flex: 1, background: "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)", border: "none", borderRadius: 10, color: "#fff", padding: "0.7rem", cursor: "pointer", fontFamily: "Sora, sans-serif", fontSize: "0.88rem", fontWeight: 800, boxShadow: "0 6px 22px rgba(37,99,235,0.15)", transition: "all 0.2s" }}>
                  ⚡ CALCULATE MY SCORE
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
            {["kit", "plans", "contacts"].map(t => (
              <div key={t} style={{ height: 3, borderRadius: 2, flex: 1, background: pTab === t ? "#3b82f6" : "rgba(0,0,0,0.06)", boxShadow: pTab === t ? "0 0 7px rgba(59,130,246,0.3)" : "none", transition: "all .3s" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── PREP LOADING ────────────────────────────────────────────────────────────
  if (mode === "prep" && pStep === "loading") return (
    <div className="root"><style>{CSS}</style>
      <div className="bg-grid" /><div className="z1">
        <Topbar engine={null} />
        <LoadingScreen msgs={PREP_MSGS} msgIndex={pMsgIdx} subtitle="AEGIS is scoring your preparedness..." />
      </div>
    </div>
  );

  // ── PREP RESULT ─────────────────────────────────────────────────────────────
  if (mode === "prep" && pStep === "result" && pResult) {
    const rc = getRiskColors(pResult.risk_level);
    return (
      <div className="root"><style>{CSS}</style>
        <div className="bg-grid" /><div className="z1">
          <Topbar showBack onBack={resetPrep} engine={pEngine} />
          <div className={`rw ${pAnimIn ? "visible" : ""}`} style={{ paddingTop: "1.6rem" }}>

            {pResult.context_alert && (
              <div style={{ background: "rgba(239,35,60,0.02)", border: "1px solid rgba(239,35,60,0.15)", borderRadius: 11, padding: "0.9rem 1rem", marginBottom: "0.65rem" }}>
                <div style={{ fontSize: "0.6rem", color: "#dc2626", fontFamily: "monospace", marginBottom: 5, letterSpacing: "0.1em" }}>⚠ ACTIVE DISASTER CONTEXT</div>
                <div style={{ fontSize: "0.84rem", color: "#dc2626", lineHeight: 1.6 }}>{pResult.context_alert}</div>
              </div>
            )}

            {/* Score hero */}
            <div className="card" style={{ background: `radial-gradient(ellipse at 50% 0%,${rc.bg} 0%,#ffffff 60%)`, borderColor: `${rc.color}20`, textAlign: "center", padding: "1.8rem 1.2rem" }}>
              <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
                <ScoreRing score={pResult.overall_score} color={rc.color} ring={rc.ring} />
                <div className="score-center">
                  <div style={{ fontFamily: "Sora, sans-serif", fontSize: "2.4rem", fontWeight: 800, color: rc.color, lineHeight: 1, textShadow: `0 0 20px ${rc.ring}` }}>
                    <AnimNum target={pResult.overall_score} />
                  </div>
                  <div style={{ fontSize: "0.5rem", color: `${rc.color}`, opacity: 0.6, letterSpacing: "0.1em", marginTop: 2 }}>SCORE</div>
                </div>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: rc.bg, border: `1px solid ${rc.color}30`, borderRadius: 8, padding: "5px 16px", marginBottom: "1rem" }}>
                <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: "0.88rem", letterSpacing: "0.06em", color: rc.color }}>{pResult.risk_badge}</span>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.62rem", color: "#64748b", letterSpacing: "0.12em", marginBottom: 5, fontFamily: "monospace" }}>ESTIMATED SURVIVAL PROBABILITY</div>
                <div style={{ fontFamily: "Sora, sans-serif", fontSize: "1.9rem", fontWeight: 800, color: "#059669", textShadow: "0 0 16px rgba(74,222,128,0.3)" }}>
                  <AnimNum target={pResult.survival_probability} suffix="%" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxWidth: 380, margin: "0 auto" }}>
                {[["Risk Level", pResult.risk_level, rc.color], ["Kit Score", `${pResult.breakdown?.kit?.score}%`, "#60a5fa"], ["Evac Ready", pResult.breakdown?.evac?.score === 100 ? "YES ✓" : "NO ✗", pResult.breakdown?.evac?.score === 100 ? "#059669" : "#dc2626"]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "#ffffff", borderRadius: 9, padding: "0.7rem 0.5rem", border: "1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ fontFamily: "monospace", fontSize: "1rem", color: c, fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: "0.58rem", color: "#64748b", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top priority */}
            <div style={{ background: "rgba(59,130,246,0.02)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "0.65rem" }}>
              <div style={{ fontSize: "0.6rem", color: "#2563eb", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.1em" }}>🎯 YOUR #1 PRIORITY TODAY</div>
              <div style={{ fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.6, fontWeight: 600 }}>{pResult.top_priority}</div>
            </div>

            {/* Score breakdown */}
            <div className="card">
              <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>Score breakdown</div>
              {Object.entries(pResult.breakdown || {}).map(([key, b], i) => {
                const c = b.score >= 80 ? "#059669" : b.score >= 50 ? "#f4a011" : "#dc2626";
                return (
                  <div key={key} style={{ marginBottom: "0.9rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: "0.8rem", color: "#0f172a", fontWeight: 600, flex: 1 }}>{b.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "#64748b", fontFamily: "monospace" }}>{b.weight}</span>
                      <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: c, minWidth: 36, textAlign: "right" }}>{b.score}%</span>
                    </div>
                    <AnimBar value={b.score} color={c} delay={i * 80} />
                  </div>
                );
              })}
            </div>

            {/* Warnings */}
            {pResult.warnings?.length > 0 && (
              <div className="card">
                <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>Action required</div>
                {pResult.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "0.6rem 0.8rem", marginBottom: "0.45rem", background: "rgba(239,35,60,0.02)", border: "1px solid rgba(239,35,60,0.1)", borderRadius: 9, fontSize: "0.82rem", color: "#dc2626", lineHeight: 1.5 }}>
                    <span style={{ color: "#dc2626", flexShrink: 0 }}>⚠</span>{w}
                  </div>
                ))}
              </div>
            )}

            {/* Strengths */}
            {pResult.strengths?.length > 0 && (
              <div className="card">
                <div className="section-header" style={{ marginTop: 0, fontSize: "1rem" }}>What you're doing right</div>
                {pResult.strengths.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, padding: "0.55rem 0", fontSize: "0.83rem", color: "#059669", borderBottom: i < pResult.strengths.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                    <span style={{ color: "#059669", flexShrink: 0 }}>✓</span>{s}
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: "center", padding: "1rem", background: "rgba(74,222,128,0.02)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, marginBottom: "0.8rem" }}>
              <div style={{ fontSize: "0.84rem", color: "#059669", lineHeight: 1.65, fontStyle: "italic" }}>💚 {pResult.reassurance}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={resetPrep} style={{ flex: 1, background: "transparent", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, color: "#64748b", cursor: "pointer", padding: "0.65rem", fontSize: "0.78rem", fontWeight: 700, transition: "all 0.2s" }}>↺ Retake</button>
              {!fResult && (
                <button onClick={() => setMode("forecast")} style={{ flex: 1, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10, color: "#2563eb", cursor: "pointer", padding: "0.65rem", fontSize: "0.78rem", fontWeight: 700, transition: "all 0.2s" }}>
                  🌀 Run Forecast
                </button>
              )}
            </div>
            <div style={{ textAlign: "center", marginTop: "0.7rem", fontSize: "0.58rem", color: "#94a3b8", fontFamily: "monospace" }}>
              AEGIS Preparedness · {pEngine === "groq" ? "Groq AI (Llama 3.3 70B)" : pEngine === "grok" ? "Grok-3" : "Simulation Engine"} · Follow official NDMA / IMD advisories · Emergency: 112
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}