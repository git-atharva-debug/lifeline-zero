// src/components/bottleneck/CivilianBottleneck.jsx
// FULL REWRITE: Leaflet map, dynamic disaster routes, GPS, all factors live

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

// ── Leaflet loaded via CDN in index.html (add once, see README below) ──
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

const DISASTER_COLORS = {
  flood:     '#3b82f6',
  fire:      '#ef4444',
  earthquake:'#f97316',
  hurricane: '#8b5cf6',
  chemical:  '#10b981',
  unknown:   '#64748b',
};

const DISASTER_ICONS = {
  flood: '🌊', fire: '🔥', earthquake: '🌍',
  hurricane: '🌀', chemical: '☣️', unknown: '🚨',
};

function getSafetyColor(score) {
  if (score >= 80) return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  if (score >= 60) return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
  if (score >= 40) return { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' };
  return { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' };
}

function getUrgencyStyle(level) {
  const map = {
    CRITICAL: { bg: '#fee2e2', text: '#991b1b', icon: '🚨' },
    HIGH:     { bg: '#fed7aa', text: '#9a3412', icon: '⚠️' },
    MODERATE: { bg: '#fef3c7', text: '#92400e', icon: '⚡' },
    LOW:      { bg: '#dcfce7', text: '#166534', icon: '✅' },
  };
  return map[level] || map.MODERATE;
}

// ── Leaflet Map Component ──
function EvacuationMap({ userLocation, zone, routes, recommendedRoute, disasterType }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const layersRef = useRef([]);

  const color = DISASTER_COLORS[disasterType] || '#64748b';

  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) { console.warn('Leaflet not loaded'); return; }

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(
        [userLocation?.lat || 40.7128, userLocation?.lng || -74.006], 12
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(leafletMap.current);
    }

    // Clear previous layers
    layersRef.current.forEach(l => leafletMap.current.removeLayer(l));
    layersRef.current = [];

    const addLayer = (layer) => {
      layer.addTo(leafletMap.current);
      layersRef.current.push(layer);
      return layer;
    };

    // User location marker
    if (userLocation?.lat && userLocation?.lng) {
      const userIcon = L.divIcon({
        html: `<div style="background:#1e293b;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">📍</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      });
      addLayer(L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup('<b>Your Location</b>'));
    }

    // Zone marker
    if (zone?.coords) {
      const zoneIcon = L.divIcon({
        html: `<div style="background:${color};color:white;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${zone.name}</div>`,
        className: '', iconSize: [120, 28], iconAnchor: [60, 14],
      });
      addLayer(L.marker([zone.coords.lat, zone.coords.lng], { icon: zoneIcon }));
    }

    // Draw all routes (grey, thin)
    routes?.forEach((route, idx) => {
      if (!route.mapCoords?.start || !route.mapCoords?.end) return;
      const { start, end } = route.mapCoords;
      const isRec = route.routeNumber === recommendedRoute?.routeNumber;

      const line = addLayer(L.polyline(
        [[start.lat, start.lng], [end.lat, end.lng]],
        {
          color: isRec ? color : '#94a3b8',
          weight: isRec ? 6 : 2,
          opacity: isRec ? 0.95 : 0.45,
          dashArray: isRec ? null : '6 4',
        }
      ));
      line.bindPopup(`
        <div style="font-family:sans-serif;min-width:180px">
          <b>Route ${route.routeNumber}: ${route.routeName}</b><br/>
          → ${route.destination}<br/>
          Safety: <b>${route.safetyScore}/100</b><br/>
          Congestion: <b>${route.congestionRiskPercent}%</b><br/>
          Travel: ~${route.estimatedTravelMinutes} min
        </div>
      `);

      // Destination marker for recommended
      if (isRec) {
        const destIcon = L.divIcon({
          html: `<div style="background:#22c55e;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🏁</div>`,
          className: '', iconSize: [36, 36], iconAnchor: [18, 18],
        });
        addLayer(L.marker([end.lat, end.lng], { icon: destIcon })
          .bindPopup(`<b>Destination:</b> ${route.destination}`));
      }
    });

    // Fit bounds
    const points = [];
    if (userLocation?.lat) points.push([userLocation.lat, userLocation.lng]);
    routes?.forEach(r => {
      if (r.mapCoords?.start) points.push([r.mapCoords.start.lat, r.mapCoords.start.lng]);
      if (r.mapCoords?.end)   points.push([r.mapCoords.end.lat,   r.mapCoords.end.lng]);
    });
    if (points.length > 1) {
      try { leafletMap.current.fitBounds(points, { padding: [40, 40] }); }
      catch (e) {}
    }

  }, [userLocation, zone, routes, recommendedRoute, disasterType, color]);

  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  const isLeafletAvailable = typeof window !== 'undefined' && window.L;

  if (!isLeafletAvailable) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '8px', gap: '0.5rem' }}>
        <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
          🗺️ Map requires Leaflet.<br/>
          Add to <code>public/index.html</code> &lt;head&gt;:<br/>
          <code style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
            &lt;link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/&gt;
          </code><br/>
          <code style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
            &lt;script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"&gt;&lt;/script&gt;
          </code>
        </p>
      </div>
    );
  }

  return <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: '8px', zIndex: 0 }} />;
}

