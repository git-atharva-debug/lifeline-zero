import { useState, useEffect, useRef, useCallback } from 'react';
import { sosAPI, incidentAPI, resourceAPI } from '../../services/api';
import BuildingViewer3D from '../../components/BuildingViewer3D';

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE TRACKER — Integrated with Incidents, SOS Beacons, Groq AI + OpenRoute
// ENV KEYS:
//   REACT_APP_GROQ_API_KEY         → AI severity & resource recommendations
//   REACT_APP_OPENROUTE_API_KEY    → Route distance & ETA to incident
// ═══════════════════════════════════════════════════════════════════════════════

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function groqRecommend(incident, availableResources) {
  const key = process.env.REACT_APP_GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a disaster resource allocation AI for rescue command centers. 
Analyze an incident and output ONLY strict JSON:
{
  "severity_score": "Number 1-10",
  "severity_label": "Low|Moderate|High|Critical",
  "severity_reason": "1 sentence why",
  "estimated_people_affected": "Number",
  "recommended": {
    "ambulances": "Number",
    "fire_units": "Number",
    "helicopters": "Number",
    "rescue_boats": "Number",
    "personnel": "Number"
  },
  "priority_action": "Single most urgent action in plain English",
  "estimated_duration_hrs": "Number",
  "special_notes": "Any medical/hazmat/structural concerns, or null"
}

IMPORTANT GUIDELINES:
- Be realistic and conservative with resource allocation.
- SCALING: Recommend 1 ambulance per 4-5 victims for Moderate, 1 per 3 victims for High/Critical.
- FIRE UNITS: 1 unit for 1-10 people, 2 units for 10-25 people, 3+ for large structural fires.
- HELICOPTERS: ONLY for Critical severity AND (>25 people OR remote locations >10km). DO NOT recommend for near incidents unless extreme mass casualty.
- RESCUE BOATS: Only for flood incidents involving water rescue.
- PERSONNEL: Roughly 5 per unit.

Consider incident type, priority, and estimated people affected. Remote incidents are those >10km from base.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ incident, availableResources }),
          },
        ],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('Groq recommend error:', e);
    return null;
  }
}

async function getRoute(fromLat, fromLon, toLat, toLon) {
  const key = process.env.REACT_APP_OPENROUTE_API_KEY;
  if (!key || !toLat || !toLon) return null;
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': key },
      body: JSON.stringify({
        coordinates: [[fromLon, fromLat], [toLon, toLat]],
      }),
    });
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    const dist = (route.summary.distance / 1000).toFixed(1);
    const mins = Math.round(route.summary.duration / 60);
    return { distKm: dist, etaMins: mins };
  } catch (e) {
    console.error('OpenRoute error:', e);
    return null;
  }
}

// Realistic mock fallback with people count
function mockRecommend(incident) {
  const type = (incident.incidentType || incident.type || '').toLowerCase();
  const priority = (incident.priority || 'medium').toLowerCase();
  const hasMedical = incident.medicalConditions && incident.medicalConditions !== 'None';

  // Get people count from incident description or form data
  let peopleAffected = 1; // Default
  if (incident.estimatedPeople) {
    peopleAffected = incident.estimatedPeople;
  } else if (incident.description) {
    // Try to extract number from description
    const match = incident.description.match(/(\d+)\s*(people|person|victim|individual|市民|人)/i);
    if (match) peopleAffected = parseInt(match[1]);
  }

  // Base severity on people count and type
  let sev = 3; // Base moderate
  if (peopleAffected <= 2) sev = 3; // Low
  else if (peopleAffected <= 5) sev = 5; // Moderate
  else if (peopleAffected <= 15) sev = 7; // High
  else sev = 9; // Critical

  // Adjust by type
  const typeMultiplier = { fire: 1.2, flood: 1.1, earthquake: 1.5, medical: 1.0, collapse: 1.4, other: 0.9 };
  sev = Math.min(10, Math.round(sev * (typeMultiplier[type] || 1)));

  // Adjust by priority
  if (priority === 'critical') sev = Math.min(10, sev + 2);
  else if (priority === 'high') sev = Math.min(10, sev + 1);

  const label = sev >= 8 ? 'Critical' : sev >= 6 ? 'High' : sev >= 4 ? 'Moderate' : 'Low';

  // Realistic resource calculation based on people affected
  const calcAmbulances = () => {
    if (peopleAffected <= 3) return 1;
    if (peopleAffected <= 8) return 2;
    if (peopleAffected <= 15) return 3;
    return Math.min(6, Math.ceil(peopleAffected / 4));
  };

  const calcFireUnits = () => {
    if (type === 'fire' || type === 'earthquake' || type === 'collapse') {
      if (peopleAffected <= 10) return 1;
      if (peopleAffected <= 25) return 2;
      return 3;
    }
    if (type === 'flood' && peopleAffected > 20) return 1;
    return 0;
  };

  const calcHelicopters = () => {
    // Only for Critical + (Remote or > 25 people)
    // For this mock, we'll check if dist > 10 if we had it, but here we just check severity + people
    if (sev >= 9 && peopleAffected > 25) return 1;
    return 0;
  };

  const calcBoats = () => {
    if (type === 'flood') {
      if (peopleAffected <= 10) return 1;
      return 2;
    }
    return 0;
  };

  const calcPersonnel = () => {
    let base = peopleAffected * 2; // 2 responders per affected person
    if (type === 'collapse' || type === 'earthquake') base *= 1.5;
    if (type === 'fire') base *= 1.3;
    return Math.min(50, Math.max(5, Math.round(base)));
  };

  return {
    severity_score: sev,
    severity_label: label,
    severity_reason: `${label} severity: approximately ${peopleAffected} people affected by ${type} incident with ${priority} priority.`,
    estimated_people_affected: peopleAffected,
    recommended: {
      ambulances: calcAmbulances(),
      fire_units: calcFireUnits(),
      helicopters: calcHelicopters(),
      rescue_boats: calcBoats(),
      personnel: calcPersonnel(),
    },
    priority_action: sev >= 8
      ? `Evacuate ${peopleAffected} people immediately and establish perimeter`
      : sev >= 6
        ? `Dispatch primary response team for ${peopleAffected} affected people`
        : `Send assessment team for ${peopleAffected} affected people`,
    estimated_duration_hrs: Math.max(1, Math.ceil(peopleAffected / 10)),
    special_notes: hasMedical ? `Victim has: ${incident.medicalConditions}. Allergies: ${incident.allergies || 'None'}` : null,
  };
}

