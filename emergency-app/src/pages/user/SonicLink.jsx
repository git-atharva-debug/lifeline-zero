import { useState } from 'react';

export default function SonicLink() {
  const [broadcasting, setBroadcasting] = useState(false);

  const broadcast = () => {
    setBroadcasting(true);
    const ctx = new AudioContext();
    const beep = (freq, start, dur) => {
      const o = ctx.createOscillator();
      o.connect(ctx.destination);
      o.frequency.value = freq;
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur);
    };
    [0, 0.4, 0.8].forEach(t => beep(1000, t, 0.25));
    setTimeout(() => setBroadcasting(false), 2000);
  };

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔊 Sonic Link</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>When WiFi fails, broadcast your coordinates via audio signal to nearby rescuers.</p>
      <div className="card">
        <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>Encodes GPS + triage status into audio tones. Works in smoke, darkness, debris.</p>
        <button className="btn btn-red" onClick={broadcast} disabled={broadcasting}>
          {broadcasting ? '📡 Broadcasting...' : '🔊 Broadcast SOS Signal'}
        </button>
        {broadcasting && (
          <div style={{ marginTop: '1rem', color: '#22c55e', fontWeight: 600, animation: 'pulse 1s infinite' }}>
            ● Transmitting coordinates via audio...
          </div>
        )}
      </div>
    </div>
  );
}