// ── Main Component ──
export default function CivilianBottleneck() {
  const [userInput, setUserInput] = useState({
    userLatitude: 40.7128,
    userLongitude: -74.0060,
    familySize: 1,
    mobilityType: 'walking',
    departureDelay: 0,
    disasterType: 'unknown',
    disasterIntensity: 6,
    affectedPopulation: 1000,
    timeOfDay: 'day',
  });

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef(null);

  const runAnalysis = useCallback(async (input) => {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        userLatitude:      parseFloat(input.userLatitude),
        userLongitude:     parseFloat(input.userLongitude),
        familySize:        parseInt(input.familySize),
        mobilityType:      input.mobilityType,
        departureDelay:    parseInt(input.departureDelay),
        disasterType:      input.disasterType,
        disasterIntensity: parseFloat(input.disasterIntensity),
        affectedPopulation:parseInt(input.affectedPopulation),
        timeOfDay:         input.timeOfDay,
      };
      console.log('[Civilian] payload →', payload);
      const res = await api.post('/bottleneck/civilian', payload);
      if (res.data?.success) {
        setAnalysis(res.data);
      } else {
        setError(res.data?.message || 'No data returned');
        setAnalysis(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Backend unreachable');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const debounce = useCallback((input) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runAnalysis(input), 700);
  }, [runAnalysis]);

  const update = (field, value) => {
    setUserInput(prev => {
      const updated = { ...prev, [field]: value };
      debounce(updated);
      return updated;
    });
  };

  const getGPS = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsLoading(false);
        setUserInput(prev => {
          const updated = { ...prev, userLatitude: coords.latitude, userLongitude: coords.longitude };
          debounce(updated);
          return updated;
        });
      },
      (err) => { setGpsLoading(false); alert('GPS unavailable: ' + err.message); }
    );
  };

  useEffect(() => { runAnalysis(userInput); }, []); // eslint-disable-line

  const accentColor = DISASTER_COLORS[userInput.disasterType] || '#64748b';

  const inputStyle = {
    width: '100%', padding: '0.7rem', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' };

  return (
    <div className="page" style={{ maxWidth: '1300px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          {DISASTER_ICONS[userInput.disasterType]} Personal Evacuation Route Advisor
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Routes update automatically based on your location, disaster type, and conditions.
        </p>
      </div>

      {/* Input Panel */}
      <div className="card" style={{ borderLeft: `4px solid ${accentColor}`, marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.2rem' }}>
          📋 Your Situation
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>

          {/* GPS Location */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={labelStyle}>Your Location</label>
              <button onClick={getGPS} disabled={gpsLoading} style={{
                fontSize: '0.75rem', padding: '0.3rem 0.8rem',
                background: gpsLoading ? '#94a3b8' : accentColor,
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: gpsLoading ? 'not-allowed' : 'pointer', fontWeight: 600,
              }}>
                {gpsLoading ? '⏳ Getting GPS…' : '📍 Use GPS'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <input type="number" step="0.0001" placeholder="Latitude" value={userInput.userLatitude}
                onChange={e => update('userLatitude', parseFloat(e.target.value))} style={inputStyle} />
              <input type="number" step="0.0001" placeholder="Longitude" value={userInput.userLongitude}
                onChange={e => update('userLongitude', parseFloat(e.target.value))} style={inputStyle} />
            </div>
          </div>

          {/* Disaster Type */}
          <div>
            <label style={labelStyle}>Disaster Type</label>
            <select value={userInput.disasterType} onChange={e => update('disasterType', e.target.value)} style={inputStyle}>
              <option value="unknown">🚨 General Emergency</option>
              <option value="flood">🌊 Flood</option>
              <option value="fire">🔥 Fire / Wildfire</option>
              <option value="earthquake">🌍 Earthquake</option>
              <option value="hurricane">🌀 Hurricane</option>
              <option value="chemical">☣️ Chemical / HAZMAT</option>
            </select>
          </div>

          {/* Disaster Intensity */}
          <div>
            <label style={labelStyle}>Disaster Intensity: <b>{userInput.disasterIntensity}/10</b></label>
            <input type="range" min="1" max="10" step="0.5" value={userInput.disasterIntensity}
              onChange={e => update('disasterIntensity', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
              <span>Minor</span><span>Moderate</span><span>Catastrophic</span>
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <label style={labelStyle}>Time of Day</label>
            <select value={userInput.timeOfDay} onChange={e => update('timeOfDay', e.target.value)} style={inputStyle}>
              <option value="day">☀️ Daytime</option>
              <option value="night">🌙 Night</option>
              <option value="3AM">🌑 3 AM (max panic)</option>
            </select>
          </div>

          {/* Mobility */}
          <div>
            <label style={labelStyle}>Mobility Type</label>
            <select value={userInput.mobilityType} onChange={e => update('mobilityType', e.target.value)} style={inputStyle}>
              <option value="walking">🚶 Walking</option>
              <option value="vehicle">🚗 Vehicle</option>
              <option value="wheelchair">♿ Wheelchair</option>
            </select>
          </div>

          {/* Family Size */}
          <div>
            <label style={labelStyle}>Family Size</label>
            <input type="number" min="1" max="20" value={userInput.familySize}
              onChange={e => update('familySize', parseInt(e.target.value))} style={inputStyle} />
          </div>

          {/* Departure Delay */}
          <div>
            <label style={labelStyle}>Departure Delay: <b>{userInput.departureDelay} min</b></label>
            <input type="range" min="0" max="60" step="5" value={userInput.departureDelay}
              onChange={e => update('departureDelay', parseInt(e.target.value))} style={{ width: '100%', accentColor }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
              <span>Leave now</span><span>30 min</span><span>60 min</span>
            </div>
          </div>

          {/* Affected Population */}
          <div>
            <label style={labelStyle}>Affected Population</label>
            <input type="number" min="100" max="100000" step="100" value={userInput.affectedPopulation}
              onChange={e => update('affectedPopulation', parseInt(e.target.value))} style={inputStyle} />
          </div>

        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ borderLeft: `4px solid ${accentColor}`, padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>⏳</div>
          <p style={{ color: accentColor, fontWeight: 600 }}>Computing evacuation routes for {userInput.disasterType} scenario…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.3rem' }}>❌ Analysis Error</p>
          <p style={{ color: '#7f1d1d', fontSize: '0.9rem' }}>{error}</p>
          <button onClick={() => runAnalysis(userInput)} style={{
            marginTop: '0.75rem', padding: '0.5rem 1rem',
            background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600,
          }}>🔄 Retry</button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && analysis && (
        <>
          {/* Disaster context banner */}
          <div style={{
            padding: '0.85rem 1.2rem', borderRadius: '8px', marginBottom: '1.5rem',
            background: `${accentColor}18`, border: `2px solid ${accentColor}40`,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>{DISASTER_ICONS[userInput.disasterType]}</span>
            <div>
              <p style={{ fontWeight: 700, color: accentColor, fontSize: '0.95rem' }}>
                {analysis.disasterNetwork?.description}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Zone: <b>{analysis.zone?.name}</b> — Risk: <b style={{ color: accentColor }}>{analysis.zone?.riskLevel}</b> — {analysis.zone?.distanceFromUser} km from you
              </p>
            </div>
          </div>

          {/* Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Overall Congestion', value: `${analysis.congestionRiskPercent}%`, color: analysis.congestionRiskPercent >= 75 ? '#ef4444' : analysis.congestionRiskPercent >= 50 ? '#f97316' : '#22c55e' },
              { label: 'Est. Evacuation Time', value: `${analysis.evacuationTimeEstimate} min`, color: accentColor },
              { label: 'Recommended Route', value: `Route ${analysis.recommendedRoute?.routeNumber}`, color: '#22c55e' },
              { label: 'Zone Risk', value: analysis.zone?.riskLevel, color: analysis.zone?.riskLevel === 'CRITICAL' ? '#ef4444' : analysis.zone?.riskLevel === 'HIGH' ? '#f97316' : '#22c55e' },
            ].map((m, i) => (
              <div key={i} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${m.color}` }}>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{m.label}</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Map + Routes side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

            {/* Map */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', minHeight: '420px' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                🗺️ Evacuation Route Map
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem', fontWeight: 400 }}>
                  — recommended shown in {DISASTER_ICONS[userInput.disasterType]}
                </span>
              </div>
              <div style={{ height: '380px' }}>
                <EvacuationMap
                  userLocation={analysis.userLocation}
                  zone={analysis.zone}
                  routes={analysis.routeAnalysis}
                  recommendedRoute={analysis.recommendedRoute}
                  disasterType={userInput.disasterType}
                />
              </div>
            </div>

            {/* Routes list */}
            <div className="card" style={{ padding: '1rem', overflow: 'auto', maxHeight: '460px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                🛣️ Available Routes ({analysis.routeAnalysis?.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {analysis.routeAnalysis?.map((route, idx) => {
                  const isRec = route.routeNumber === analysis.recommendedRoute?.routeNumber;
                  const safetyC = getSafetyColor(route.safetyScore);
                  return (
                    <div key={idx} onClick={() => setExpandedRoute(expandedRoute === idx ? -1 : idx)}
                      style={{
                        padding: '0.9rem', borderRadius: '8px', cursor: 'pointer',
                        border: `2px solid ${isRec ? accentColor : '#e2e8f0'}`,
                        background: isRec ? `${accentColor}08` : 'white',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span style={{ fontWeight: 700 }}>Route {route.routeNumber}</span>
                            {isRec && <span style={{ background: accentColor, color: 'white', padding: '0.15rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 700 }}>⭐ BEST</span>}
                          </div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.1rem' }}>{route.routeName}</p>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>→ {route.destination}</p>
                        </div>
                        <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'center', background: safetyC.bg, color: safetyC.text, border: `1px solid ${safetyC.border}`, minWidth: '48px' }}>
                          <p style={{ fontWeight: 700, fontSize: '1rem' }}>{route.safetyScore}</p>
                          <p style={{ fontSize: '0.65rem' }}>Safety</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', marginTop: '0.6rem', fontSize: '0.75rem' }}>
                        {[
                          { l: 'Distance', v: `${route.distanceKm} km` },
                          { l: 'Congestion', v: `${route.congestionRiskPercent}%` },
                          { l: '~Travel', v: `${route.estimatedTravelMinutes} min` },
                          { l: 'Mobility', v: route.mobilityFit?.replace('-', ' ') },
                        ].map((m, i) => (
                          <div key={i}>
                            <p style={{ color: '#94a3b8', marginBottom: '1px' }}>{m.l}</p>
                            <p style={{ fontWeight: 600 }}>{m.v}</p>
                          </div>
                        ))}
                      </div>
                      {expandedRoute === idx && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                          <p><b>Capacity:</b> {route.capacity} ppl/min</p>
                          <p style={{ marginTop: '0.2rem' }}><b>Time to congest:</b> {route.timeToCongestMinutes} min</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Guidance */}
          {analysis.aiGuidance ? (
            <div className="card" style={{
              borderLeft: `4px solid ${accentColor}`,
              background: `linear-gradient(135deg, ${accentColor}08 0%, #fce7f308 100%)`,
              padding: '1.5rem', borderRadius: '10px', marginBottom: '1.5rem',
            }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                🤖 AI Evacuation Guidance — {DISASTER_ICONS[userInput.disasterType]} {userInput.disasterType}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {analysis.aiGuidance.safetySummary && (
                  <div style={{ background: 'white', padding: '0.85rem', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.72rem', color: accentColor, fontWeight: 700, marginBottom: '0.3rem' }}>SAFETY SUMMARY</p>
                    <p style={{ fontSize: '0.88rem' }}>{analysis.aiGuidance.safetySummary}</p>
                  </div>
                )}
                {analysis.aiGuidance.routeExplanation && (
                  <div style={{ background: 'white', padding: '0.85rem', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.72rem', color: accentColor, fontWeight: 700, marginBottom: '0.3rem' }}>WHY THIS ROUTE</p>
                    <p style={{ fontSize: '0.88rem' }}>{analysis.aiGuidance.routeExplanation}</p>
                  </div>
                )}
                {analysis.aiGuidance.timeAdvice && (
                  <div style={{ background: 'white', padding: '0.85rem', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.72rem', color: accentColor, fontWeight: 700, marginBottom: '0.3rem' }}>TIMING ADVICE</p>
                    <p style={{ fontSize: '0.88rem' }}>{analysis.aiGuidance.timeAdvice}</p>
                  </div>
                )}
                {analysis.aiGuidance.urgencyLevel && (
                  <div style={{ background: 'white', padding: '0.85rem', borderRadius: '7px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ padding: '0.4rem 0.8rem', borderRadius: '5px', fontWeight: 700, fontSize: '0.95rem', ...(() => { const s = getUrgencyStyle(analysis.aiGuidance.urgencyLevel); return { background: s.bg, color: s.text }; })() }}>
                      {getUrgencyStyle(analysis.aiGuidance.urgencyLevel).icon} {analysis.aiGuidance.urgencyLevel}
                    </div>
                  </div>
                )}
              </div>

              {analysis.aiGuidance.finalConclusion && (
                <div style={{ padding: '1.2rem', background: 'white', borderRadius: '8px', border: `3px solid ${accentColor}`, boxShadow: `0 4px 16px ${accentColor}25` }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: accentColor, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    ⭐ YOUR EVACUATION INSTRUCTION
                  </p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', lineHeight: '1.55' }}>
                    {analysis.aiGuidance.finalConclusion}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ borderLeft: '3px solid #94a3b8', background: '#f8fafc', padding: '1rem', marginBottom: '1.5rem' }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                ℹ️ AI guidance unavailable (Groq API key missing or rate limited). Numeric results above are accurate for decision-making.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && !analysis && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb', padding: '1.25rem' }}>
          <p style={{ color: '#92400e', fontSize: '0.9rem' }}>⚠️ No data yet. Enter your location above or click Use GPS.</p>
        </div>
      )}
    </div>
  );
}