// ─── DATA SOURCES ───────────────────────────────────────────────────────────────────
async function getSOSBeacons() {
  try {
    const res = await sosAPI.getActive();
    if (res.success) return Object.values(res.data);
    return [];
  } catch { return []; }
}

function getLocalIncidents() {
  try { return JSON.parse(localStorage.getItem('incidents_local') || '[]'); }
  catch { return []; }
}

async function getResources() {
  try {
    const res = await resourceAPI.getAll();
    if (res.success) return res.data;
    return [];
  } catch { return []; }
}

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const TYPE_ICONS = { fire: '🔥', flood: '🌊', earthquake: '🏚️', medical: '🏥', collapse: '🏗️', other: '⚠️' };

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_COLORS = { Available: '#22c55e', Deployed: '#ef4444', 'En Route': '#f59e0b', Returning: '#60a5fa' };
const SEV_COLORS = { Critical: '#ef4444', High: '#f97316', Moderate: '#f59e0b', Low: '#22c55e' };
const INCIDENT_STATUS_COLORS = { active: '#ef4444', responding: '#3b82f6', resolved: '#22c55e', cancelled: '#64748b' };

// ─── CSS (updated for clean white theme) ────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background: #ffffff;
  }

  @keyframes fadeUp { 
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .rt-page {
    font-family: 'Inter', sans-serif;
    color: #1e293b;
    background: #ffffff;
    min-height: 100vh;
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .rt-mono {
    font-family: 'DM Mono', monospace;
  }

  .rt-tabs {
    display: flex;
    gap: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .rt-tab {
    flex: 1;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
    background: transparent;
    color: #64748b;
  }

  .rt-tab.on {
    background: #3b82f6;
    color: #ffffff;
  }

  .rt-tab.off:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .rt-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    transition: all 0.2s;
  }

  .rt-card:hover {
    border-color: #94a3b8;
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  }

  .rt-card.selected {
    border-color: #3b82f6;
    background: #f0f9ff;
  }

  .rt-card.critical-card {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .rt-card.high-card {
    border-color: #f97316;
    background: #fff7ed;
  }

  .sev-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .sev-Critical {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #ef4444;
  }

  .sev-High {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #f97316;
  }

  .sev-Moderate {
    background: #fefce8;
    border: 1px solid #fde68a;
    color: #f59e0b;
  }

  .sev-Low {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #22c55e;
  }

  .people-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.65rem;
    color: #3b82f6;
  }

  .rt-section-label {
    font-family: 'DM Mono', monospace;
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rt-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .resource-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    font-family: 'DM Mono', monospace;
  }

  .rec-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .rec-box {
    background: #f8fafc;
    border-radius: 0.5rem;
    padding: 0.75rem 0.5rem;
    text-align: center;
    border: 1px solid #e2e8f0;
  }

  .rec-num {
    font-size: 1.3rem;
    font-weight: 700;
    color: #0f172a;
  }

  .rec-lbl {
    font-family: 'DM Mono', monospace;
    font-size: 0.6rem;
    color: #64748b;
    margin-top: 0.25rem;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    display: inline-block;
  }

  .action-btn {
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-blue {
    background: #3b82f6;
    color: #ffffff;
  }

  .btn-blue:hover {
    background: #2563eb;
  }

  .btn-green {
    background: #22c55e;
    color: #ffffff;
  }

  .btn-green:hover {
    background: #16a34a;
  }

  .btn-ghost {
    background: transparent;
    border: 1px solid #e2e8f0;
    color: #64748b;
  }

  .btn-ghost:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
  }

  .btn-red {
    background: #ef4444;
    color: #ffffff;
  }

  .btn-red:hover {
    background: #dc2626;
  }

  .route-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1rem;
  }

  .maps-link {
    display: block;
    padding: 0.6rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    color: #3b82f6;
    text-align: center;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  .maps-link:hover {
    background: #dbeafe;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.5rem;
  }

  .toast {
    position: fixed;
    top: 5rem;
    right: 1rem;
    z-index: 9999;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    color: #0f172a;
    animation: fadeUp 0.3s ease;
    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    max-width: 300px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.85rem;
    gap: 1rem;
  }

  .data-row:last-child {
    border-bottom: none;
  }

  .data-lbl {
    font-family: 'DM Mono', monospace;
    font-size: 0.7rem;
    color: #64748b;
  }

  .data-val {
    color: #0f172a;
    font-weight: 600;
    text-align: right;
  }

  .note-box {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 0.5rem;
    padding: 0.75rem;
    font-size: 0.8rem;
    color: #92400e;
    line-height: 1.6;
    margin-top: 0.5rem;
  }

  .empty-box {
    text-align: center;
    padding: 3rem 1rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    color: #94a3b8;
    background: #f8fafc;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
  }

  .incident-user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid #e2e8f0;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    background: #3b82f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
    color: #ffffff;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .user-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #0f172a;
  }

  .user-contact {
    font-size: 0.7rem;
    color: #64748b;
  }

  .incident-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .btn-cancel {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #ef4444;
  }

  .btn-cancel:hover {
    background: #fee2e2;
  }

  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .confirm-dialog {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    max-width: 420px;
    animation: fadeUp 0.3s ease;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  }

  .confirm-dialog h3 {
    margin: 0 0 0.75rem;
    font-size: 1.3rem;
    font-weight: 700;
    color: #0f172a;
  }

  .confirm-dialog p {
    margin: 0 0 1.5rem;
    font-size: 0.9rem;
    color: #64748b;
    line-height: 1.6;
  }

  .confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .people-input {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.6rem;
    color: #0f172a;
    font-family: 'DM Mono', monospace;
    font-size: 0.9rem;
    width: 100%;
    margin-top: 0.25rem;
  }

  .people-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .warning-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    color: #ef4444;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .warning-icon {
    font-size: 1.5rem;
  }

  .shortage-list {
    margin-top: 0.5rem;
    padding-left: 1.5rem;
  }

  .shortage-list li {
    margin-bottom: 0.25rem;
    color: #ef4444;
  }

  .two-col {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }
