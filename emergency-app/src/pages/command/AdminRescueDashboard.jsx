import { useState, useEffect, useRef } from 'react';
import { sosAPI } from '../../services/api';

// ─── UTILS ───────────────────────────────────────────────────────────────────────────────
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
function severityColor(beacon) {
  if (!beacon.bloodGroup || beacon.bloodGroup === 'Unknown') return '#f59e0b';
  if (beacon.medicalConditions && beacon.medicalConditions !== 'None') return '#ef4444';
  return '#22c55e';
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.5; }
  }

  .admin-page {
    min-height: 100vh;
    background: #f8fafc;
    font-family: 'Inter', sans-serif;
    color: #1e293b;
    display: flex; flex-direction: column;
  }

  .topbar {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  .main-layout {
    display: grid;
    grid-template-columns: 380px 1fr;
    flex: 1;
    height: calc(100vh - 73px);
    overflow: hidden;
  }

  /* LEFT — beacon list */
  .beacon-list-panel {
    border-right: 1px solid #e2e8f0;
    overflow-y: auto;
    overflow-x: hidden;
    background: #ffffff;
  }

  .beacon-list-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 10;
    background: #ffffff;
  }

  .beacon-card {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  .beacon-card:hover {
    background: #f8fafc;
  }
  .beacon-card.selected {
    background: #f1f5f9;
    border-left: 3px solid #3b82f6;
  }
  .beacon-card.critical {
    border-left: 3px solid #ef4444;
  }
  .beacon-card.dispatched {
    border-left: 3px solid #f97316;
  }
  .beacon-card.resolved {
    border-left: 3px solid #22c55e;
    opacity: 0.7;
  }

  /* RIGHT — detail panel */
  .detail-panel {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1.5rem;
    background: #f8fafc;
  }
  .detail-panel.empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Status chips */
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    padding: 4px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.02em;
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

  /* Cards */
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
    gap: 12px;
  }
  .data-row:last-child { border-bottom: none; }
  .data-label {
    color: #64748b;
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  .data-value {
    color: #1e293b;
    font-weight: 500;
    font-size: 0.85rem;
    text-align: right;
    word-break: break-word;
  }

  /* Buttons */
  .action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }
  .btn-dispatch {
    background: #3b82f6;
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(59,130,246,0.2);
  }
  .btn-dispatch:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59,130,246,0.3);
  }
  .btn-resolve {
    background: #22c55e;
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(34,197,94,0.2);
  }
  .btn-resolve:hover {
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

  .maps-link {
    display: block;
    width: 100%;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #2563eb;
    text-align: center;
    text-decoration: none;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }
  .maps-link:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1e40af;
  }

  .stat-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.75rem 0.5rem;
    text-align: center;
    flex: 1;
  }

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

  .empty-state {
    text-align: center;
    animation: fadeUp 0.5s ease;
  }

  .toast {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 999;
    background: #ffffff;
    border: 1px solid #22c55e;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    color: #059669;
    animation: slideInRight 0.3s ease;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    max-width: 320px;
  }

  /* Filter buttons */
  .filter-btn {
    padding: 4px 0;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem;
    font-weight: 500;
    background: transparent;
    color: #94a3b8;
    transition: all 0.2s;
  }
  .filter-btn.active {
    color: #3b82f6;
    border-bottom: 2px solid #3b82f6;
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

  .blink {
    animation: pulse 1s ease infinite;
  }

  @media (max-width: 768px) {
    .main-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .beacon-list-panel {
      max-height: 40vh;
    }
  }
`;

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function AdminRescueDashboard() {
  const [beacons, setBeacons] = useState({});
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const prevBeaconIds = useRef(new Set());
  const toastTimer = useRef(null);

  // ─── Load & poll beacons ────────────────────────────────────────────────────
  const loadBeacons = async () => {
    try {
      const res = await sosAPI.getActive();
      if (res.success) {
        const data = res.data;
        const currentIds = new Set(Object.keys(data));
        const added = [...currentIds].filter(id => !prevBeaconIds.current.has(id));
        if (added.length > 0) {
          setNewIds(prev => new Set([...prev, ...added]));
          const newB = data[added[0]];
          if (newB) showToast(`New SOS from ${newB.name}`);
          setTimeout(() => setNewIds(prev => { const n = new Set(prev); added.forEach(id => n.delete(id)); return n; }), 3000);
        }
        prevBeaconIds.current = currentIds;
        setBeacons(data);
      }
    } catch (err) {
      console.error('Failed to load SOS beacons:', err);
    }
  };

  useEffect(() => {
    loadBeacons();
    const interval = setInterval(loadBeacons, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
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
        if (selected === userId) setSelected(userId);
      }
      showToast(msg);
    } catch (err) {
      console.error('Failed to update beacon status:', err);
      showToast('Failed to update status');
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const clearResolved = async () => {
    try {
      await sosAPI.clearResolved();
      const updated = Object.fromEntries(
        Object.entries(beacons).filter(([, b]) => b.rescueStatus !== 'resolved')
      );
      setBeacons(updated);
      setSelected(null);
      showToast('Resolved beacons cleared');
    } catch (err) {
      console.error('Failed to clear resolved:', err);
      showToast('Failed to clear resolved beacons');
    }
  };

  // ─── Filtered beacon list ─────────────────────────────────────────────
  const beaconList = Object.values(beacons)
    .filter(b => {
      if (filter === 'all') return true;
      if (filter === 'active') return b.rescueStatus === 'pending' && b.status === 'SOS_ACTIVE';
      if (filter === 'dispatched') return b.rescueStatus === 'dispatched';
      if (filter === 'resolved') return b.rescueStatus === 'resolved' || b.status === 'SOS_RESOLVED';
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const activeSOS = Object.values(beacons).filter(b => b.status === 'SOS_ACTIVE' && b.rescueStatus !== 'resolved').length;
  const pendingRescue = Object.values(beacons).filter(b => b.rescueStatus === 'pending' && b.status === 'SOS_ACTIVE').length;

  const sel = selected ? beacons[selected] : null;
  const mapsUrl = sel?.lat ? `https://www.google.com/maps?q=${sel.lat},${sel.lon}&z=17` : null;
  const wazeUrl = sel?.lat ? `https://waze.com/ul?ll=${sel.lat},${sel.lon}&navigate=yes` : null;

  return (
    <>
      <style>{CSS}</style>
      <div className="admin-page">

        {/* Toast */}
        {toast && <div className="toast">{toast}</div>}

        {/* Topbar */}
        <div className="topbar">
          <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
            <span style={{ color: '#ef4444' }}>⚡</span> RESCUE COMMAND CENTER
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {/* Live stats */}
            {activeSOS > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#b91c1c' }}>
                <span className="blink">●</span>
                {activeSOS} Active SOS
              </div>
            )}
            {pendingRescue > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
                ⚠ {pendingRescue} Awaiting Dispatch
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Polling · 10s
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="main-layout">

          {/* LEFT: Beacon List */}
          <div className="beacon-list-panel">
            {/* List header */}
            <div className="beacon-list-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                  SOS BEACONS · {beaconList.length}
                </div>
                {Object.values(beacons).some(b => b.rescueStatus === 'resolved') && (
                  <button 
                    onClick={clearResolved} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#94a3b8', 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear Resolved
                  </button>
                )}
              </div>
              
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['dispatched', 'Dispatched'],
                  ['resolved', 'Resolved']
                ].map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      borderBottom: filter === f ? '2px solid #3b82f6' : '2px solid transparent'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Beacon cards */}
            {beaconList.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
                No beacons match filter
              </div>
            )}
            
            {beaconList.map(beacon => {
              const isCritical = beacon.medicalConditions && beacon.medicalConditions !== 'None';
              const isResolved = beacon.rescueStatus === 'resolved' || beacon.status === 'SOS_RESOLVED';
              const isDispatched = beacon.rescueStatus === 'dispatched';
              const secAgo = Math.floor((Date.now() - new Date(beacon.timestamp).getTime()) / 1000);
              const isStale = secAgo > 30;

              return (
                <div
                  key={beacon.userId}
                  className={`beacon-card ${selected === beacon.userId ? 'selected' : ''} 
                    ${isCritical ? 'critical' : ''} ${isDispatched ? 'dispatched' : ''} ${isResolved ? 'resolved' : ''}`}
                  onClick={() => setSelected(beacon.userId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                        {beacon.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                        {beacon.userId}
                      </div>
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
                        <span className="status-chip chip-resolved">Rescued</span>
                      ) : isDispatched ? (
                        <span className="status-chip chip-dispatch">Dispatched</span>
                      ) : (
                        <span className="status-chip chip-active">
                          <span className={isStale ? '' : 'blink'}>●</span> SOS Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Medical flag */}
                  {isCritical && !isResolved && (
                    <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginBottom: 6 }}>
                      ⚠ {beacon.medicalConditions}
                    </div>
                  )}

                  {/* Bottom row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: isStale ? '#b45309' : '#94a3b8' }}>
                      {isStale ? '⚠ ' : ''}Ping {timeSince(beacon.timestamp)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      🔋{beacon.battery}% · #{beacon.pingCount}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Detail Panel */}
          <div className={`detail-panel ${!sel ? 'empty' : ''}`}>
            {!sel && (
              <div className="empty-state">
                <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#cbd5e1' }}>📡</div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  Select a beacon<br />to view rescue details
                </div>
              </div>
            )}

            {sel && (
              <div style={{ animation: 'fadeUp 0.3s ease', maxWidth: 680 }}>

                {/* Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  marginBottom: '1.5rem', 
                  flexWrap: 'wrap', 
                  gap: '1rem' 
                }}>
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      {sel.name}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                      {sel.userId} · {sel.address || 'Address not set'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ 
                      background: '#3b82f6', 
                      borderRadius: 8, 
                      padding: '6px 16px', 
                      fontSize: '1.2rem', 
                      fontWeight: 800, 
                      color: '#ffffff' 
                    }}>
                      {sel.bloodGroup}
                    </div>
                    {sel.rescueStatus === 'resolved' || sel.status === 'SOS_RESOLVED' ? (
                      <span className="status-chip chip-resolved">Rescued</span>
                    ) : sel.rescueStatus === 'dispatched' ? (
                      <span className="status-chip chip-dispatch">Rescue Dispatched</span>
                    ) : (
                      <span className="status-chip chip-active">
                        <span className="blink">●</span> SOS Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Live stats row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[
                    ['Pings', sel.pingCount, '#3b82f6'],
                    ['Battery', `${sel.battery}%`, sel.battery < 20 ? '#ef4444' : '#22c55e'],
                    ['Signal', `${sel.signal}/4`, '#8b5cf6'],
                    ['Last Ping', timeSince(sel.timestamp), '#f97316'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="stat-box">
                      <div style={{ fontSize: '1.2rem', color: c, fontWeight: 700 }}>{v}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* GPS Location */}
                {sel.lat && (
                  <div className="card">
                    <div className="section-label">📍 GPS Location</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>LATITUDE</div>
                        <div style={{ fontSize: '0.9rem', color: '#2563eb', fontFamily: 'JetBrains Mono, monospace' }}>{sel.lat.toFixed(6)}</div>
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 4 }}>LONGITUDE</div>
                        <div style={{ fontSize: '0.9rem', color: '#2563eb', fontFamily: 'JetBrains Mono, monospace' }}>{sel.lon.toFixed(6)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                      GPS Accuracy: ±{sel.accuracy}m · Last update: {fmtTime(sel.timestamp)}
                    </div>
                    
                    {/* Map links */}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                      🗺️ Open in Google Maps
                    </a>
                    <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                      🔵 Navigate in Waze
                    </a>
                  </div>
                )}

                {/* Medical profile */}
                <div className="card">
                  <div className="section-label">🏥 Medical Profile</div>
                  {[
                    ['Blood Group', sel.bloodGroup || 'Unknown'],
                    ['Allergies', sel.allergies || 'None'],
                    ['Medications', sel.medications || 'None'],
                    ['Medical Conditions', sel.medicalConditions || 'None'],
                  ].map(([l, v]) => (
                    <div key={l} className="data-row">
                      <span className="data-label">{l}</span>
                      <span className="data-value" style={{
                        color: (v === 'Unknown' || v === 'None') ? '#94a3b8'
                          : l.includes('Allergies') || l.includes('Conditions') ? '#b91c1c' : '#1e293b'
                      }}>{v}</span>
                    </div>
                  ))}
                  {sel.notes && <div className="note-box">📝 {sel.notes}</div>}
                </div>

                {/* Emergency contact */}
                <div className="card">
                  <div className="section-label">📞 Emergency Contact</div>
                  <div className="data-row">
                    <span className="data-label">Name</span>
                    <span className="data-value">{sel.emergencyContact || 'Not set'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Phone</span>
                    <span className="data-value" style={{ color: '#059669' }}>{sel.emergencyPhone || 'Not set'}</span>
                  </div>
                  {sel.emergencyPhone && (
                    <a 
                      href={`tel:${sel.emergencyPhone}`} 
                      style={{ 
                        display: 'block', 
                        marginTop: '1rem', 
                        padding: '0.75rem', 
                        background: '#f0fdf4', 
                        border: '1px solid #bbf7d0', 
                        borderRadius: 10, 
                        color: '#059669', 
                        textAlign: 'center', 
                        textDecoration: 'none', 
                        fontSize: '0.9rem', 
                        fontWeight: 600 
                      }}
                    >
                      📞 Call Emergency Contact
                    </a>
                  )}
                </div>

                {/* Rescue actions */}
                {sel.rescueStatus !== 'resolved' && sel.status !== 'SOS_RESOLVED' && (
                  <div className="card">
                    <div className="section-label">⚡ Rescue Actions</div>
                    {sel.rescueStatus !== 'dispatched' && (
                      <button 
                        className="action-btn btn-dispatch" 
                        onClick={() => updateStatus(sel.userId, 'dispatched', `Rescue dispatched to ${sel.name}`)}
                      >
                        🚑 Dispatch Rescue Team
                      </button>
                    )}
                    {sel.rescueStatus === 'dispatched' && (
                      <div style={{ fontSize: '0.85rem', color: '#2563eb', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
                        ◉ Rescue team has been dispatched
                      </div>
                    )}
                    <button 
                      className="action-btn btn-resolve" 
                      onClick={() => updateStatus(sel.userId, 'resolved', `${sel.name} marked as rescued`)}
                    >
                      ✅ Mark as Rescued
                    </button>
                    <button 
                      className="action-btn btn-outline" 
                      onClick={() => { 
                        navigator.clipboard?.writeText(`SOS ALERT\nName: ${sel.name}\nBlood: ${sel.bloodGroup}\nAllergies: ${sel.allergies}\nLocation: ${sel.lat?.toFixed(5)}, ${sel.lon?.toFixed(5)}\nContact: ${sel.emergencyPhone}\nMaps: ${mapsUrl}`); 
                        showToast('Beacon info copied'); 
                      }}
                    >
                      📋 Copy Rescue Brief
                    </button>
                  </div>
                )}

                {/* Resolved state */}
                {(sel.rescueStatus === 'resolved' || sel.status === 'SOS_RESOLVED') && (
                  <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div style={{ fontSize: '1rem', color: '#059669', fontWeight: 600, marginBottom: 4 }}>
                      ✅ Person Rescued
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Resolved at: {fmtTime(sel.resolvedAt)}
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