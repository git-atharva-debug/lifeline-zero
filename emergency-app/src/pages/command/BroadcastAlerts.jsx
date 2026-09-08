import { useState, useEffect } from 'react';
import { broadcastAPI } from '../../services/api';

const zones = ['All Zones', 'Zone 1 – North', 'Zone 2 – South', 'Zone 3 – East', 'Zone 4 – West'];

const ALERT_TYPES = [
  { label: 'Flood Warning', key: 'flood_warning', severity: 'HIGH' },
  { label: 'Evacuation Order', key: 'evacuation_order', severity: 'CRITICAL' },
  { label: 'Shelter in Place', key: 'shelter_in_place', severity: 'HIGH' },
  { label: 'All Clear', key: 'all_clear', severity: 'LOW' },
  { label: 'Medical Alert', key: 'medical_alert', severity: 'MODERATE' },
  { label: 'Earthquake Warning', key: 'earthquake_warning', severity: 'CRITICAL' },
  { label: 'Cyclone Warning', key: 'cyclone_warning', severity: 'CRITICAL' },
];

const TEMPLATES = {
  flood_warning: 'FLOOD WARNING: Water levels rising rapidly in your zone. Evacuate immediately to higher ground.',
  evacuation_order: 'MANDATORY EVACUATION: All residents must evacuate immediately. Rescue teams are deployed.',
  shelter_in_place: 'SHELTER IN PLACE: Do not go outside. A hazard has been detected nearby. Seal your doors.',
  all_clear: 'ALL CLEAR: The emergency situation has been resolved. You may return to your homes safely.',
  medical_alert: 'MEDICAL ALERT: Free medical camps set up at Community Hall. Bring injured persons immediately.',
  earthquake_warning: 'EARTHQUAKE WARNING: Strong tremors expected. Move to open ground. Stay away from buildings.',
  cyclone_warning: 'CYCLONE WARNING: Category 3 cyclone approaching. Secure your home and move to shelter immediately.',
};

const SEV_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#22c55e' };
const labelStyle = { fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 };
const sel = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem 1rem', color: '#1a1f36', outline: 'none', width: '100%', fontSize: '14px' };

