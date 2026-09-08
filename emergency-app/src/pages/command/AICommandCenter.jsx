import { useState } from 'react';

export default function AICommandCenter() {
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState(null);

  const generate = () => {
    setLoading(true);
    setTimeout(() => {
      setRecs([
        { priority: 'P1', action: 'Deploy 2 rescue boats to Zone 3 — 180 civilians in flood-inundated area', type: 'danger' },
        { priority: 'P2', action: 'Broadcast evacuation order to Zone 4 — bridge bottleneck predicted in 27 min', type: 'warning' },
        { priority: 'P3', action: 'Pre-position MED-5 ambulance near Zone 2 shelter — 34 elderly civilians reported', type: 'warning' },
        { priority: 'P4', action: 'Activate offline pack push to Zone 3 — cell tower degraded', type: 'safe' },
      ]);
      setLoading(false);
    }, 2000);
  };

  const typeStyles = {
    danger: { border: '#ef4444', tag: 'rgba(239,68,68,0.15)', tagText: '#ef4444' },
    warning: { border: '#f97316', tag: 'rgba(249,115,22,0.15)', tagText: '#f97316' },
    safe: { border: '#22c55e', tag: 'rgba(34,197,94,0.15)', tagText: '#22c55e' },
  };

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🤖 AI Command Recommendations</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>AI synthesizes live reports, resource status, and risk data into prioritized commands.</p>

      <div className="card">
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
          AI analyzes: 47 active reports · 12 deployed units · 8 monitored zones · Bottleneck predictions
        </p>
        <button className="btn btn-blue" onClick={generate} disabled={loading}>
          {loading ? '⚙️ Analyzing situation...' : '🤖 Generate AI Command Plan'}
        </button>
      </div>

      {recs && recs.map((r, i) => {
        const s = typeStyles[r.type];
        return (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${s.border}`, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ background: s.tag, color: s.tagText, borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{r.priority}</span>
            <div>
              <p style={{ fontSize: '0.9rem' }}>{r.action}</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button className="btn btn-green" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>✓ Execute</button>
                <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>Dismiss</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}