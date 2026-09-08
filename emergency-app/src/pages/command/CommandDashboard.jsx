import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import AlertBanner from '../../components/AlertBanner';
import { useNavigate } from 'react-router-dom';
import { sosAPI } from '../../services/api';

// ─── Inline utils (no extra imports needed) ───────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function timeSince(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const features = [
  { label: 'Broadcast Alerts', path: '/command/broadcast', color: '#ef4444', desc: 'Push alerts to civilians in any zone' },
  { label: 'Severity Reports', path: '/command/inbox', color: '#f97316', desc: 'Review AI reports from civilians' },
  { label: 'Evacuation Routes', path: '/command/evacuation', color: '#f59e0b', desc: 'Manage & push evacuation paths' },
  { label: 'Resource Tracker', path: '/command/resources', color: '#10b981', desc: 'Deploy teams & track all assets' },
  { label: 'AI Recommendations', path: '/command/ai', color: '#8b5cf6', desc: 'AI-generated rescue command decisions' },
  { label: 'Incident Control', path: '/command/incidents', color: '#dc2626', desc: 'Manage & respond to emergencies' },
  { label: 'SOS Rescue Center', path: '/command/sos', color: '#ef4444', desc: 'Live beacon tracking & rescue dispatch' },
];

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes pulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.5; }
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    background: #f8fafc;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
  }

  /* Stats cards */
  .stat-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem 1rem;
    text-align: center;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.05);
    border-color: #cbd5e1;
  }

  /* Feature cards */
  .feature-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }
  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.05);
    border-color: #cbd5e1;
  }

  /* SOS Panel */
  .sos-panel {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    overflow: hidden;
    margin-top: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  }

  .sos-panel-header {
    padding: 1rem 1.25rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .sos-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    min-height: 500px;
  }

  .sos-list {
    border-right: 1px solid #e2e8f0;
    overflow-y: auto;
    max-height: 500px;
    background: #ffffff;
  }

  .sos-detail {
    padding: 1.25rem;
    overflow-y: auto;
    max-height: 500px;
    background: #f8fafc;
  }

  .sos-detail.empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Beacon rows */
  .beacon-row {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  .beacon-row:hover {
    background: #f8fafc;
  }
  .beacon-row.selected {
    background: #f1f5f9;
    border-left: 3px solid #3b82f6;
  }
  .beacon-row.critical {
    border-left: 3px solid #ef4444;
  }
  .beacon-row.dispatched-row {
    border-left: 3px solid #f97316;
  }
  .beacon-row.resolved-row {
    border-left: 3px solid #22c55e;
    opacity: 0.7;
  }

  /* Status chips */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 0.7rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid;
  }
  .chip-active {
    background: #fee2e2;
    border-color: #fecaca;
    color: #b91c1c;
  }
  .chip-dispatch {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e40af;
  }
  .chip-resolved {
    background: #dcfce7;
    border-color: #bbf7d0;
    color: #059669;
  }
  .chip-pending {
    background: #fef3c7;
    border-color: #fde68a;
    color: #b45309;
  }

  /* Data rows */
  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
    gap: 12px;
    font-size: 0.85rem;
  }
  .data-row:last-child {
    border-bottom: none;
  }
  .data-label {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: #64748b;
    flex-shrink: 0;
  }
  .data-value {
    color: #1e293b;
    font-weight: 500;
    text-align: right;
    word-break: break-word;
  }

  /* Buttons */
  .action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
    font-family: 'Inter', sans-serif;
  }
  .btn-blue {
    background: #3b82f6;
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(59,130,246,0.2);
  }
  .btn-blue:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59,130,246,0.3);
  }
  .btn-green {
    background: #22c55e;
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(34,197,94,0.2);
  }
  .btn-green:hover {
    background: #16a34a;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(34,197,94,0.3);
  }
  .btn-outline {
    background: #ffffff;
    border: 1px solid #e2e8f0 !important;
    color: #64748b;
  }
  .btn-outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1 !important;
    color: #334155;
  }

  /* Map links */
  .maps-btn {
    display: block;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #2563eb;
    text-align: center;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.85rem;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }
  .maps-btn:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1e40af;
  }
  .waze-btn {
    color: #059669;
  }
  .waze-btn:hover {
    background: #f0fdf4;
    border-color: #22c55e;
    color: #047857;
  }

  /* Radar */
  .radar-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .radar-blip {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 8px currentColor;
  }

  /* Note box */
  .note-box {
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.85rem;
    color: #92400e;
    line-height: 1.6;
    margin-top: 0.5rem;
  }

  /* Toast */
  .toast-cmd {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    background: #ffffff;
    border: 1px solid #22c55e;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    color: #059669;
    animation: slide-in 0.3s ease;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    max-width: 320px;
  }

  .blink-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1s ease infinite;
  }

  /* Live badge */
  .live-badge {
    background: #ef4444;
    color: #ffffff;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.65rem;
    font-weight: 700;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  @media (max-width: 768px) {
    .page { padding: 1rem; }
    .sos-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
    }
    .sos-list { max-height: 300px; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EMBEDDED SOS LIVE PANEL ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function SOSLivePanel({ onOpenFull }) {
  const [beacons, setBeacons] = useState({});
  const [selected, setSelected] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const prevIds = useRef(new Set());
  const toastTimer = useRef(null);

  const load = async () => {
    try {
      const res = await sosAPI.getActive();
      if (res.success) {
        const data = res.data;
        const ids = new Set(Object.keys(data));
        const added = [...ids].filter(id => !prevIds.current.has(id));
        if (added.length > 0) {
          setNewIds(prev => new Set([...prev, ...added]));
          setTimeout(() => setNewIds(prev => { const n = new Set(prev); added.forEach(id => n.delete(id)); return n; }), 3000);
        }
        prevIds.current = ids;
        setBeacons(data);
      }
    } catch (err) {
      console.error('Failed to load SOS beacons:', err);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = async (userId, rescueStatus, msg) => {
    try {
      await sosAPI.updateStatus(userId, rescueStatus);
      const updated = { ...beacons };
      if (updated[userId]) {
        updated[userId].rescueStatus = rescueStatus;
        if (rescueStatus === 'resolved') {
          updated[userId].status = 'SOS_RESOLVED';
          updated[userId].resolvedAt = new Date().toISOString();
        }
        setBeacons(updated);
      }
      showToast(msg);
    } catch (err) {
      console.error('Failed to update beacon status:', err);
      showToast('Failed to update status');
    }
  };

  const list = Object.values(beacons).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const activeSOS = list.filter(b => b.status === 'SOS_ACTIVE' && b.rescueStatus !== 'resolved').length;
  const pendingCount = list.filter(b => b.rescueStatus === 'pending' && b.status === 'SOS_ACTIVE').length;
  const sel = selected ? beacons[selected] : null;
  const mapsUrl = sel?.lat ? `https://www.google.com/maps?q=${sel.lat},${sel.lon}&z=17` : null;
  const wazeUrl = sel?.lat ? `https://waze.com/ul?ll=${sel.lat},${sel.lon}&navigate=yes` : null;

  // Radar blips
  const blips = list
    .filter(b => b.status === 'SOS_ACTIVE' && b.rescueStatus !== 'resolved')
    .map((b, i) => ({
      ...b,
      x: 50 + 32 * Math.cos(i * 2.4 + 0.8),
      y: 50 + 32 * Math.sin(i * 2.4 + 0.3),
      color: b.medicalConditions && b.medicalConditions !== 'None' ? '#ef4444' : '#22c55e',
    }));

  return (
    <>
      {toast && <div className="toast-cmd">{toast}</div>}
      <div className="sos-panel">

        {/* Panel header */}
        <div className="sos-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>SOS Rescue Center</span>
            {activeSOS > 0 && (
              <span className="chip chip-active">
                <span className="blink-dot" style={{ background: '#ef4444' }} />
                {activeSOS} Active
              </span>
            )}
            {pendingCount > 0 && (
              <span className="chip chip-pending">⚠ {pendingCount} Awaiting Dispatch</span>
            )}
          </div>

          {/* Mini radar */}
          <div style={{ position: 'relative', width: 56, height: 56, marginLeft: 'auto', flexShrink: 0 }}>
            {[48, 34, 20].map(s => (
              <div key={s} className="radar-ring" style={{ width: s, height: s, borderColor: '#e2e8f0' }} />
            ))}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                width: '50%', 
                height: '2px', 
                transformOrigin: 'left center', 
                background: 'linear-gradient(90deg, #3b82f6, transparent)',
                animation: 'pulse 3s linear infinite'
              }} />
            </div>
            {blips.map((b, i) => (
              <div key={b.userId} className="radar-blip" style={{ 
                left: `${b.x}%`, 
                top: `${b.y}%`, 
                background: b.color,
                boxShadow: `0 0 8px ${b.color}`
              }} />
            ))}
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: '#3b82f6', 
              transform: 'translate(-50%,-50%)',
              boxShadow: '0 0 8px #3b82f6'
            }} />
          </div>

          <button onClick={onOpenFull} style={{ 
            flexShrink: 0, 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: 8, 
            padding: '6px 14px', 
            color: '#3b82f6', 
            cursor: 'pointer', 
            fontSize: '0.8rem', 
            fontWeight: 600 
          }}>
            Full View →
          </button>
        </div>

        {/* Body */}
        <div className="sos-layout">

          {/* LEFT: beacon list */}
          <div className="sos-list">
            {list.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                No active SOS beacons
              </div>
            )}
            {list.map(beacon => {
              const isResolved = beacon.rescueStatus === 'resolved' || beacon.status === 'SOS_RESOLVED';
              const isDispatched = beacon.rescueStatus === 'dispatched';
              const isCritical = beacon.medicalConditions && beacon.medicalConditions !== 'None';
              const stale = Math.floor((Date.now() - new Date(beacon.timestamp).getTime()) / 1000) > 30;
              return (
                <div
                  key={beacon.userId}
                  className={`beacon-row ${selected === beacon.userId ? 'selected' : ''} 
                    ${isCritical && !isResolved ? 'critical' : ''} 
                    ${isDispatched ? 'dispatched-row' : ''} 
                    ${isResolved ? 'resolved-row' : ''}`}
                  onClick={() => setSelected(beacon.userId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{beacon.name}</div>
                      {isCritical && !isResolved && (
                        <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: 4 }}>⚠ {beacon.medicalConditions}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ 
                        background: '#3b82f6', 
                        borderRadius: 4, 
                        padding: '2px 8px', 
                        fontSize: '0.8rem', 
                        fontWeight: 700, 
                        color: '#ffffff' 
                      }}>
                        {beacon.bloodGroup}
                      </div>
                      {isResolved ? (
                        <span className="chip chip-resolved">Rescued</span>
                      ) : isDispatched ? (
                        <span className="chip chip-dispatch">En Route</span>
                      ) : (
                        <span className="chip chip-active">
                          <span className="blink-dot" style={{ background: '#ef4444' }} />
                          SOS
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span style={{ color: stale ? '#b45309' : '#94a3b8' }}>
                      {stale ? '⚠ ' : ''}Ping {timeSince(beacon.timestamp)}
                    </span>
                    <span style={{ color: '#94a3b8' }}>🔋{beacon.battery}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: detail */}
          <div className={`sos-detail ${!sel ? 'empty' : ''}`}>
            {!sel && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#cbd5e1' }}>📡</div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  Select a beacon<br />to view details
                </div>
              </div>
            )}

            {sel && (
              <div style={{ animation: 'fade-up 0.3s ease' }}>
                {/* Name + status */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  marginBottom: '1rem', 
                  flexWrap: 'wrap', 
                  gap: '0.75rem' 
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1e293b' }}>{sel.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{sel.address || 'Address not set'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ 
                      background: '#3b82f6', 
                      borderRadius: 8, 
                      padding: '4px 12px', 
                      fontSize: '1rem', 
                      fontWeight: 800, 
                      color: '#ffffff' 
                    }}>
                      {sel.bloodGroup}
                    </div>
                    {sel.rescueStatus === 'resolved' || sel.status === 'SOS_RESOLVED' ? (
                      <span className="chip chip-resolved">Rescued</span>
                    ) : sel.rescueStatus === 'dispatched' ? (
                      <span className="chip chip-dispatch">Dispatched</span>
                    ) : (
                      <span className="chip chip-active">
                        <span className="blink-dot" style={{ background: '#ef4444' }} />
                        SOS Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    ['Pings', sel.pingCount, '#3b82f6'],
                    ['Battery', `${sel.battery}%`, sel.battery < 20 ? '#ef4444' : '#22c55e'],
                    ['Signal', `${sel.signal}/4`, '#8b5cf6'],
                    ['Last', timeSince(sel.timestamp), '#f97316']
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.6rem 0.3rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1rem', color: c, fontWeight: 700 }}>{v}</div>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* GPS + navigation */}
                {sel.lat && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, marginBottom: 6 }}>📍 GPS Location · ±{sel.accuracy}m</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: '#2563eb', marginBottom: '0.75rem' }}>
                      {sel.lat.toFixed(6)}, {sel.lon.toFixed(6)}
                    </div>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-btn">🗺️ Open in Google Maps</a>
                    <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="maps-btn waze-btn">🔵 Navigate in Waze</a>
                  </div>
                )}

                {/* Medical */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>🏥 Medical Profile</div>
                  {[
                    ['Allergies', sel.allergies || 'None'],
                    ['Medications', sel.medications || 'None'],
                    ['Conditions', sel.medicalConditions || 'None'],
                    ['EC Name', sel.emergencyContact || 'Not set'],
                    ['EC Phone', sel.emergencyPhone || 'Not set'],
                  ].map(([l, v]) => (
                    <div key={l} className="data-row">
                      <span className="data-label">{l}</span>
                      <span className="data-value" style={{ 
                        color: v === 'None' || v === 'Not set' ? '#94a3b8' 
                          : l.includes('EC') ? '#059669' 
                          : '#b91c1c' 
                      }}>
                        {v}
                      </span>
                    </div>
                  ))}
                  {sel.notes && <div className="note-box">📝 {sel.notes}</div>}
                </div>

                {/* Emergency contact call */}
                {sel.emergencyPhone && (
                  <a href={`tel:${sel.emergencyPhone}`} style={{ 
                    display: 'block', 
                    padding: '0.75rem', 
                    background: '#f0fdf4', 
                    border: '1px solid #bbf7d0', 
                    borderRadius: 10, 
                    color: '#059669', 
                    textAlign: 'center', 
                    textDecoration: 'none', 
                    fontWeight: 600, 
                    fontSize: '0.9rem', 
                    marginBottom: '1rem' 
                  }}>
                    📞 Call Emergency Contact
                  </a>
                )}

                {/* Actions */}
                {sel.rescueStatus !== 'resolved' && sel.status !== 'SOS_RESOLVED' && (
                  <div>
                    {sel.rescueStatus !== 'dispatched' && (
                      <button className="action-btn btn-blue" onClick={() => updateStatus(sel.userId, 'dispatched', `Rescue dispatched to ${sel.name}`)}>
                        🚑 Dispatch Rescue Team
                      </button>
                    )}
                    <button className="action-btn btn-green" onClick={() => updateStatus(sel.userId, 'resolved', `${sel.name} marked as rescued`)}>
                      ✅ Mark as Rescued
                    </button>
                    <button
                      className="action-btn btn-outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(`SOS ALERT\nName: ${sel.name}\nBlood: ${sel.bloodGroup}\nAllergies: ${sel.allergies}\nLocation: ${sel.lat?.toFixed(5)}, ${sel.lon?.toFixed(5)}\nContact: ${sel.emergencyPhone}\nMaps: ${mapsUrl}`);
                        showToast('Rescue brief copied');
                      }}
                    >
                      📋 Copy Rescue Brief
                    </button>
                  </div>
                )}

                {/* Resolved state */}
                {(sel.rescueStatus === 'resolved' || sel.status === 'SOS_RESOLVED') && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontSize: '0.95rem', color: '#059669', fontWeight: 600, marginBottom: 4 }}>
                      ✅ Person Rescued
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      at {fmtTime(sel.resolvedAt)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMMAND DASHBOARD ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function CommandDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Compute live SOS count for the stats row
  const [activeSOS, setActiveSOS] = useState(0);
  useEffect(() => {
    const update = async () => {
      try {
        const res = await sosAPI.getActive();
        if (res.success) {
          setActiveSOS(Object.values(res.data).filter(b => b.status === 'SOS_ACTIVE' && b.rescueStatus !== 'resolved').length);
        }
      } catch (err) {
        console.error('Failed to fetch SOS count:', err);
      }
    };
    update();
    const iv = setInterval(update, 10000);
    return () => clearInterval(iv);
  }, []);

  const stats = [
    { label: 'Civilians at Risk', value: '1,284', color: '#ef4444' },
    { label: 'Active Reports', value: '47', color: '#f97316' },
    { label: 'Teams Deployed', value: '12', color: '#22c55e' },
    { label: 'SOS Beacons', value: String(activeSOS), color: '#ef4444' },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="page">

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>Rescue Command</h1>
            <span style={{ 
              background: '#fee2e2', 
              color: '#b91c1c', 
              borderRadius: 999, 
              padding: '4px 12px', 
              fontSize: '0.75rem', 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span className="blink-dot" style={{ background: '#b91c1c' }} />
              LIVE
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Officer {user?.name} — Emergency Operations Dashboard</p>
        </div>

        {/* <AlertBanner level="danger" message="🔴 ACTIVE INCIDENT: Flood threat Zone 3 & 4 — 47 SOS reports received in last 30 min" /> */}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Inter, sans-serif', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.5rem' }}>
          {features.map(f => (
            <div key={f.path} className="feature-card" onClick={() => navigate(f.path)}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4, color: '#1e293b' }}>{f.label}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
              {f.path === '/command/sos' && activeSOS > 0 && (
                <div style={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12, 
                  background: '#ef4444', 
                  color: '#ffffff', 
                  borderRadius: 999, 
                  padding: '2px 10px', 
                  fontSize: '0.7rem', 
                  fontWeight: 700 
                }}>
                  {activeSOS} LIVE
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Embedded SOS Live Panel */}
        <SOSLivePanel onOpenFull={() => navigate('/command/sos')} />

      </div>
    </>
  );
}