export default function BroadcastAlerts() {
  const [form, setForm] = useState({ zone: 'All Zones', alertType: ALERT_TYPES[0], message: '', officer: '' });
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    setActiveUsers(Math.floor(Math.random() * 200) + 50);
    const t = setInterval(() => setActiveUsers(n => n + Math.floor(Math.random() * 5) - 2), 5000);
    return () => clearInterval(t);
  }, []);

  // Fetch broadcast history from backend on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await broadcastAPI.getAll(20);
        if (res.success && res.data) setHistory(res.data);
      } catch (err) {
        console.error('Failed to load broadcast history:', err);
      }
    };
    fetchHistory();
  }, []);

  const selectType = (type) => setForm(f => ({ ...f, alertType: type, message: TEMPLATES[type.key] || '' }));

  const broadcast = async () => {
    if (!form.message.trim()) return;
    setStatus('sending');
    try {
      const payload = {
        alertType: form.alertType.key,
        zone: form.zone,
        severity: form.alertType.severity,
        sentBy: form.officer || 'Command Center',
        message: form.message,
      };
      const res = await broadcastAPI.create(payload);
      if (res.success) {
        // Prepend new broadcast to history
        setHistory(h => [res.data, ...h].slice(0, 20));
        setStatus('sent');
        setPreview(false);
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('Broadcast failed:', err);
      setStatus('error');
    }
    setTimeout(() => setStatus(null), 4000);
  };

  const sevColor = SEV_COLORS[form.alertType.severity] || '#64748b';

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '28px', 
            marginBottom: 8,
            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}>
            Broadcast Alerts
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>Push emergency alerts to civilians. All alerts are auto-translated to users' preferred language — including voice readout for accessibility.</p>
        </div>

        {/* Stats - Full width cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Active Users', value: activeUsers, color: '#22c55e' },
            { label: 'Broadcasts Today', value: history.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length, color: '#3b82f6' },
            { label: 'Critical Sent', value: history.filter(h => h.severity === 'CRITICAL').length, color: '#ef4444' },
            { label: 'Zones Covered', value: zones.length, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ 
              background: '#ffffff', 
              border: `1px solid ${s.color}30`, 
              borderRadius: 16, 
              padding: '1.25rem 1rem', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = s.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
              e.currentTarget.style.borderColor = `${s.color}30`;
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status Messages - Full width */}
        {status === 'sending' && (
          <div style={{ 
            background: '#eff6ff', 
            border: '1px solid #3b82f6', 
            borderRadius: 16, 
            padding: '1rem 1.5rem', 
            marginBottom: '2rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            width: '100%'
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 0.8s infinite' }} />
            <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '14px' }}>Broadcasting to {form.zone}…</span>
          </div>
        )}
        {status === 'sent' && (
          <div style={{ 
            background: '#f0fdf4', 
            border: '1px solid #22c55e', 
            borderRadius: 16, 
            padding: '1rem 1.5rem', 
            marginBottom: '2rem',
            width: '100%'
          }}>
            <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }}>Alert sent to {form.zone} — users receive in their language. Voice-enabled users hear it automatically.</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ 
            background: '#fef2f2', 
            border: '1px solid #ef4444', 
            borderRadius: 16, 
            padding: '1rem 1.5rem', 
            marginBottom: '2rem',
            width: '100%'
          }}>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '14px' }}>Failed to broadcast alert. Please check your connection and try again.</span>
          </div>
        )}

        {/* Form Card - Full width */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: 24, 
          padding: '2.5rem', 
          marginBottom: '2rem', 
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          width: '100%'
        }}>
          <label style={labelStyle}>Alert Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {ALERT_TYPES.map(type => {
              const isActive = form.alertType.key === type.key;
              const c = SEV_COLORS[type.severity];
              return (
                <button 
                  key={type.key} 
                  onClick={() => selectType(type)} 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: 16, 
                    textAlign: 'left', 
                    cursor: 'pointer', 
                    border: `2px solid ${isActive ? c : '#e2e8f0'}`, 
                    background: isActive ? `${c}10` : '#ffffff', 
                    color: isActive ? c : '#64748b', 
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#cbd5e0';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: 6 }}>{type.label}</div>
                  <div style={{ fontSize: '13px', opacity: 0.7 }}>{type.severity}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={labelStyle}>Target Zone</label>
              <select style={sel} value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                {zones.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Broadcasting Officer</label>
              <input style={sel} placeholder="e.g. Officer Sharma, Regional HQ" value={form.officer} onChange={e => setForm(f => ({ ...f, officer: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Message (English — auto-translated for all users)</label>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{form.message.length} chars</span>
            </div>
            <textarea rows={4} style={{ ...sel, resize: 'vertical', fontSize: '15px', padding: '1rem' }} placeholder="Type alert in English…" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '8px 0 0' }}>
              Auto-translates to Hindi, Tamil, Bengali, Marathi, Telugu, Gujarati & Urdu. Voice users will hear it spoken aloud in their language.
            </p>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            marginBottom: '2rem', 
            padding: '1rem 1.5rem', 
            background: `${sevColor}08`, 
            border: `1px solid ${sevColor}30`, 
            borderRadius: 16,
            width: '100%'
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: sevColor }} />
            <span style={{ fontSize: '15px', color: sevColor, fontWeight: 600 }}>{form.alertType.severity}</span>
            <span style={{ fontSize: '14px', color: '#64748b' }}>
              {form.alertType.severity === 'CRITICAL' ? '· Vibrates devices + alarm + auto-pinned for users' :
                form.alertType.severity === 'HIGH' ? '· Plays alarm sound for users' : '· Standard delivery'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={broadcast} 
              disabled={!form.message.trim() || status === 'sending'} 
              style={{ 
                padding: '1rem 2rem', 
                borderRadius: 16, 
                fontSize: '16px', 
                fontWeight: 600, 
                background: !form.message.trim() ? '#e2e8f0' : sevColor, 
                color: !form.message.trim() ? '#94a3b8' : '#ffffff', 
                border: 'none', 
                cursor: form.message.trim() ? 'pointer' : 'not-allowed', 
                transition: 'all 0.2s ease',
                boxShadow: form.message.trim() ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                flex: 1,
                minWidth: 200
              }}
              onMouseEnter={(e) => {
                if (form.message.trim() && status !== 'sending') {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (form.message.trim() && status !== 'sending') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                }
              }}
            >
              {status === 'sending' ? 'Broadcasting…' : `Broadcast to ${form.zone}`}
            </button>
            <button 
              onClick={() => setPreview(p => !p)} 
              style={{ 
                padding: '1rem 1.5rem', 
                borderRadius: 16, 
                fontSize: '15px', 
                border: '1px solid #e2e8f0', 
                background: '#ffffff', 
                color: '#64748b', 
                cursor: 'pointer', 
                fontWeight: 500,
                transition: 'all 0.2s ease',
                minWidth: 120
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e0';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {preview ? 'Hide Preview' : 'Preview'}
            </button>
            <button 
              onClick={() => setForm(f => ({ ...f, message: TEMPLATES[f.alertType.key] || '' }))} 
              style={{ 
                padding: '1rem 1.5rem', 
                borderRadius: 16, 
                fontSize: '15px', 
                border: '1px solid #e2e8f0', 
                background: '#ffffff', 
                color: '#64748b', 
                cursor: 'pointer', 
                fontWeight: 500,
                transition: 'all 0.2s ease',
                minWidth: 100
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e0';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Template
            </button>
            <button 
              onClick={() => setForm(f => ({ ...f, message: '' }))} 
              style={{ 
                padding: '1rem 1.5rem', 
                borderRadius: 16, 
                fontSize: '15px', 
                border: '1px solid #e2e8f0', 
                background: '#ffffff', 
                color: '#64748b', 
                cursor: 'pointer', 
                fontWeight: 500,
                transition: 'all 0.2s ease',
                minWidth: 80
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e0';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Preview - Full width */}
        {preview && form.message && (
          <div style={{ 
            background: '#ffffff', 
            border: `2px solid ${sevColor}40`, 
            borderLeft: `6px solid ${sevColor}`, 
            borderRadius: 24, 
            padding: '2rem', 
            marginBottom: '2rem', 
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            width: '100%'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1.25rem' }}>User Preview</div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: sevColor, background: `${sevColor}15`, borderRadius: 999, padding: '4px 14px' }}>{form.alertType.severity}</span>
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#1a1f36' }}>{form.alertType.label}</span>
              <span style={{ fontSize: '14px', color: '#64748b' }}>· {form.zone}</span>
            </div>
            <p style={{ fontSize: '16px', color: '#1a1f36', margin: '0 0 8px', lineHeight: 1.7 }}>{form.message}</p>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '1.25rem' }}>{form.officer || 'Command Center'} · just now</div>
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderRadius: 16, fontSize: '14px', color: '#8b5cf6', border: '1px solid #e2e8f0' }}>
              Translated & spoken aloud for users in their preferred language automatically.
            </div>
          </div>
        )}

        {/* History - Full width */}
        {history.length > 0 && (
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: 24, 
            padding: '2.5rem', 
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            width: '100%'
          }}>
            <div style={{ fontSize: '15px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1.5rem' }}>Broadcast History</div>
            {history.slice(0, 8).map((item, i) => {
              const c = SEV_COLORS[item.severity] || '#64748b';
              const itemKey = item.alertType || item.key;
              const itemTime = item.createdAt || item.timestamp;
              const ago = Math.floor((Date.now() - new Date(itemTime)) / 60000);
              return (
                <div key={item._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 8 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: c }}>{item.severity}</span>
                      <span style={{ fontSize: '15px', color: '#1a1f36', fontWeight: 500 }}>{ALERT_TYPES.find(t => t.key === itemKey)?.label || itemKey}</span>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>→ {item.zone}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.message}</p>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 4 }}>{item.sentBy} · {ago < 1 ? 'just now' : `${ago}m ago`}</div>
                  </div>
                  <button 
                    onClick={() => selectType(ALERT_TYPES.find(t => t.key === itemKey) || ALERT_TYPES[0])} 
                    style={{ 
                      flexShrink: 0, 
                      padding: '0.5rem 1.25rem', 
                      borderRadius: 12, 
                      fontSize: '13px', 
                      border: '1px solid #e2e8f0', 
                      background: '#ffffff', 
                      color: '#64748b', 
                      cursor: 'pointer', 
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#3b82f6';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(59,130,246,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Resend
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}`}</style>
      </div>
    </div>
  );
}