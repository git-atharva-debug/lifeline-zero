// src/pages/command/EvacuationControl.jsx
export default function EvacuationControl() {
  return (
    <div className="page">
      <h1>🚗 Evacuation Control</h1>
      <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Push custom evacuation routes to civilians, manage bottleneck predictions.</p>
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <p style={{ color: '#94a3b8' }}>AI Bottleneck Predictor output feeds directly here. Phase 2 — route editor + civilian push.</p>
      </div>
    </div>
  );
}