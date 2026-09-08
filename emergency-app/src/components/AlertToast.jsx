// src/components/AlertToast.jsx
import { useAlerts } from '../context/AlertContext';

const SEV = {
  CRITICAL: { color: '#ef4444' },
  HIGH:     { color: '#f97316' },
  MODERATE: { color: '#f59e0b' },
  LOW:      { color: '#22c55e' },
};

export default function AlertToast() {
  const { toastAlert, dismissToast, lang, voiceMode, LANGUAGES, getTranslation } = useAlerts();

  if (!toastAlert) return null;

  const color    = SEV[toastAlert.severity]?.color || '#ef4444';
  const langObj  = LANGUAGES.find(l => l.code === lang);
  const text     = getTranslation(toastAlert, lang);

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 99999,
      background: '#0f1623',
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      boxShadow: `0 8px 32px ${color}40`,
      maxWidth: 340, minWidth: 280,
      animation: 'toastSlideIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, animation: 'toastPulse 1s infinite', flexShrink: 0 }} />
        <span style={{ fontSize: '0.78rem', color, fontWeight: 700, flex: 1 }}>
          NEW ALERT — {toastAlert.severity}
        </span>
        <button onClick={dismissToast} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}>✕</button>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.5 }}>
        {text.substring(0, 130)}{text.length > 130 ? '…' : ''}
      </p>

      <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: voiceMode && toastAlert.voiceEnabled ? 6 : 0 }}>
        📍 {toastAlert.zone} · 👤 {toastAlert.sentBy}
      </div>

      {voiceMode && toastAlert.voiceEnabled && (
        <div style={{ fontSize: '0.68rem', color: '#22c55e' }}>
          🔊 Reading aloud in {langObj?.label}
        </div>
      )}

      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: '#1e2d45', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, animation: 'toastShrink 6s linear forwards' }} />
      </div>

      <style>{`
        @keyframes toastSlideIn  { from { opacity:0; transform:translateX(60px); } to { opacity:1; transform:translateX(0); } }
        @keyframes toastPulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes toastShrink   { from{width:100%} to{width:0%} }
      `}</style>
    </div>
  );
}