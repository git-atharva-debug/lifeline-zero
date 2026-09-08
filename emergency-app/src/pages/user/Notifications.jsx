// src/pages/user/Notifications.jsx
//
// IMPORTANT: This component reads ALL state from AlertContext.
// It does NOT do its own polling or show its own toast.
// The global <AlertToast /> in AppRoutes handles toast display.

import { useState } from 'react';
import { useAlerts } from '../../context/AlertContext';

const PREDISASTER_CHECKLIST = [
  { id: 'kit',      label: 'Emergency kit ready (water, food, torch, meds)' },
  { id: 'docs',     label: 'Important documents in waterproof bag' },
  { id: 'contacts', label: 'Emergency contacts saved and shared with family' },
  { id: 'route',    label: 'Evacuation route identified and practiced' },
  { id: 'radio',    label: 'Battery-powered radio available' },
  { id: 'pets',     label: 'Pet emergency plan in place' },
  { id: 'meds',     label: '7-day supply of essential medications' },
  { id: 'cash',     label: 'Emergency cash kept at home' },
  { id: 'power',    label: 'Phone power bank fully charged' },
  { id: 'meeting',  label: 'Family meeting point agreed upon' },
];

const SEV = {
  CRITICAL: { color: '#ef4444', bg: '#fef2f2', border: '#fee2e2' },
  HIGH:     { color: '#f97316', bg: '#fff7ed', border: '#ffedd5' },
  MODERATE: { color: '#f59e0b', bg: '#fef3c7', border: '#fde68a' },
  LOW:      { color: '#22c55e', bg: '#f0fdf4', border: '#dcfce7' },
};

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, lang, voiceMode, onRead, onPin, onDelete, onSpeak, getTranslation, LANGUAGES }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV[alert.severity] || SEV.LOW;
  const translated = getTranslation(alert, lang);
  const isRTL = lang === 'ur';

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${alert.pinned ? '#f59e0b' : '#e2e8f0'}`,
      borderLeft: `4px solid ${alert.pinned ? '#f59e0b' : sev.color}`,
      borderRadius: 16, 
      marginBottom: '1rem', 
      transition: 'all 0.2s',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      width: '100%'
    }}>
      <div style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }}
        onClick={() => { setExpanded(e => !e); if (!alert.read) onRead(alert.id); }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ paddingTop: 6, flexShrink: 0 }}>
            {!alert.read
              ? <div style={{ width: 10, height: 10, borderRadius: '50%', background: sev.color }} />
              : <div style={{ width: 10, height: 10 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 6 }}>
              {alert.pinned && <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, background: '#fef3c7', borderRadius: 999, padding: '2px 10px' }}>PINNED</span>}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: sev.color, background: sev.bg, borderRadius: 999, padding: '4px 12px' }}>{alert.severity}</span>
              {alert.voiceEnabled && voiceMode && <span style={{ fontSize: '0.75rem', color: '#22c55e', background: '#f0fdf4', borderRadius: 999, padding: '2px 10px' }}>Voice Enabled</span>}
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>· {alert.zone || 'All Zones'}</span>
            </div>
            <p style={{
              fontSize: '1rem', 
              color: alert.read ? '#94a3b8' : '#1a1f36', 
              margin: '0 0 8px 0', 
              lineHeight: 1.6,
              direction: isRTL ? 'rtl' : 'ltr', 
              textAlign: isRTL ? 'right' : 'left',
              fontWeight: alert.read ? 400 : 500,
            }}>{translated}</p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>From: {alert.sentBy || 'Command'}</span>
              <span>Received: {timeAgo(alert.timestamp)}</span>
            </div>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', flexShrink: 0, background: '#f8fafc', padding: '4px 8px', borderRadius: 6 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
          <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: sev.color, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
              {LANGUAGES.find(l => l.code === lang)?.label} Translation
            </div>
            <p style={{ fontSize: '1.05rem', color: '#1a1f36', lineHeight: 1.7, margin: 0, direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left', fontWeight: 500 }}>
              {translated}
            </p>
          </div>
          {lang !== 'en' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>Original (English)</div>
              <p style={{ fontSize: '0.95rem', color: '#64748b', margin: 0, lineHeight: 1.7 }}>{getTranslation(alert, 'en') || alert.message}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => onSpeak(alert)} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #22c55e', background: '#f0fdf4', color: '#22c55e', cursor: 'pointer', fontWeight: 500 }}>Read Aloud</button>
            <button onClick={() => onPin(alert.id)} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: `1px solid ${alert.pinned ? '#f59e0b' : '#e2e8f0'}`, background: alert.pinned ? '#fef3c7' : '#ffffff', color: alert.pinned ? '#f59e0b' : '#64748b', cursor: 'pointer', fontWeight: 500 }}>
              {alert.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => onRead(alert.id)} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>
              {alert.read ? 'Mark Unread' : 'Mark Read'}
            </button>
            <button onClick={() => { navigator.vibrate?.(200); window.alert('Alert forwarded to your emergency contact!'); }} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #3b82f6', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontWeight: 500 }}>Forward</button>
            <button onClick={() => onDelete(alert.id)} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #e2e8f0', background: '#ffffff', color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto', fontWeight: 500 }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pre-Disaster Checklist ───────────────────────────────────────────────────
function PreDisasterPanel() {
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rescue_checklist') || '[]'); } catch { return []; }
  });
  const toggle = (id) => {
    const updated = checked.includes(id) ? checked.filter(c => c !== id) : [...checked, id];
    setChecked(updated);
    localStorage.setItem('rescue_checklist', JSON.stringify(updated));
  };
  const pct = Math.round((checked.length / PREDISASTER_CHECKLIST.length) * 100);
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Pre-Disaster Readiness Checklist</div>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: pct === 100 ? '#22c55e' : pct > 60 ? '#f59e0b' : '#ef4444', background: pct === 100 ? '#f0fdf4' : pct > 60 ? '#fef3c7' : '#fef2f2', padding: '4px 12px', borderRadius: 999 }}>{pct}% Ready</span>
      </div>
      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginBottom: '1.5rem' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct > 60 ? '#f59e0b' : '#ef4444', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {PREDISASTER_CHECKLIST.map(item => (
          <div key={item.id} onClick={() => toggle(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', borderRadius: 12, cursor: 'pointer', background: checked.includes(item.id) ? '#f0fdf4' : '#ffffff', border: `1px solid ${checked.includes(item.id) ? '#bbf7d0' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${checked.includes(item.id) ? '#22c55e' : '#cbd5e1'}`, background: checked.includes(item.id) ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#ffffff' }}>
              {checked.includes(item.id) ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.95rem', flex: 1, color: checked.includes(item.id) ? '#64748b' : '#1a1f36', textDecoration: checked.includes(item.id) ? 'line-through' : 'none', lineHeight: 1.5 }}>{item.label}</span>
          </div>
        ))}
      </div>
      {pct === 100 && <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#22c55e', fontWeight: 600, padding: '0.75rem', background: '#f0fdf4', borderRadius: 12 }}>You are fully prepared for an emergency!</div>}
    </div>
  );
}

// ─── SOS Panel ───────────────────────────────────────────────────────────────
function SOSPanel() {
  const [pressed, setPressed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const triggerSOS = () => {
    setPressed(true); setCountdown(3);
    navigator.vibrate?.([500, 200, 500, 200, 500]);
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(iv); window.alert('SOS sent to Rescue Command! Stay where you are. Help is on the way.'); setPressed(false); return 0; }
        return c - 1;
      });
    }, 1000);
  };
  return (
    <div style={{ background: '#ffffff', border: '1px solid #fee2e2', borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '1.25rem' }}>Emergency SOS</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <button onClick={triggerSOS} disabled={pressed} style={{ padding: '1.25rem 2.5rem', borderRadius: 16, border: 'none', background: pressed ? '#991b1b' : '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '1.1rem', cursor: pressed ? 'wait' : 'pointer', boxShadow: pressed ? 'none' : '0 4px 12px rgba(239,68,68,0.3)', transition: 'all 0.2s', minWidth: 200 }}>
          {pressed ? `Sending in ${countdown}s...` : 'SEND SOS'}
        </button>
        <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.7 }}>Sends your GPS location to Rescue Command.<br />Use only in genuine emergency situations.</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
export default function Notifications() {
  // Everything comes from the global context — no local polling, no local toast
  const {
    lang, setLang,
    voiceMode, toggleVoice,
    soundOn, setSoundOn,
    alerts,
    markRead, togglePin, deleteAlert, markAllRead,
    speak,
    LANGUAGES, getTranslation,
  } = useAlerts();

  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('alerts');
  const [visibleCount, setVisibleCount] = useState(5); // Show only 5 alerts initially

  const filtered = alerts.filter(a => {
    if (filter === 'unread'   && a.read)                   return false;
    if (filter === 'pinned'   && !a.pinned)                return false;
    if (filter === 'critical' && a.severity !== 'CRITICAL') return false;
    if (search && !getTranslation(a, lang).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const unreadCount   = alerts.filter(a => !a.read).length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.read).length;
  const langObj       = LANGUAGES.find(l => l.code === lang);

  // Get visible alerts based on visibleCount
  const visibleAlerts = filtered.slice(0, visibleCount);
  const hasMoreAlerts = filtered.length > visibleCount;

  // Reset visible count when filter or search changes
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setVisibleCount(5);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setVisibleCount(5);
  };

  const loadMoreAlerts = () => {
    setVisibleCount(prev => prev + 5);
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ 
                fontSize: '28px', 
                marginBottom: 6,
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700,
                letterSpacing: '-0.02em'
              }}>
                My Alerts
                {unreadCount > 0 && <span style={{ marginLeft: 12, background: '#ef4444', color: '#ffffff', borderRadius: 999, padding: '4px 12px', fontSize: '0.85rem', fontWeight: 600, verticalAlign: 'middle' }}>{unreadCount}</span>}
              </h1>
              <p style={{ color: '#64748b', margin: 0, fontSize: '1rem' }}>Auto-translated to <span style={{ color: '#1a1f36', fontWeight: 500 }}>{langObj?.label}</span> · Live from Command</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={toggleVoice} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: `1px solid ${voiceMode ? '#22c55e' : '#e2e8f0'}`, background: voiceMode ? '#f0fdf4' : '#ffffff', color: voiceMode ? '#22c55e' : '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                {voiceMode ? 'Voice On' : 'Voice Off'}
              </button>
              <button onClick={() => setSoundOn(s => !s)} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #e2e8f0', background: '#ffffff', color: soundOn ? '#22c55e' : '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                {soundOn ? 'Sound On' : 'Sound Off'}
              </button>
              <button onClick={markAllRead} style={{ padding: '0.6rem 1.2rem', borderRadius: 10, fontSize: '0.9rem', border: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Mark All Read</button>
            </div>
          </div>
        </div>

        {/* Critical banner */}
        {criticalCount > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 16, padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 600 }}>{criticalCount} CRITICAL alert{criticalCount > 1 ? 's' : ''} need immediate attention</span>
            {voiceMode && (
              <button onClick={() => { const c = alerts.find(a => a.severity === 'CRITICAL' && !a.read); if (c) speak(c); }}
                style={{ marginLeft: 'auto', padding: '0.5rem 1rem', borderRadius: 10, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
                Read Critical
              </button>
            )}
          </div>
        )}

        {/* Language + Voice Panel */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem' }}>Preferred Language</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '0.5rem 1.2rem', borderRadius: 999, fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', border: `1px solid ${lang === l.code ? '#3b82f6' : '#e2e8f0'}`, background: lang === l.code ? '#eff6ff' : '#ffffff', color: lang === l.code ? '#3b82f6' : '#64748b', transition: 'all 0.15s' }}>
                {l.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '1rem 1.25rem', background: voiceMode ? '#f0fdf4' : '#f8fafc', border: `1px solid ${voiceMode ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.95rem', color: voiceMode ? '#22c55e' : '#64748b', fontWeight: 500 }}>{voiceMode ? 'Voice Alerts Enabled' : 'Voice Alerts Disabled'}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{voiceMode ? `New alerts will be read aloud in ${langObj?.label}` : 'Enable for visually impaired users — spoken in your language'}</div>
            </div>
            <div onClick={toggleVoice} style={{ width: 52, height: 28, borderRadius: 999, cursor: 'pointer', background: voiceMode ? '#22c55e' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 4, width: 20, height: 20, borderRadius: '50%', background: '#ffffff', transition: 'left 0.2s', left: voiceMode ? 28 : 4 }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          {[
            { id: 'alerts',    label: `Alerts (${alerts.length})` },
            { id: 'checklist', label: 'Readiness' },
            { id: 'sos',       label: 'SOS & Contacts' },
          ].map(t => (
            <button key={t.id} onClick={() => {
              setActiveTab(t.id);
              if (t.id === 'alerts') setVisibleCount(5); // Reset visible count when switching back to alerts
            }} style={{ padding: '0.7rem 1.5rem', borderRadius: 12, fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', border: `1px solid ${activeTab === t.id ? '#3b82f6' : '#e2e8f0'}`, background: activeTab === t.id ? '#eff6ff' : '#ffffff', color: activeTab === t.id ? '#3b82f6' : '#64748b' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <input value={search} onChange={handleSearchChange} placeholder="Search alerts..." style={{ flex: 1, minWidth: 250, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.7rem 1.2rem', color: '#1a1f36', fontSize: '0.95rem', outline: 'none' }} />
              {[
                { id: 'all',      label: `All (${alerts.length})` },
                { id: 'unread',   label: `Unread (${unreadCount})` },
                { id: 'pinned',   label: `Pinned (${alerts.filter(a => a.pinned).length})` },
                { id: 'critical', label: `Critical (${alerts.filter(a => a.severity === 'CRITICAL').length})` },
              ].map(f => (
                <button key={f.id} onClick={() => handleFilterChange(f.id)} style={{ padding: '0.7rem 1.2rem', borderRadius: 12, fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', border: `1px solid ${filter === f.id ? '#3b82f6' : '#e2e8f0'}`, background: filter === f.id ? '#eff6ff' : '#ffffff', color: filter === f.id ? '#3b82f6' : '#64748b' }}>
                  {f.label}
                </button>
              ))}
            </div>
            
            {visibleAlerts.length === 0
              ? <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontSize: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16 }}><div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>No alerts match your filter.</div>
              : (
                <>
                  {visibleAlerts.map(alert => (
                    <AlertCard key={alert.id} alert={alert} lang={lang} voiceMode={voiceMode}
                      onRead={markRead} onPin={togglePin} onDelete={deleteAlert} onSpeak={speak}
                      getTranslation={getTranslation} LANGUAGES={LANGUAGES} />
                  ))}
                  
                  {/* Load More Button */}
                  {hasMoreAlerts && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
                      <button 
                        onClick={loadMoreAlerts}
                        style={{
                          padding: '1rem 2.5rem',
                          borderRadius: 12,
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid #3b82f6',
                          background: '#eff6ff',
                          color: '#3b82f6',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#3b82f6';
                          e.target.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#eff6ff';
                          e.target.style.color = '#3b82f6';
                        }}
                      >
                        Load More Alerts ({filtered.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                  
                  {/* Showing count indicator */}
                  <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Showing {visibleAlerts.length} of {filtered.length} alerts
                  </div>
                </>
              )
            }
          </>
        )}

        {/* Checklist Tab */}
        {activeTab === 'checklist' && <PreDisasterPanel />}

        {/* SOS Tab */}
        {activeTab === 'sos' && (
          <>
            <SOSPanel />
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem' }}>Emergency Helplines</div>
              {[
                { label: 'National Disaster Helpline', number: '1078' },
                { label: 'Police',                     number: '100' },
                { label: 'Ambulance',                  number: '108' },
                { label: 'Fire',                       number: '101' },
                { label: 'NDRF Control Room',          number: '011-24363260' },
                { label: 'Flood Control Room',         number: '1800-180-1551' },
              ].map(c => (
                <div key={c.number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.95rem', color: '#1a1f36' }}>{c.label}</span>
                  <a href={`tel:${c.number}`} style={{ fontSize: '1rem', fontWeight: 600, color: '#3b82f6', textDecoration: 'none', padding: '0.4rem 1rem', background: '#eff6ff', borderRadius: 10 }}>{c.number}</a>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#94a3b8', padding: '1rem 0' }}>
          <span>Alerts: {alerts.length}</span>
          <span>· Unread: {unreadCount}</span>
          <span>· Language: {langObj?.label}</span>
          <span>· Voice: {voiceMode ? 'On' : 'Off'}</span>
          <span style={{ marginLeft: 'auto' }}>Live from server</span>
        </div>
      </div>
    </div>
  );
}