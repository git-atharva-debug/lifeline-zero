// src/components/bottleneck/CommandBottleneck.jsx
// Command Mode — Authority + Incident GPS → 3 Dynamic Routes
// Realistic: shortest route = most dangerous + most congested (damaged road + panic traffic)

import { useState, useCallback, useRef } from 'react';
import api from '../../services/api';

// ─── Constants ──────────────────────────────────────────────
const DISASTER_META = {
  flood:      { label: 'Flood',            emoji: '🌊', color: '#3b82f6' },
  fire:       { label: 'Fire / Wildfire',  emoji: '🔥', color: '#ef4444' },
  earthquake: { label: 'Earthquake',       emoji: '🌍', color: '#f97316' },
  hurricane:  { label: 'Hurricane',        emoji: '🌀', color: '#8b5cf6' },
  chemical:   { label: 'Chemical/HAZMAT',  emoji: '☣️', color: '#10b981' },
  unknown:    { label: 'General Emergency',emoji: '🚨', color: '#64748b' },
};

const ROUTE_STYLE = {
  safe:      { color: '#16a34a', lightBg: '#f0fdf4', border: '#86efac', badgeBg: '#15803d', icon: '✅', tagLabel: 'SAFE ROUTE'      },
  moderate:  { color: '#d97706', lightBg: '#fffbeb', border: '#fcd34d', badgeBg: '#b45309', icon: '⚡', tagLabel: 'MODERATE RISK'   },
  dangerous: { color: '#dc2626', lightBg: '#fef2f2', border: '#fca5a5', badgeBg: '#991b1b', icon: '⚠️', tagLabel: 'HIGH DANGER'     },
};

function getCongColor(p) {
  if (p >= 80) return '#dc2626';
  if (p >= 60) return '#f97316';
  if (p >= 40) return '#eab308';
  return '#16a34a';
}