`;

// ─── SOURCE TYPE HELPERS ───────────────────────────────────────────────────────
function normalizeIncident(raw) {
  return {
    id: raw._id || raw.id,
    incidentType: raw.incidentType,
    type: raw.incidentType,
    priority: raw.priority,
    lat: raw.location?.lat ?? raw.lat,
    lon: raw.location?.lng ?? raw.lon,
    description: raw.description,
    timestamp: raw.createdAt || raw.timestamp || new Date().toISOString(),
    aiAssessment: raw.aiAssessment || null,
    status: raw.status || 'active',
    reporter: raw.user || {},
    phantomMap: raw.phantomMap || null,
    estimatedPeople: raw.estimatedPeople || raw.peopleCount || 1,
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ResourceTracker() {
  const [tab, setTab] = useState('incidents'); // incidents | resources
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [selected, setSelected] = useState(null);       // selected incident id
  const [aiLoading, setAiLoading] = useState({});         // { [id]: true }
  const [routeInfo, setRouteInfo] = useState({});         // { [id]: {distKm, etaMins} }
  const [routeLoading, setRouteLoading] = useState({});
  const [deployModal, setDeployModal] = useState(null);     // incident id being deployed to
  const [toast, setToast] = useState(null);
  const [editingPeople, setEditingPeople] = useState(null); // incident id for people count edit
  const [deployWarning, setDeployWarning] = useState(null); // Warning about insufficient resources

  // Incident Control Stats & Actions
  const [expandedId, setExpandedId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const toastRef = useRef(null);
  const aiCache = useRef({}); // Cache AI assessments across polls
  const hasAI = !!process.env.REACT_APP_GROQ_API_KEY;
  const hasRoute = !!process.env.REACT_APP_OPENROUTE_API_KEY;

  // ─── Load all incidents ─────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const res = await incidentAPI.getActive({ limit: 100 });
      const data = res.data || [];
      const normalized = data
        .filter(i => i.status !== 'resolved' && i.status !== 'cancelled')
        .map(i => {
          const inc = normalizeIncident(i);
          // Restore cached AI assessment if available
          if (aiCache.current[inc.id]) {
            inc.aiAssessment = aiCache.current[inc.id];
          }
          return inc;
        });
      setIncidents(normalized);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  }, []);

  const loadResources = useCallback(async () => {
    const data = await getResources();
    setResources(data);
  }, []);

  useEffect(() => {
    loadAll();
    loadResources();
    const iv = setInterval(() => {
      loadAll();
      loadResources();
    }, 10000);
    const onStore = (e) => { if (e.key === 'incidents_local') loadAll(); };
    window.addEventListener('storage', onStore);
    return () => { clearInterval(iv); window.removeEventListener('storage', onStore); };
  }, [loadAll, loadResources]);

  // ─── Update people count ─────────────────────────────────
  const updatePeopleCount = async (incidentId, count) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;

    // Update local state
    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, estimatedPeople: count } : i
    ));

    // Clear cached AI so it re-runs with new count
    delete aiCache.current[incidentId];

    // Clear existing assessment
    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, aiAssessment: null } : i
    ));

    setEditingPeople(null);
    showToast(`People count updated to ${count}`);
  };

  // ─── AI Assessment ────────────────────────────────────────────────────
  const runAI = async (incident) => {
    setAiLoading(p => ({ ...p, [incident.id]: true }));
    const avail = {
      ambulances: resources.filter(r => r.type === 'ambulance' && r.status === 'Available').length,
      fire_units: resources.filter(r => r.type === 'fire_unit' && r.status === 'Available').length,
      helicopters: resources.filter(r => r.type === 'helicopter' && r.status === 'Available').length,
      rescue_boats: resources.filter(r => r.type === 'rescue_boat' && r.status === 'Available').length,
    };
    const result = await groqRecommend(incident, avail) || mockRecommend(incident);

    // Persist AI result in cache
    aiCache.current[incident.id] = result;

    // Persist to localStorage for local fallback
    const locals = getLocalIncidents();
    const idx = locals.findIndex(i => (i.id || i._id) === incident.id);
    if (idx !== -1) {
      locals[idx].aiAssessment = result;
      localStorage.setItem('incidents_local', JSON.stringify(locals));
    }

    setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, aiAssessment: result } : i));
    setAiLoading(p => ({ ...p, [incident.id]: false }));
    showToast(`AI assessment complete for ${incident.name || incident.type} (${result.estimated_people_affected} people)`);
  };

  // ─── Route info ───────────────────────────────────────────────────────
  const fetchRoute = async (incident) => {
    if (!incident.lat || !incident.lon) return;
    setRouteLoading(p => ({ ...p, [incident.id]: true }));
    // Use base coords (first available resource) as "base"
    const base = resources.find(r => r.status === 'Available');
    const fromLat = base?.lat || 18.5204;
    const fromLon = base?.lon || 73.8567;
    const info = hasRoute
      ? await getRoute(fromLat, fromLon, incident.lat, incident.lon)
      : { distKm: (Math.random() * 8 + 1).toFixed(1), etaMins: Math.round(Math.random() * 20 + 5) };
    setRouteInfo(p => ({ ...p, [incident.id]: info }));
    setRouteLoading(p => ({ ...p, [incident.id]: false }));
  };

  // ─── Select incident ──────────────────────────────────────────────────
  const selectIncident = (inc) => {
    setSelected(inc.id);
    if (!routeInfo[inc.id] && inc.lat) fetchRoute(inc);
  };

  // ─── Check resource availability ─────────────────────────────────────
  const checkResourceAvailability = (rec) => {
    // rec might be full aiAssessment or just the counts object from the modal
    const needed = rec.recommended || rec;
    const shortages = [];
    const available = {
      ambulances: resources.filter(r => r.type === 'ambulance' && r.status === 'Available').length,
      fire_units: resources.filter(r => r.type === 'fire_unit' && r.status === 'Available').length,
      helicopters: resources.filter(r => r.type === 'helicopter' && r.status === 'Available').length,
      rescue_boats: resources.filter(r => r.type === 'rescue_boat' && r.status === 'Available').length,
    };

    if ((needed.ambulances || 0) > available.ambulances) {
      shortages.push({
        type: 'ambulance',
        needed: rec.recommended.ambulances,
        available: available.ambulances,
        short: needed.ambulances - available.ambulances
      });
    }
    if ((needed.fire_units || 0) > available.fire_units) {
      shortages.push({
        type: 'fire_unit',
        needed: rec.recommended.fire_units,
        available: available.fire_units,
        short: needed.fire_units - available.fire_units
      });
    }
    if ((needed.helicopters || 0) > available.helicopters) {
      shortages.push({
        type: 'helicopter',
        needed: rec.recommended.helicopters,
        available: available.helicopters,
        short: needed.helicopters - available.helicopters
      });
    }
    if ((needed.rescue_boats || 0) > available.rescue_boats) {
      shortages.push({
        type: 'rescue_boat',
        needed: rec.recommended.rescue_boats,
        available: available.rescue_boats,
        short: needed.rescue_boats - available.rescue_boats
      });
    }

    return shortages;
  };

  // ─── Deploy resources with validation ─────────────────────────────────
  const deployResources = async (incident, rec) => {
    // Check availability first
    const shortages = checkResourceAvailability(rec);

    if (shortages.length > 0) {
      setDeployWarning({ incident, shortages, rec });
      setDeployModal(null);
      return;
    }

    // Proceed with deployment
    const types = [
      { key: 'ambulances', type: 'ambulance' },
      { key: 'fire_units', type: 'fire_unit' },
      { key: 'helicopters', type: 'helicopter' },
      { key: 'rescue_boats', type: 'rescue_boat' },
    ];

    let deployed = 0;
    try {
      for (const { key, type } of types) {
        const needed = rec?.recommended?.[key] || rec?.[key] || 0;
        let count = 0;
        const availableUnits = resources.filter(r => r.type === type && r.status === 'Available');

        for (const unit of availableUnits) {
          if (count < needed) {
            await resourceAPI.update(unit._id || unit.id, {
              status: 'En Route',
              zone: `Incident-${incident.id?.slice(-4) || '?'}`,
              assignedTo: incident.id
            });
            count++;
            deployed++;
          }
        }
      }

      // Automatically mark incident as responding if it was active
      if (incident.status === 'active' && deployed > 0) {
        await incidentAPI.updateStatus(incident.id, 'responding');
        loadAll();
      }

      loadResources();
      setDeployModal(null);
      showToast(`${deployed} unit${deployed !== 1 ? 's' : ''} dispatched to ${incident.name || incident.type}`);
    } catch (err) {
      showToast('Error during deployment.');
      loadResources();
    }
  };

  const resolveAndRecall = async (incident) => {
    try {
      const assigned = resources.filter(r => r.assignedTo === incident.id);

      // 1. Resolve incident
      await incidentAPI.updateStatus(incident.id, 'resolved');

      // 2. Recall all units
      for (const r of assigned) {
        await resourceAPI.update(r._id || r.id, {
          status: 'Returning',
          zone: 'Base',
          assignedTo: null
        });
      }

      showToast(`✅ Incident resolved. ${assigned.length} units recalled to base.`);
      loadAll();
      loadResources();

      // Return units to Available after delay
      setTimeout(async () => {
        for (const r of assigned) {
          await resourceAPI.update(r._id || r.id, { status: 'Available', zone: 'Base' });
        }
        loadResources();
      }, 15000);

    } catch (err) {
      showToast('Error resolving incident');
    }
  };

  const recallResource = async (id) => {
    try {
      await resourceAPI.update(id, { status: 'Returning', zone: 'Base', assignedTo: null });
      loadResources();

      setTimeout(async () => {
        await resourceAPI.update(id, { status: 'Available', zone: 'Base' });
        loadResources();
      }, 15000);

      showToast('Unit recalled — returning to base');
    } catch (err) {
      showToast('Error recalling unit');
    }
  };

  const handleAddResource = async (type) => {
    try {
      const res = await resourceAPI.add(type);
      if (res.success) {
        showToast(`Added 1 ${type.replace('_', ' ')}`);
        loadResources();
      }
    } catch (err) {
      showToast(err.message || 'Error adding resource');
    }
  };

  const handleRemoveResource = async (type) => {
    try {
      const res = await resourceAPI.removeByType(type);
      if (res.success) {
        showToast(`Removed 1 ${type.replace('_', ' ')}`);
        loadResources();
      }
    } catch (err) {
      showToast(err.message || 'No available units to remove');
    }
  };

  // ─── Status Updates ───────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!confirmAction) return;
    const { id, status } = confirmAction;

    setActionLoading(id);
    setConfirmAction(null);
    try {
      await incidentAPI.updateStatus(id, status);
      showToast(`Incident status updated to "${status}".`);
      await loadAll();
    } catch (err) {
      showToast('Error updating status');
    } finally {
      setActionLoading(null);
    }
  };

  const getActions = (incident) => {
    const actions = [];
    if (incident.status === 'active') {
      actions.push({ status: 'responding', label: 'Respond', className: 'btn-blue' });
      actions.push({ status: 'cancelled', label: 'Cancel', className: 'btn-cancel' });
    }
    if (incident.status === 'responding') {
      actions.push({ status: 'resolved', label: 'Resolve', className: 'btn-green' });
      actions.push({ status: 'cancelled', label: 'Cancel', className: 'btn-cancel' });
    }
    return actions;
  };

  const statusLabels = {
    responding: { title: 'Deploy Response Team?', desc: 'This will mark the incident as "Responding". The reporting civilian will be notified.' },
    resolved: { title: 'Mark as Resolved?', desc: 'This will close the incident and mark it as "Resolved".' },
    cancelled: { title: 'Cancel This Incident?', desc: 'This will permanently cancel the incident.' },
  };

  const toggleMap = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  };

  // ─── Computed stats ───────────────────────────────────────────────────
  const selInc = incidents.find(i => i.id === selected);
  const counts = {
    Available: resources.filter(r => r.status === 'Available').length,
    Deployed: resources.filter(r => r.status === 'Deployed').length,
    'En Route': resources.filter(r => r.status === 'En Route').length,
    Returning: resources.filter(r => r.status === 'Returning').length,
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="rt-page">
        {/* Header with colorful gradient title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            margin: '0 0 0.5rem',
            letterSpacing: '-0.02em',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Resource
            </span>
            <span style={{ color: '#0f172a' }}> Tracker</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
            Integrated Incident Control · AI resource recommendations · Intelligence Center
            {!hasAI && <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontFamily: 'DM Mono', fontSize: '0.7rem' }}>(Add REACT_APP_GROQ_API_KEY for AI)</span>}
          </p>
        </div>

        {/* Tabs */}
        <div className="rt-tabs">
          {[['incidents', `Incidents (${incidents.length})`], ['resources', `Resources (${resources.length})`]].map(([id, label]) => (
            <button key={id} className={`rt-tab ${tab === id ? 'on' : 'off'}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ══ TAB: INCIDENTS ══════════════════════════════════════════════ */}
        {tab === 'incidents' && (
          <div className="two-col">

            {/* Left — incident list */}
            <div>
              <div className="rt-section-label">Live Feed</div>
              {incidents.length === 0 && (
                <div className="empty-box">
                  NO ACTIVE INCIDENTS<br />
                  <span style={{ color: '#94a3b8' }}>All clear! Polling every 10s...</span>
                </div>
              )}
              {incidents.map(inc => {
                const ai = inc.aiAssessment;
                const cardClass = ai?.severity_label === 'Critical' ? 'critical-card' : ai?.severity_label === 'High' ? 'high-card' : '';
                const activeDeployments = resources.filter(r => r.assignedTo === inc.id);

                return (
                  <div key={inc.id} className={`rt-card ${selected === inc.id ? 'selected' : ''} ${cardClass}`}
                    onClick={() => selectIncident(inc)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inc.incidentType}</span>
                          {inc.estimatedPeople && (
                            <span className="people-badge">{inc.estimatedPeople} people</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'DM Mono', fontSize: '0.65rem', color: '#64748b' }}>
                          {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {inc.lat && ` · ${inc.lat.toFixed(4)}, ${inc.lon?.toFixed(4)}`}
                        </div>
                        {activeDeployments.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            {activeDeployments.slice(0, 5).map((r, idx) => (
                              <span key={idx} title={r.name} style={{ fontSize: '0.8rem' }}>{r.icon}</span>
                            ))}
                            {activeDeployments.length > 5 && <span style={{ fontSize: '0.65rem', color: '#64748b' }}>+{activeDeployments.length - 5}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <span style={{
                          background: `${INCIDENT_STATUS_COLORS[inc.status]}15`,
                          color: INCIDENT_STATUS_COLORS[inc.status],
                          borderRadius: '999px',
                          padding: '0.1rem 0.5rem',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          border: `1px solid ${INCIDENT_STATUS_COLORS[inc.status]}30`
                        }}>
                          {inc.status?.toUpperCase()}
                        </span>
                        <span style={{
                          background: inc.priority === 'critical' ? '#fef2f2' : inc.priority === 'high' ? '#fff7ed' : '#fefce8',
                          color: inc.priority === 'critical' ? '#ef4444' : inc.priority === 'high' ? '#f97316' : '#f59e0b',
                          borderRadius: '999px',
                          padding: '0.1rem 0.5rem',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          border: '1px solid transparent'
                        }}>
                          {inc.priority}
                        </span>
                      </div>
                    </div>
                    {inc.description && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, marginTop: '0.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {inc.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right — detail + AI */}
            <div>
              {!selInc && (
                <div className="empty-box" style={{ marginTop: '2rem' }}>
                  <div style={{ fontSize: '2.5rem', color: '#e2e8f0', marginBottom: '0.5rem' }}>📋</div>
                  SELECT AN INCIDENT<br />
                  <span style={{ color: '#94a3b8' }}>AI assessment + resource allocation will appear here</span>
                </div>
              )}

              {selInc && (
                <div style={{ animation: 'fadeUp 0.3s ease' }}>
                  {/* Title */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontFamily: 'Inter', fontSize: '1.3rem', fontWeight: 700 }}>
                        {selInc.incidentType?.toUpperCase()}
                      </div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Incident · {selInc.priority} priority · {selInc.status}
                      </div>
                    </div>
                    {selInc.aiAssessment && (
                      <span className={`sev-badge sev-${selInc.aiAssessment.severity_label}`} style={{ fontSize: '0.8rem', padding: '0.25rem 1rem' }}>
                        {selInc.aiAssessment.severity_label} — {selInc.aiAssessment.severity_score}/10
                      </span>
                    )}
                  </div>

                  {/* Reporter Info */}
                  {selInc.reporter?.name && (
                    <div className="incident-user-info">
                      <div className="user-avatar">{getInitials(selInc.reporter.name)}</div>
                      <div className="user-details">
                        <span className="user-name">{selInc.reporter.name}</span>
                        <span className="user-contact">
                          {selInc.reporter.email}
                          {selInc.reporter.phone && ` · ${selInc.reporter.phone}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* People Count Editor */}
                  <div className="rt-card" style={{ marginBottom: '1rem' }}>
                    <div className="rt-section-label">Affected People</div>
                    {editingPeople === selInc.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          className="people-input"
                          defaultValue={selInc.estimatedPeople || 1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updatePeopleCount(selInc.id, parseInt(e.target.value) || 1);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          className="action-btn btn-green"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={(e) => {
                            const input = e.target.parentElement.querySelector('input');
                            updatePeopleCount(selInc.id, parseInt(input.value) || 1);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#3b82f6' }}>
                          {selInc.estimatedPeople || 1} {selInc.estimatedPeople === 1 ? 'person' : 'people'}
                        </span>
                        <button
                          className="action-btn btn-ghost"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                          onClick={() => setEditingPeople(selInc.id)}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Location & Route */}
                  {selInc.lat && (
                    <div className="route-box" style={{ marginBottom: '1rem' }}>
                      <div className="rt-section-label" style={{ marginBottom: '0.5rem' }}>Location & Route</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: '0.75rem', color: '#3b82f6', marginBottom: '0.5rem' }}>
                        {selInc.lat.toFixed(5)}, {selInc.lon?.toFixed(5)}
                      </div>
                      {!routeInfo[selInc.id] && !routeLoading[selInc.id] && (
                        <button className="btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer' }} onClick={() => fetchRoute(selInc)}>
                          Calculate Route
                        </button>
                      )}
                      {routeLoading[selInc.id] && (
                        <div style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: '#64748b' }}>
                          <span className="spinner" />Calculating route...
                        </div>
                      )}
                      {routeInfo[selInc.id] && !routeLoading[selInc.id] && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          {[['Distance', `${routeInfo[selInc.id].distKm} km`], ['ETA', `${routeInfo[selInc.id].etaMins} min`]].map(([l, v]) => (
                            <div key={l} style={{ background: '#f8fafc', borderRadius: '0.5rem', padding: '0.5rem', flex: 1, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{v}</div>
                              <div style={{ fontFamily: 'DM Mono', fontSize: '0.6rem', color: '#64748b' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <a href={`https://www.google.com/maps?q=${selInc.lat},${selInc.lon}&z=16`} target="_blank" rel="noopener noreferrer" className="maps-link">
                        Open in Google Maps
                      </a>
                    </div>
                  )}

                  {/* 3D Map Section */}
                  {selInc.phantomMap && selInc.phantomMap.walls?.length > 0 && (
                    <div className="rt-card" style={{ marginBottom: '1rem', borderColor: '#c084fc' }}>
                      <button
                        onClick={() => toggleMap(selInc.id)}
                        style={{
                          width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                          background: expandedId === selInc.id ? '#f5f3ff' : '#faf5ff',
                          color: '#9333ea', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between',
                        }}
                      >
                        <span>{expandedId === selInc.id ? 'Hide' : 'View'} Building Layout</span>
                        <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>{selInc.phantomMap.walls.length} walls</span>
                      </button>
                      {expandedId === selInc.id && (
                        <div style={{ marginTop: '1rem', animation: 'fadeUp 0.3s ease' }}>
                          <BuildingViewer3D
                            walls={selInc.phantomMap.walls}
                            doors={selInc.phantomMap.doors || []}
                            windows={selInc.phantomMap.windows || []}
                            markers={selInc.phantomMap.markers || []}
                            height={300}
                            showGrid={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Incident description */}
                  {selInc.description && (
                    <div className="rt-card" style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                      {selInc.description}
                    </div>
                  )}

                  {/* AI Assessment */}
                  <div className="rt-card" style={{ marginBottom: '1rem' }}>
                    <div className="rt-section-label">AI Resource Assessment</div>

                    {!selInc.aiAssessment && !aiLoading[selInc.id] && (
                      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                          {hasAI ? 'Run to get resource recommendations, severity score, and deployment plan.' : 'Running simulation assessment (add REACT_APP_GROQ_API_KEY for real AI).'}
                        </div>
                        <button className="action-btn btn-blue" onClick={() => runAI(selInc)} style={{ width: '100%' }}>
                          {hasAI ? 'Run Assessment' : 'Run Simulation Assessment'}
                        </button>
                      </div>
                    )}

                    {aiLoading[selInc.id] && (
                      <div style={{ textAlign: 'center', padding: '0.75rem', fontFamily: 'DM Mono', fontSize: '0.75rem', color: '#3b82f6' }}>
                        <span className="spinner" />AI analyzing incident...
                      </div>
                    )}

                    {selInc.aiAssessment && !aiLoading[selInc.id] && (() => {
                      const ai = selInc.aiAssessment;
                      const shortages = checkResourceAvailability(ai);

                      return (
                        <>
                          {/* Severity reason */}
                          <div style={{ background: '#f8fafc', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                            <span style={{ color: SEV_COLORS[ai.severity_label] || '#0f172a', fontWeight: 600 }}>{ai.severity_label} ({ai.severity_score}/10): </span>
                            {ai.severity_reason}
                          </div>

                          {/* Priority action */}
                          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.6 }}>
                            <strong style={{ color: '#ef4444' }}>Priority Action:</strong> {ai.priority_action}
                          </div>

                          {/* Resource availability warning */}
                          {shortages.length > 0 && (
                            <div className="warning-box">
                              <span className="warning-icon">⚠️</span>
                              <div>
                                <strong>Resource Shortage Detected!</strong>
                                <ul className="shortage-list" style={{ marginTop: '0.5rem' }}>
                                  {shortages.map(s => (
                                    <li key={s.type}>
                                      Need {s.needed} {s.type.replace('_', ' ')}, only {s.available} available ({s.short} short)
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Recommended resources */}
                          <div className="rt-section-label" style={{ marginBottom: '0.75rem' }}>Recommended Deployment</div>
                          <div className="rec-grid" style={{ marginBottom: '0.75rem' }}>
                            {[
                              ['Ambulances', ai.recommended.ambulances, 'ambulance'],
                              ['Fire Units', ai.recommended.fire_units, 'fire_unit'],
                              ['Helicopters', ai.recommended.helicopters, 'helicopter'],
                              ['Rescue Boats', ai.recommended.rescue_boats, 'rescue_boat'],
                              ['Personnel', ai.recommended.personnel, null],
                            ].map(([label, count, type]) => {
                              const avail = type ? resources.filter(r => r.type === type && r.status === 'Available').length : '—';
                              const shortage = type && count > avail;
                              return (
                                <div key={label} className="rec-box" style={{ borderColor: shortage ? '#fecaca' : '#e2e8f0' }}>
                                  <div className="rec-num" style={{ color: shortage ? '#ef4444' : '#0f172a' }}>{count}</div>
                                  <div className="rec-lbl">{label}</div>
                                  {type && <div style={{ fontFamily: 'DM Mono', fontSize: '0.55rem', color: shortage ? '#ef4444' : '#22c55e', marginTop: '0.25rem' }}>{avail} avail</div>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Est duration */}
                          <div style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>
                            Estimated duration: <span style={{ color: '#0f172a', fontWeight: 600 }}>{ai.estimated_duration_hrs}h</span>
                          </div>

                          {/* Special notes */}
                          {ai.special_notes && <div className="note-box">⚠ {ai.special_notes}</div>}

                          {/* Deploy button - disabled if shortages */}
                          {selInc.status !== 'resolved' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.7rem' }}>
                              {resources.filter(r => r.assignedTo === selInc.id).length > 0 && (
                                <button
                                  className="action-btn btn-green"
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                  onClick={() => resolveAndRecall(selInc)}
                                >
                                  ✅ Mission Complete: Resolve & Recall
                                </button>
                              )}

                              <button
                                className={`action-btn ${shortages.length > 0 ? 'btn-red' : 'btn-blue'}`}
                                style={{ width: '100%', opacity: shortages.length > 0 ? 0.8 : 1 }}
                                onClick={() => {
                                  if (shortages.length > 0) {
                                    setDeployWarning({ incident: selInc, shortages, rec: ai });
                                  } else {
                                    setDeployModal({
                                      id: selInc.id,
                                      recommended: { ...ai.recommended }
                                    });
                                  }
                                }}
                              >
                                {shortages.length > 0
                                  ? `⚠️ Insufficient Resources (${shortages.length} shortage${shortages.length > 1 ? 's' : ''})`
                                  : resources.filter(r => r.assignedTo === selInc.id).length > 0
                                    ? `🚑 Dispatch Additional Resources`
                                    : `🚑 Deploy Recommended Resources (${ai.recommended.ambulances + ai.recommended.fire_units + ai.recommended.helicopters + ai.recommended.rescue_boats} units)`}
                              </button>
                            </div>
                          )}
                          <button className="action-btn btn-ghost" style={{ width: '100%', marginTop: '0.5rem' }}
                            onClick={() => runAI(selInc)}>
                            Re-run Assessment
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Officer Actions */}
                  <div className="rt-card" style={{ marginBottom: '1rem' }}>
                    <div className="rt-section-label">Incident Control</div>
                    <div className="incident-actions">
                      {getActions(selInc).map(a => (
                        <button key={a.status} className={`action-btn ${a.className}`} style={{ borderRadius: '0.5rem' }}
                          onClick={() => setConfirmAction({ id: selInc.id, status: a.status, typeName: selInc.incidentType })}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currently deployed to this incident */}
                  {resources.filter(r => r.assignedTo === selInc.id).length > 0 && (
                    <div className="rt-card">
                      <div className="rt-section-label">Deployed to This Incident</div>
                      {resources.filter(r => r.assignedTo === selInc.id).map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.85rem' }}>{r.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ background: `${STATUS_COLORS[r.status]}15`, color: STATUS_COLORS[r.status], borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 600 }}>{r.status}</span>
                            <button className="action-btn btn-ghost" style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }} onClick={() => recallResource(r.id)}>
                              Recall
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: RESOURCES ══════════════════════════════════════════════ */}
        {tab === 'resources' && (
          <div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {Object.entries(counts).filter(([, v]) => v > 0 || ['Available', 'Deployed'].includes(String(v))).map(([s, n]) => (
                <div key={s} className="rt-card" style={{ textAlign: 'center', padding: '1rem', borderTop: `2px solid ${STATUS_COLORS[s] || '#64748b'}` }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: STATUS_COLORS[s] || '#0f172a' }}>{n}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s}</div>
                </div>
              ))}
            </div>

            {/* Resource list */}
            {['ambulance', 'fire_unit', 'helicopter', 'rescue_boat'].map(type => {
              const group = resources.filter(r => r.type === type);
              const labels = { ambulance: 'Ambulances', fire_unit: 'Fire Units', helicopter: 'Helicopters', rescue_boat: 'Rescue Boats' };
              return (
                <div key={type} style={{ marginBottom: '1.5rem' }}>
                  <div className="rt-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{labels[type]}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleRemoveResource(type)}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '0.25rem', padding: '0.2rem 0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                        title="Remove Unit"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAddResource(type)}
                        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#22c55e', borderRadius: '0.25rem', padding: '0.2rem 0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                        title="Add Unit"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {group.map(r => (
                    <div key={r._id || r.id} className="rt-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                          📍 {r.zone}
                          {r.assignedTo && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>→ Incident {String(r.assignedTo).slice(-4)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ background: `${STATUS_COLORS[r.status]}15`, color: STATUS_COLORS[r.status], borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.7rem', fontWeight: 600 }}>
                          {r.status}
                        </span>
                        {(r.status === 'En Route' || r.status === 'Deployed') && (
                          <button className="action-btn btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem' }} onClick={() => recallResource(r._id || r.id)}>
                            Recall
                          </button>
                        )}
                        {r.status === 'Available' && (
                          <button className="action-btn btn-red" style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem' }}
                            onClick={async () => {
                              try {
                                await resourceAPI.update(r._id || r.id, { status: 'Deployed', zone: 'Zone-Manual' });
                                loadResources();
                                showToast(`${r.name} manually deployed`);
                              } catch (err) {
                                showToast('Error deploying');
                              }
                            }}>
                            Deploy
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ DEPLOY CONFIRM MODAL ════════════════════════════════════════ */}
        {deployModal && (() => {
          const inc = incidents.find(i => i.id === deployModal.id);
          const ai = inc?.aiAssessment;
          if (!inc || !ai) return null;

          const counts = deployModal.recommended;

          const adjust = (key, delta) => {
            const current = counts[key] || 0;
            const next = Math.max(0, current + delta);

            // Availability check
            if (delta > 0) {
              const types = { ambulances: 'ambulance', fire_units: 'fire_unit', helicopters: 'helicopter', rescue_boats: 'rescue_boat' };
              const type = types[key];
              if (type) {
                const avail = resources.filter(r => r.type === type && r.status === 'Available').length;
                if (next > avail) {
                  showToast(`⚠️ No more ${type.replace('_', ' ')} available`);
                  return;
                }
              }
            }

            setDeployModal({
              ...deployModal,
              recommended: { ...counts, [key]: next }
            });
          };

          const totalUnits = counts.ambulances + counts.fire_units + counts.helicopters + counts.rescue_boats;

          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#0a0f1a', border: '2px solid rgba(59,130,246,.35)', borderRadius: 16, padding: '1.6rem', maxWidth: 450, width: '100%', animation: 'fadeUp .2s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed', fontSize: '1.4rem', fontWeight: 800 }}>Dispatch Setup</div>
                    <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{inc.name || inc.incidentType}</div>
                  </div>
                  <div style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '4px 10px', borderRadius: 8, fontSize: '.7rem', fontWeight: 700, fontFamily: 'Share Tech Mono' }}>
                    {ai.severity_label}
                  </div>
                </div>

                <div style={{ fontSize: '.85rem', color: '#94a3b8', marginBottom: '1.2rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: 10 }}>
                  Review and adjust resources for approximately <span style={{ color: '#fff', fontWeight: 600 }}>{ai.estimated_people_affected} affected people</span>.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
                  {[
                    ['🚑', 'Ambulances', 'ambulances'],
                    ['🚒', 'Fire Units', 'fire_units'],
                    ['🚁', 'Helicopters', 'helicopters'],
                    ['⛵', 'Rescue Boats', 'rescue_boats'],
                  ].map(([icon, label, key]) => (
                    <div key={key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '.7rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: '.65rem', color: '#475569' }}>AI suggested: {ai.recommended[key]}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                        <button onClick={() => adjust(key, -1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>-</button>
                        <span style={{ fontFamily: 'Share Tech Mono', fontSize: '1.1rem', fontWeight: 700, width: 25, textAlign: 'center' }}>{counts[key]}</span>
                        <button onClick={() => adjust(key, 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="action-btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeployModal(null)}>Cancel</button>
                  <button className="action-btn btn-blue" style={{ flex: 2 }} onClick={() => deployResources(inc, counts)}>
                    Dispatch {totalUnits} Units
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ DEPLOY WARNING MODAL ═══════════════════════════════════ */}
        {deployWarning && (
          <div className="confirm-overlay" onClick={() => setDeployWarning(null)}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()} style={{ borderColor: '#fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>⚠️</span>
                <h3 style={{ margin: 0, color: '#ef4444' }}>Insufficient Resources</h3>
              </div>
              <p style={{ color: '#475569', marginBottom: '1.25rem' }}>
                Cannot deploy recommended resources for <strong>{deployWarning.incident.incidentType}</strong>. The following units are unavailable:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                {deployWarning.shortages.map(s => (
                  <li key={s.type} style={{
                    padding: '0.75rem',
                    background: '#fef2f2',
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem',
                  }}>
                    <div style={{ fontWeight: 600, color: '#b91c1c' }}>
                      {s.type.replace('_', ' ')}: Need {s.needed}, have {s.available}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Short by {s.short} unit{s.short > 1 ? 's' : ''}
                    </div>
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="action-btn btn-red"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setDeployWarning(null);
                    setTab('resources');
                  }}
                >
                  View Resources
                </button>
                <button
                  className="action-btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => setDeployWarning(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ OFFICER CONTROL CONFIRM MODAL ════════════════════════════════ */}
        {confirmAction && (
          <div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <h3>{statusLabels[confirmAction.status]?.title || 'Confirm Action'}</h3>
              <p>{statusLabels[confirmAction.status]?.desc}</p>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                Incident: <strong style={{ color: '#0f172a' }}>{confirmAction.typeName}</strong>
              </div>
              <div className="confirm-actions">
                <button className="action-btn btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button
                  className={`action-btn ${confirmAction.status === 'cancelled' ? 'btn-red' : confirmAction.status === 'resolved' ? 'btn-green' : 'btn-blue'}`}
                  onClick={handleStatusUpdate}
                >
                  {confirmAction.status === 'responding' && 'Deploy'}
                  {confirmAction.status === 'resolved' && 'Resolve'}
                  {confirmAction.status === 'cancelled' && 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}