function getSevStyle(sev) {
  return ({
    Critical: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    High:     { background: '#fed7aa', color: '#9a3412', border: '1px solid #fdba74' },
    Moderate: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    Low:      { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  })[sev] || { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
}

// ─── Map Component ───────────────────────────────────────────
function CommandRouteMap({ authorityLocation, incidentLocation, routes, disasterType }) {
  const mapRef   = useRef(null);
  const mapInst  = useRef(null);
  const layerRef = useRef([]);
  const meta     = DISASTER_META[disasterType] || DISASTER_META.unknown;

  const buildMap = useCallback((node) => {
    if (!node) return;
    const L = window.L;
    if (!L) return;

    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

    const cLat = authorityLocation?.lat || incidentLocation?.lat || 20.59;
    const cLng = authorityLocation?.lng || incidentLocation?.lng || 78.96;
    mapInst.current = L.map(node, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(mapInst.current);
    layerRef.current = [];
    const add = l => { l.addTo(mapInst.current); layerRef.current.push(l); return l; };
    const allPts = [];

    // Authority marker
    if (authorityLocation?.lat) {
      const icon = L.divIcon({
        html: `<div style="background:#1d4ed8;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 12px rgba(29,78,216,0.5)">🎖️</div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 20],
      });
      add(L.marker([authorityLocation.lat, authorityLocation.lng], { icon, zIndexOffset: 1000 })
        .bindPopup(`<b style="color:#1d4ed8">🎖️ Authority Position</b><br/>${authorityLocation.address}<br/><small>${authorityLocation.lat.toFixed(5)}, ${authorityLocation.lng.toFixed(5)}</small>`));
      allPts.push([authorityLocation.lat, authorityLocation.lng]);
    }

    // Incident marker
    if (incidentLocation?.lat) {
      const icon = L.divIcon({
        html: `<div style="background:#dc2626;color:white;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 3px 14px rgba(220,38,38,0.6);">${meta.emoji}</div>`,
        className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      });
      add(L.marker([incidentLocation.lat, incidentLocation.lng], { icon, zIndexOffset: 1000 })
        .bindPopup(`<b style="color:#dc2626">🚨 Incident Site</b><br/>${incidentLocation.address}<br/><small>${incidentLocation.lat.toFixed(5)}, ${incidentLocation.lng.toFixed(5)}</small>`));
      allPts.push([incidentLocation.lat, incidentLocation.lng]);
    }

    // Route lines + labels
    const lineStyle = {
      safe:      { color: '#16a34a', weight: 7, dash: null,    opacity: 0.90 },
      moderate:  { color: '#d97706', weight: 5, dash: '10 5',  opacity: 0.85 },
      dangerous: { color: '#dc2626', weight: 4, dash: '6 6',   opacity: 0.80 },
    };

    routes?.forEach(route => {
      if (!route.waypoints?.length) return;
      const pts   = route.waypoints.map(p => [p.lat, p.lng]);
      const style = lineStyle[route.type] || lineStyle.moderate;
      const rs    = ROUTE_STYLE[route.type] || ROUTE_STYLE.moderate;

      const poly = add(L.polyline(pts, {
        color: style.color, weight: style.weight,
        opacity: style.opacity, dashArray: style.dash,
        lineJoin: 'round', lineCap: 'round',
      }));

      poly.bindPopup(`
        <div style="font-family:sans-serif;min-width:220px">
          <div style="background:${style.color};color:white;padding:6px 10px;margin:-8px -8px 8px -8px;border-radius:4px 4px 0 0;font-weight:700">${rs.icon} ${rs.tagLabel}</div>
          <b>${route.name}</b><br/>
          <span style="color:#64748b;font-size:11px">${route.description}</span><br/><br/>
          <table style="font-size:12px;width:100%;border-collapse:collapse">
            <tr><td style="padding:2px 4px;color:#64748b">Safety</td><td style="padding:2px 4px;font-weight:700;color:${style.color}">${route.safetyScore}/100</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b">Congestion</td><td style="padding:2px 4px;font-weight:700;color:${getCongColor(route.congestionRiskPercent)}">${route.congestionRiskPercent}%</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b">Distance</td><td style="padding:2px 4px;font-weight:700">${route.distanceKm} km</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b">Travel time</td><td style="padding:2px 4px;font-weight:700">~${route.estimatedTravelMinutes} min</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b">Traffic share</td><td style="padding:2px 4px;font-weight:700">${route.trafficShare}% of evacuees</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b">Overload</td><td style="padding:2px 4px;font-weight:700">${route.overloadRatio}x</td></tr>
            ${route.riskReason ? `<tr><td colspan="2" style="padding:4px;color:#dc2626;font-size:11px">⚠️ ${route.riskReason}</td></tr>` : ''}
          </table>
        </div>
      `);

      // Route label at midpoint
      const mid = pts[Math.floor(pts.length / 2)] || pts[0];
      const labelIcon = L.divIcon({
        html: `<div style="background:${style.color};color:white;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:1.5px solid white;pointer-events:none">${rs.icon} ${route.name}</div>`,
        className: '', iconSize: [200, 22], iconAnchor: [100, 11],
      });
      add(L.marker(mid, { icon: labelIcon, zIndexOffset: 400, interactive: false }));

      pts.forEach(p => allPts.push(p));
    });

    if (allPts.length >= 2) {
      try { mapInst.current.fitBounds(allPts, { padding: [45, 45], maxZoom: 14 }); }
      catch (_) { mapInst.current.setView([cLat, cLng], 11); }
    } else {
      mapInst.current.setView([cLat, cLng], 11);
    }
  }, [authorityLocation, incidentLocation, routes, disasterType, meta]);

  const refCb = useCallback((node) => {
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
    mapRef.current = node;
    if (node) buildMap(node);
  }, [buildMap]);

  if (typeof window === 'undefined' || !window.L) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', textAlign: 'center', padding: '1.5rem', gap: '0.5rem' }}>
        <p style={{ fontSize: '2rem' }}>🗺️</p>
        <p style={{ color: '#475569', fontWeight: 600 }}>Map requires Leaflet.js</p>
        <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Add to public/index.html &lt;head&gt;:</p>
        <code style={{ background: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', display: 'block' }}>
          &lt;link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/&gt;
        </code>
        <code style={{ background: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', display: 'block' }}>
          &lt;script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"&gt;&lt;/script&gt;
        </code>
      </div>
    );
  }
  return <div ref={refCb} style={{ height: '100%', width: '100%', borderRadius: '0 0 8px 8px' }} />;
}

// ─── Congestion Bar ──────────────────────────────────────────
function CBar({ value }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 999, height: 8, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: getCongColor(value), borderRadius: 999, transition: 'width 0.4s' }} />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function CommandBottleneck() {
  const [form, setForm] = useState({
    authorityLatitude: '', authorityLongitude: '', authorityAddress: '',
    incidentLatitude:  '', incidentLongitude:  '', incidentAddress:  '',
    affectedPopulation: 5000,
    disasterIntensity: 6,
    disasterType: 'unknown',
    evacuationLoad: 50,
    roadCapacityMultiplier: 'normal',
    timeOfDay: 'day',
  });

  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [hasRun,      setHasRun]      = useState(false);
  const [authGps,     setAuthGps]     = useState(false);
  const [incGps,      setIncGps]      = useState(false);
  const [expandRoute, setExpandRoute] = useState(null);
  const debRef = useRef(null);

  const meta = DISASTER_META[form.disasterType] || DISASTER_META.unknown;

  const authReady = form.authorityLatitude && form.authorityLongitude
    && !isNaN(+form.authorityLatitude) && !isNaN(+form.authorityLongitude);
  const incReady  = form.incidentLatitude  && form.incidentLongitude
    && !isNaN(+form.incidentLatitude) && !isNaN(+form.incidentLongitude);
  const bothReady = authReady && incReady;

  // ── API call ─────────────────────────────────────────────
  const runSim = useCallback(async (f) => {
    if (!f.authorityLatitude || !f.incidentLatitude) return;
    try {
      setLoading(true); setError(null);
      const res = await api.post('/bottleneck/command', {
        authorityLatitude:     +f.authorityLatitude,
        authorityLongitude:    +f.authorityLongitude,
        authorityAddress:       f.authorityAddress || '',
        incidentLatitude:      +f.incidentLatitude,
        incidentLongitude:     +f.incidentLongitude,
        incidentAddress:        f.incidentAddress || '',
        affectedPopulation:    +f.affectedPopulation,
        disasterIntensity:     +f.disasterIntensity,
        disasterType:           f.disasterType,
        evacuationLoad:        +f.evacuationLoad,
        roadCapacityMultiplier: f.roadCapacityMultiplier,
        timeOfDay:              f.timeOfDay,
      });
      if (res.data?.success) { setResult(res.data); setHasRun(true); }
      else { setError(res.data?.message || 'Simulation failed'); setResult(null); }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Backend unreachable');
      setResult(null);
    } finally { setLoading(false); }
  }, []);

  const debounce = useCallback((f) => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => runSim(f), 900);
  }, [runSim]);

  const set = (field, val) => setForm(prev => {
    const next = { ...prev, [field]: val };
    const isScenario = !['authorityLatitude','authorityLongitude','authorityAddress',
                         'incidentLatitude','incidentLongitude','incidentAddress'].includes(field);
    if (isScenario && hasRun) debounce(next);
    return next;
  });

  const parsePaste = (raw, lf, lnf) => {
    const m = raw.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (m) setForm(p => ({ ...p, [lf]: +m[1], [lnf]: +m[2] }));
  };

  const gpsFor = (latF, lngF, addrF, setLoading_) => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    setLoading_(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLoading_(false);
        setForm(p => ({ ...p, [latF]: coords.latitude, [lngF]: coords.longitude, [addrF]: `GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` }));
      },
      err => { setLoading_(false); alert('GPS error: ' + err.message); }
    );
  };

  const inp = { width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem', background: 'white', boxSizing: 'border-box' };
  const lab = { display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#475569' };

  const sim    = result?.simulation;
  const routes = sim?.routes || [];

  return (
    <div className="page" style={{ maxWidth: '1440px' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.4rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.2rem' }}>🚨 Evacuation Command Center</h1>
        <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
          Enter <strong>your position</strong> + <strong>incident GPS</strong> (from civilian alert) → system computes 3 routes with realistic congestion.<br/>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            ℹ️ Route safety is based on: road capacity after disaster damage, traffic load, distance through hazard zone, and time of day.
          </span>
        </p>
      </div>

      {/* ── Location Inputs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>

        {/* Authority */}
        <div className="card" style={{ borderLeft: '4px solid #1d4ed8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1d4ed8' }}>🎖️ Your Current Position</h2>
            <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.45rem', borderRadius: '3px', fontWeight: 600, border: '1px solid #bfdbfe' }}>AUTHORITY</span>
          </div>
          <div style={{ marginBottom: '0.7rem' }}>
            <label style={lab}>Paste coordinates (lat, lng) — press Enter</label>
            <input type="text" placeholder="e.g. 28.6139, 77.2090"
              onBlur={e => parsePaste(e.target.value,'authorityLatitude','authorityLongitude')}
              onKeyDown={e => e.key==='Enter' && parsePaste(e.target.value,'authorityLatitude','authorityLongitude')}
              style={{ ...inp, borderStyle:'dashed', background:'#f8faff' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'0.7rem' }}>
            <div>
              <label style={lab}>Latitude</label>
              <input type="number" step="0.0001" placeholder="28.6139" value={form.authorityLatitude}
                onChange={e => setForm(p=>({...p,authorityLatitude:e.target.value}))}
                style={{ ...inp, borderColor: authReady ? '#86efac' : '#cbd5e1' }} />
            </div>
            <div>
              <label style={lab}>Longitude</label>
              <input type="number" step="0.0001" placeholder="77.2090" value={form.authorityLongitude}
                onChange={e => setForm(p=>({...p,authorityLongitude:e.target.value}))}
                style={{ ...inp, borderColor: authReady ? '#86efac' : '#cbd5e1' }} />
            </div>
          </div>
          <div style={{ marginBottom:'0.7rem' }}>
            <label style={lab}>Label (optional)</label>
            <input type="text" placeholder="e.g. District Police HQ" value={form.authorityAddress}
              onChange={e => setForm(p=>({...p,authorityAddress:e.target.value}))} style={inp} />
          </div>
          <button onClick={() => gpsFor('authorityLatitude','authorityLongitude','authorityAddress',setAuthGps)} disabled={authGps}
            style={{ width:'100%', padding:'0.55rem', background: authGps?'#94a3b8':'#1d4ed8', color:'white', border:'none', borderRadius:'6px', fontWeight:600, cursor: authGps?'not-allowed':'pointer', fontSize:'0.85rem' }}>
            {authGps ? '⏳ Getting GPS…' : '📍 Use My Current GPS'}
          </button>
          {authReady && <p style={{ marginTop:'0.4rem', fontSize:'0.72rem', color:'#16a34a', textAlign:'center' }}>✅ {(+form.authorityLatitude).toFixed(5)}, {(+form.authorityLongitude).toFixed(5)}</p>}
        </div>

        {/* Incident */}
        <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.9rem' }}>
            <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#dc2626' }}>{meta.emoji} Incident Location</h2>
            <span style={{ fontSize:'0.68rem', background:'#fef2f2', color:'#dc2626', padding:'0.15rem 0.45rem', borderRadius:'3px', fontWeight:600, border:'1px solid #fecaca' }}>FROM ALERT</span>
          </div>
          <div style={{ marginBottom:'0.7rem' }}>
            <label style={lab}>Paste civilian GPS (lat, lng) — press Enter</label>
            <input type="text" placeholder="e.g. 19.0760, 72.8777"
              onBlur={e => parsePaste(e.target.value,'incidentLatitude','incidentLongitude')}
              onKeyDown={e => e.key==='Enter' && parsePaste(e.target.value,'incidentLatitude','incidentLongitude')}
              style={{ ...inp, borderStyle:'dashed', background:'#fff8f8', borderColor:'#fca5a5' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'0.7rem' }}>
            <div>
              <label style={lab}>Latitude</label>
              <input type="number" step="0.0001" placeholder="19.0760" value={form.incidentLatitude}
                onChange={e => setForm(p=>({...p,incidentLatitude:e.target.value}))}
                style={{ ...inp, borderColor: incReady ? '#86efac' : '#cbd5e1' }} />
            </div>
            <div>
              <label style={lab}>Longitude</label>
              <input type="number" step="0.0001" placeholder="72.8777" value={form.incidentLongitude}
                onChange={e => setForm(p=>({...p,incidentLongitude:e.target.value}))}
                style={{ ...inp, borderColor: incReady ? '#86efac' : '#cbd5e1' }} />
            </div>
          </div>
          <div style={{ marginBottom:'0.7rem' }}>
            <label style={lab}>Label (optional)</label>
            <input type="text" placeholder="e.g. Flooded market area, Sector 12" value={form.incidentAddress}
              onChange={e => setForm(p=>({...p,incidentAddress:e.target.value}))} style={inp} />
          </div>
          <button onClick={() => gpsFor('incidentLatitude','incidentLongitude','incidentAddress',setIncGps)} disabled={incGps}
            style={{ width:'100%', padding:'0.55rem', background: incGps?'#94a3b8':'#dc2626', color:'white', border:'none', borderRadius:'6px', fontWeight:600, cursor: incGps?'not-allowed':'pointer', fontSize:'0.85rem' }}>
            {incGps ? '⏳ Getting GPS…' : '📍 Use GPS as Incident Site'}
          </button>
          {incReady && <p style={{ marginTop:'0.4rem', fontSize:'0.72rem', color:'#16a34a', textAlign:'center' }}>✅ {(+form.incidentLatitude).toFixed(5)}, {(+form.incidentLongitude).toFixed(5)}</p>}
        </div>
      </div>

      {/* ── Scenario Params ── */}
      <div className="card" style={{ borderLeft:`4px solid ${meta.color}`, marginBottom:'1.1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.9rem', flexWrap:'wrap', gap:'0.5rem' }}>
          <h2 style={{ fontSize:'0.95rem', fontWeight:600 }}>
            {meta.emoji} Disaster Parameters
            {hasRun && <span style={{ fontSize:'0.7rem', color:'#94a3b8', fontWeight:400, marginLeft:'0.4rem' }}>— auto-updates on change</span>}
          </h2>
          <button onClick={() => runSim(form)} disabled={!bothReady || loading}
            style={{ padding:'0.55rem 1.5rem', fontWeight:700, fontSize:'0.9rem',
              background: !bothReady ? '#94a3b8' : meta.color, color:'white', border:'none',
              borderRadius:'6px', cursor: !bothReady?'not-allowed':'pointer',
              boxShadow: bothReady ? `0 3px 10px ${meta.color}40` : 'none' }}>
            {loading ? '⏳ Computing…' : '▶ Run Simulation'}
          </button>
        </div>

        {!bothReady && (
          <div style={{ padding:'0.5rem 0.75rem', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'5px', marginBottom:'0.9rem', fontSize:'0.8rem', color:'#92400e' }}>
            ⚠️ {!authReady && !incReady ? 'Enter both your position and the incident location' : !authReady ? 'Enter your authority GPS position (left card)' : 'Enter the incident GPS location (right card)'}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px,1fr))', gap:'1rem' }}>
          <div>
            <label style={lab}>Disaster Type</label>
            <select value={form.disasterType} onChange={e=>set('disasterType',e.target.value)} style={inp}>
              <option value="unknown">🚨 General Emergency</option>
              <option value="flood">🌊 Flood</option>
              <option value="fire">🔥 Fire / Wildfire</option>
              <option value="earthquake">🌍 Earthquake</option>
              <option value="hurricane">🌀 Hurricane / Cyclone</option>
              <option value="chemical">☣️ Chemical / HAZMAT</option>
            </select>
          </div>
          <div>
            <label style={lab}>Disaster Intensity: <b style={{ color: meta.color }}>{form.disasterIntensity}/10</b>
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', marginLeft:'0.4rem' }}>
                {form.disasterIntensity >= 8 ? '— Catastrophic (severely degrades roads)' : form.disasterIntensity >= 6 ? '— Severe' : '— Moderate'}
              </span>
            </label>
            <input type="range" min="1" max="10" step="0.5" value={form.disasterIntensity}
              onChange={e=>set('disasterIntensity',+e.target.value)} style={{ width:'100%', accentColor: meta.color }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.67rem', color:'#94a3b8' }}><span>Minor</span><span>Catastrophic</span></div>
          </div>
          <div>
            <label style={lab}>Time of Day
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', marginLeft:'0.4rem' }}>— night reduces capacity & increases panic</span>
            </label>
            <select value={form.timeOfDay} onChange={e=>set('timeOfDay',e.target.value)} style={inp}>
              <option value="day">☀️ Daytime</option>
              <option value="night">🌙 Night (−28% road capacity, +25% panic)</option>
              <option value="3AM">🌑 3 AM (worst: max panic)</option>
            </select>
          </div>
          <div>
            <label style={lab}>Affected Population
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', marginLeft:'0.4rem' }}>— more people = more congestion on all routes</span>
            </label>
            <input type="number" min="100" max="500000" step="500" value={form.affectedPopulation}
              onChange={e=>set('affectedPopulation',+e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lab}>Evacuation Rate (ppl/min)
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', marginLeft:'0.4rem' }}>— system throughput</span>
            </label>
            <input type="number" min="5" max="500" step="5" value={form.evacuationLoad}
              onChange={e=>set('evacuationLoad',+e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lab}>Road Condition
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', marginLeft:'0.4rem' }}>— affects ALL road capacities</span>
            </label>
            <select value={form.roadCapacityMultiplier} onChange={e=>set('roadCapacityMultiplier',e.target.value)} style={inp}>
              <option value="normal">✅ Normal (100%)</option>
              <option value="damaged">⚠️ Disaster Damaged (55%)</option>
              <option value="restricted">🚫 Restricted / Blocked (32%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="card" style={{ borderLeft:`4px solid ${meta.color}`, textAlign:'center', padding:'1.5rem', marginBottom:'1.1rem' }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.3rem' }}>⏳</div>
          <p style={{ color: meta.color, fontWeight:600 }}>Computing 3 evacuation routes for {meta.emoji} {meta.label} scenario…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="card" style={{ borderLeft:'4px solid #ef4444', background:'#fef2f2', padding:'1rem', marginBottom:'1.1rem' }}>
          <p style={{ fontWeight:700, color:'#991b1b', marginBottom:'0.25rem' }}>❌ Error</p>
          <p style={{ color:'#7f1d1d', fontSize:'0.88rem', marginBottom:'0.5rem' }}>{error}</p>
          <button onClick={()=>runSim(form)} style={{ padding:'0.4rem 0.9rem', background:'#ef4444', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:600 }}>🔄 Retry</button>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && !error && result && sim && (
        <>
          {/* Context banner */}
          <div style={{ padding:'0.8rem 1.1rem', borderRadius:'8px', marginBottom:'1.1rem', background:`${meta.color}10`, border:`2px solid ${meta.color}30`, display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:'0.7rem', color:'#94a3b8', textTransform:'uppercase', fontWeight:600 }}>Authority → Incident</p>
              <p style={{ fontWeight:700, fontSize:'0.95rem' }}>🎖️ {result.authorityLocation?.address} <span style={{ color:'#94a3b8' }}>→</span> 🚨 {result.incidentLocation?.address}</p>
              <p style={{ fontSize:'0.78rem', color:'#64748b' }}>
                Direct: <b>{result.routeSummary?.directDistanceKm} km</b> | Bearing: <b>{result.routeSummary?.bearingDegrees}°</b> ({result.routeSummary?.directionLabel}) | Effective demand: <b>{sim.effectiveDemand?.toLocaleString()} people</b>
              </p>
            </div>
            <div style={{ display:'flex', gap:'1.2rem', flexWrap:'wrap' }}>
              {[
                { l:'Panic Mult', v:`${sim.panicMultiplier}x`, c: sim.panicMultiplier>1.4?'#ef4444':'#f97316' },
                { l:'Network Cong.', v:`${sim.networkCongestionPercent}%`, c: getCongColor(sim.networkCongestionPercent) },
                { l:'Evac Time', v:`${sim.totalEvacuationTimeMinutes}min`, c: meta.color },
                { l:'Confidence', v:`${sim.confidenceLevel}%`, c:'#16a34a' },
              ].map((m,i)=>(
                <div key={i} style={{ textAlign:'center' }}>
                  <p style={{ fontSize:'0.67rem', color:'#94a3b8' }}>{m.l}</p>
                  <p style={{ fontWeight:700, fontSize:'1.1rem', color:m.c }}>{m.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 3 Route Cards ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1.1rem' }}>
            {routes.map(route => {
              const rs = ROUTE_STYLE[route.type] || ROUTE_STYLE.moderate;
              const isRec = route.type === 'safe';
              const expanded = expandRoute === route.id;
              return (
                <div key={route.id} style={{ borderRadius:'10px', border:`2px solid ${rs.border}`, background: rs.lightBg, position:'relative', overflow:'hidden' }}>
                  {isRec && (
                    <div style={{ position:'absolute', top:0, right:0, background:rs.color, color:'white', fontSize:'0.62rem', fontWeight:700, padding:'0.18rem 0.55rem', borderRadius:'0 8px 0 6px' }}>
                      ⭐ RECOMMENDED
                    </div>
                  )}

                  <div style={{ padding:'1rem' }}>
                    {/* Badge row */}
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.7rem' }}>
                      <span style={{ background:rs.badgeBg, color:'white', padding:'0.18rem 0.55rem', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>
                        {rs.icon} {rs.tagLabel}
                      </span>
                    </div>

                    {/* Route name */}
                    <p style={{ fontWeight:700, fontSize:'0.92rem', color:'#1e293b', lineHeight:1.3, marginBottom:'0.2rem' }}>{route.name}</p>
                    <p style={{ fontSize:'0.74rem', color:'#64748b', marginBottom:'0.8rem', lineHeight:1.4 }}>{route.description}</p>

                    {/* Risk reason */}
                    {route.riskReason && (
                      <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'5px', padding:'0.4rem 0.6rem', marginBottom:'0.75rem' }}>
                        <p style={{ fontSize:'0.71rem', color:'#991b1b', fontWeight:600 }}>⚠️ {route.riskReason}</p>
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem', marginBottom:'0.75rem' }}>
                      {[
                        { l:'Safety Score', v:`${route.safetyScore}/100`, c:rs.color, bold:true },
                        { l:'Distance', v:`${route.distanceKm} km` },
                        { l:'~Travel Time', v:`${route.estimatedTravelMinutes} min` },
                        { l:'Road Capacity', v:`${route.routeCapacity} units/min` },
                      ].map((m,i)=>(
                        <div key={i} style={{ background:'white', padding:'0.38rem 0.55rem', borderRadius:'5px', border:'1px solid #f1f5f9' }}>
                          <p style={{ fontSize:'0.65rem', color:'#94a3b8', marginBottom:'1px' }}>{m.l}</p>
                          <p style={{ fontWeight:m.bold?700:600, fontSize:'0.88rem', color:m.c||'#1e293b' }}>{m.v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Congestion + overload */}
                    <div style={{ marginBottom:'0.6rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', marginBottom:'3px' }}>
                        <span style={{ color:'#64748b' }}>Congestion ({route.trafficShare}% of evacuees)</span>
                        <span style={{ fontWeight:700, color:getCongColor(route.congestionRiskPercent) }}>{route.congestionRiskPercent}%</span>
                      </div>
                      <CBar value={route.congestionRiskPercent} />
                    </div>

                    <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ padding:'0.15rem 0.45rem', borderRadius:'4px', fontSize:'0.67rem', fontWeight:700, ...getSevStyle(route.severity) }}>{route.severity}</span>
                      <span style={{ fontSize:'0.71rem', color:'#64748b' }}>Overload: <b style={{ color: route.overloadRatio>1.5?'#ef4444':route.overloadRatio>1?'#f97316':'#16a34a' }}>{route.overloadRatio}x</b></span>
                      {route.timeToCongest != null && (
                        <span style={{ fontSize:'0.71rem', color:'#64748b', marginLeft:'auto' }}>Jams in: <b>{route.timeToCongest}m</b></span>
                      )}
                    </div>

                    {/* Expand: why this rating? */}
                    <button onClick={()=>setExpandRoute(expanded?null:route.id)}
                      style={{ marginTop:'0.65rem', width:'100%', padding:'0.35rem', background:'white', border:`1px solid ${rs.border}`, borderRadius:'5px', cursor:'pointer', fontSize:'0.73rem', color:rs.color, fontWeight:600 }}>
                      {expanded ? '▲ Hide explanation' : '▼ Why this rating?'}
                    </button>

                    {expanded && (
                      <div style={{ marginTop:'0.5rem', padding:'0.6rem', background:'white', borderRadius:'5px', border:`1px solid ${rs.border}`, fontSize:'0.75rem', color:'#475569', lineHeight:1.6 }}>
                        <b style={{ color:rs.color }}>Rating logic:</b> {route.rationale}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Map ── */}
          <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:'1.1rem' }}>
            <div style={{ padding:'0.65rem 1rem', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.4rem' }}>
              <span style={{ fontWeight:600, fontSize:'0.88rem' }}>🗺️ Live Route Map — click any route line for details</span>
              <div style={{ display:'flex', gap:'0.75rem', fontSize:'0.72rem', alignItems:'center' }}>
                <span>🎖️ You</span>
                <span>{meta.emoji} Incident</span>
                <span style={{ color:'#16a34a', fontWeight:600 }}>━ Safe</span>
                <span style={{ color:'#d97706', fontWeight:600 }}>╌ Moderate</span>
                <span style={{ color:'#dc2626', fontWeight:600 }}>╌ Dangerous</span>
              </div>
            </div>
            <div style={{ height:'400px' }}>
              <CommandRouteMap
                authorityLocation={result.authorityLocation}
                incidentLocation={result.incidentLocation}
                routes={routes}
                disasterType={form.disasterType}
              />
            </div>
          </div>

          {/* ── Cascade ── */}
          <div className="card" style={{ padding:'1rem', marginBottom:'1.1rem' }}>
            <h3 style={{ fontSize:'0.92rem', fontWeight:700, marginBottom:'0.75rem' }}>🔗 Cascade Risk — if a route fails</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'0.75rem' }}>
              {sim.cascadingRisk?.map((c,i)=>(
                <div key={i} style={{ padding:'0.75rem', background:'#fff7ed', borderRadius:'7px', border:'1px solid #fed7aa' }}>
                  <p style={{ fontSize:'0.8rem', fontWeight:700, color:'#9a3412', marginBottom:'0.4rem' }}>If <em>{c.failedRoute}</em> fails:</p>
                  {c.fallbackRoutes?.map((fb,j)=>(
                    <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.76rem', padding:'0.18rem 0', borderTop: j>0?'1px solid #fde8cc':'none' }}>
                      <span style={{ color:'#475569' }}>
                        <span style={{ background: ROUTE_STYLE[fb.type]?.badgeBg||'#64748b', color:'white', padding:'0.1rem 0.3rem', borderRadius:'2px', fontSize:'0.64rem', marginRight:'0.3rem' }}>{fb.type?.toUpperCase()}</span>
                        {fb.name}
                      </span>
                      <span style={{ fontWeight:600, color:'#9a3412' }}>+{fb.cascadeDelay}m | → {fb.newCongestion}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── AI Summary ── */}
          {result.aiSummary ? (
            <div className="card" style={{ borderLeft:`4px solid ${meta.color}`, background:`${meta.color}05`, padding:'1.4rem', borderRadius:'10px' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:700, marginBottom:'1rem' }}>
                🤖 AI Command Directive — {meta.emoji} {meta.label} | Intensity {form.disasterIntensity}/10
              </h2>

              {result.aiSummary.primaryCommand && (
                <div style={{ padding:'1rem', background:'white', borderRadius:'8px', border:`3px solid ${meta.color}`, marginBottom:'1rem', boxShadow:`0 3px 12px ${meta.color}18` }}>
                  <p style={{ fontSize:'0.67rem', fontWeight:700, color:meta.color, textTransform:'uppercase', marginBottom:'0.35rem' }}>⭐ PRIMARY COMMAND</p>
                  <p style={{ fontSize:'1.02rem', fontWeight:700, color:'#1e293b', lineHeight:1.5 }}>{result.aiSummary.primaryCommand}</p>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.9rem', marginBottom:'0.9rem' }}>
                {result.aiSummary.avoidRoute && (
                  <div style={{ background:'#fef2f2', padding:'0.8rem', borderRadius:'7px', border:'1px solid #fecaca' }}>
                    <p style={{ fontSize:'0.67rem', color:'#ef4444', fontWeight:700, marginBottom:'0.25rem' }}>🚫 AVOID</p>
                    <p style={{ fontSize:'0.84rem', color:'#991b1b' }}>{result.aiSummary.avoidRoute}</p>
                  </div>
                )}
                {result.aiSummary.situationAssessment && (
                  <div style={{ background:'white', padding:'0.8rem', borderRadius:'7px', border:'1px solid #e2e8f0' }}>
                    <p style={{ fontSize:'0.67rem', color:meta.color, fontWeight:700, marginBottom:'0.25rem' }}>SITUATION</p>
                    <p style={{ fontSize:'0.84rem' }}>{result.aiSummary.situationAssessment}</p>
                  </div>
                )}
              </div>

              {result.aiSummary.disasterWarning && (
                <div style={{ background:'#fff7ed', padding:'0.8rem', borderRadius:'7px', border:'1px solid #fed7aa', marginBottom:'0.9rem' }}>
                  <p style={{ fontSize:'0.67rem', color:'#f97316', fontWeight:700, marginBottom:'0.25rem' }}>⚠️ {meta.label.toUpperCase()} FIELD WARNING</p>
                  <p style={{ fontSize:'0.84rem', color:'#9a3412' }}>{result.aiSummary.disasterWarning}</p>
                </div>
              )}

              {result.aiSummary.resourceDeployment?.length > 0 && (
                <div style={{ background:'white', padding:'0.8rem', borderRadius:'7px', border:'1px solid #e2e8f0', marginBottom:'0.9rem' }}>
                  <p style={{ fontSize:'0.67rem', color:meta.color, fontWeight:700, marginBottom:'0.35rem' }}>🚁 RESOURCE DEPLOYMENT</p>
                  {result.aiSummary.resourceDeployment.map((a,i)=>(
                    <p key={i} style={{ fontSize:'0.84rem', marginBottom:'0.2rem' }}>📋 {a}</p>
                  ))}
                </div>
              )}

              {result.aiSummary.timelineOrder && (
                <div style={{ background:'#0f172a', padding:'1rem', borderRadius:'7px' }}>
                  <p style={{ fontSize:'0.67rem', color:'#64748b', fontWeight:700, marginBottom:'0.35rem', textTransform:'uppercase' }}>⏱️ Command Timeline</p>
                  <p style={{ fontSize:'0.86rem', color:'#e2e8f0', fontFamily:'monospace', lineHeight:1.7 }}>{result.aiSummary.timelineOrder}</p>
                </div>
              )}
            </div>
          ) : hasRun && (
            <div className="card" style={{ borderLeft:'3px solid #94a3b8', background:'#f8fafc', padding:'0.9rem' }}>
              <p style={{ color:'#64748b', fontSize:'0.86rem' }}>
                ℹ️ AI directive unavailable — GROQ_API_KEY not set in backend .env, or API rate limited.<br/>
                <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>Check backend terminal for "GROQ_API_KEY not found" message. Add it to backend/.env and restart the server.</span>
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && !result && (
        <div style={{ textAlign:'center', padding:'4rem 1rem', color:'#94a3b8' }}>
          <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>🎖️ + 🚨</div>
          <p style={{ fontSize:'1rem', fontWeight:600, color:'#64748b', marginBottom:'0.5rem' }}>Enter both locations to begin</p>
          <p style={{ fontSize:'0.84rem', maxWidth:'400px', margin:'0 auto', lineHeight:1.6 }}>
            Add your authority position and paste the civilian incident GPS, then click <strong>Run Simulation</strong>.
          </p>
        </div>
      )}
    </div>
  );
}