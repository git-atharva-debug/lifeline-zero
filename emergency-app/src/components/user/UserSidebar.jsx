// src/components/user/UserSidebar.jsx
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertContext';
import { emergencyProfileAPI } from '../../services/api';

const links = [
  { to: '/user/dashboard', label: '🏠 My Dashboard' },
  { to: '/user/preparedness', label: '🎯 Risk & Readiness Engine' },
  { to: '/user/whatif', label: '🔮 What-If Scenarios' },
  // { to: '/user/bottleneck', label: '🚗 Evacuation Route Advisor' },
  { to: '/user/sonic', label: '🔊 Sonic Link' },
  { to: '/user/offline', label: '📦 Offline Packs' },
  { to: '/user/wearable', label: '💳 Wearable ID' },
  { to: '/user/mapping', label: '🗺️ Phantom Map' },
  { to: '/user/civilian-fund', label: '💰 Emergency Fund' },
  { to: '/user/survival', label: '🛡️ Survival Mode' },
  { to: '/user/notifications', label: '🌐 My Alerts' },
];

export default function UserSidebar() {
  const { user, logout } = useAuth();
  const { alerts } = useAlerts();

  const unreadCount = alerts.filter(a => !a.read).length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.read).length;

  return (
    <SidebarShell
      links={links}
      user={user}
      logout={logout}
      accent="#10b981"
      roleLabel="Civilian"
      unreadCount={unreadCount}
      criticalCount={criticalCount}
    />
  );
}

export function SidebarShell({
  links,
  user,
  logout,
  accent,
  roleLabel,
  unreadCount = 0,
  criticalCount = 0,
  hideEmergencyProfile = false,
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await emergencyProfileAPI.get();
        if (res.success && res.data) { setProfile(res.data); setDraft(res.data); }
      } catch (err) {
        console.error('Failed to load emergency profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const saveProfile = async () => {
    if (!draft.emergencyContact?.trim()) {
      setSaveMsg('Contact name required'); return;
    }
    const phoneClean = (draft.emergencyPhone || '').replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      setSaveMsg('Valid 10-digit number required'); return;
    }

    setSaving(true); setSaveMsg('');
    try {
      const res = await emergencyProfileAPI.update({ ...draft, emergencyPhone: phoneClean });
      if (res.success) {
        setProfile(res.data); setEditing(false);
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2500);
      }
    } catch (err) {
      setSaveMsg(err.message || 'Save failed');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldUpdate = (key, value, type) => {
    let finalValue = value;
    if (type === 'tel') {
      finalValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (key === 'emergencyContact') {
      finalValue = value.replace(/[^a-zA-Z\s]/g, '');
    }
    setDraft(prev => ({ ...prev, [key]: finalValue }));
  };

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
  const profileComplete = !!(profile.emergencyContact?.trim() && profile.emergencyPhone?.trim());

  return (
    <aside style={{
      width: 280,
      minHeight: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      boxShadow: '2px 0 8px rgba(0,0,0,0.02)',
      position: 'relative',
      zIndex: 10,
      color: '#1e293b',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Subtle gradient top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, #3b82f6, #ef4444)` }} />

      {/* Brand Section */}
      <div style={{ padding: '1.75rem 1.25rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            fontFamily: "'Inter', sans-serif", 
            fontSize: '1.5rem', 
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: '0.25rem',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              LifeLine
            </span>
            <span style={{ color: '#1e293b' }}>Zero</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.3px' }}>Emergency Response System</div>
        </div>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          background: '#f8fafc',
          borderRadius: '100px',
          padding: '0.25rem 0.75rem',
          border: '1px solid #e2e8f0',
        }}>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Profile trigger */}
      {!hideEmergencyProfile && (
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { setShowProfile(s => !s); setEditing(false); setDraft(profile); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: showProfile ? '#f8fafc' : 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '0.65rem 0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.background = '#f8fafc'; 
              e.currentTarget.style.borderColor = '#cbd5e1'; 
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.background = showProfile ? '#f8fafc' : 'transparent'; 
              e.currentTarget.style.borderColor = '#e2e8f0'; 
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '1rem',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            }}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: profileComplete ? accent : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: profileComplete ? accent : '#f59e0b' }} />
                {profileComplete ? 'Profile Verified' : 'Profile Incomplete'}
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', transition: 'transform 0.2s', transform: showProfile ? 'rotate(180deg)' : 'none' }}>▼</span>
          </button>
        </div>
      )}

      {/* Profile panel */}
      {showProfile && !hideEmergencyProfile && (
        <div style={{
          borderBottom: '1px solid #e2e8f0',
          padding: '1rem 1.25rem',
          background: '#f8fafc',
          maxHeight: 380,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emergency Profile</span>
            {!editing ? (
              <button 
                onClick={() => { setEditing(true); setDraft(profile); }} 
                style={{ 
                  fontSize: '0.7rem', 
                  color: accent, 
                  background: 'transparent', 
                  border: `1px solid ${accent}40`, 
                  borderRadius: 4, 
                  padding: '0.2rem 0.6rem', 
                  cursor: 'pointer', 
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}15`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button 
                  onClick={saveProfile} 
                  disabled={saving} 
                  style={{ 
                    fontSize: '0.7rem', 
                    color: '#10b981', 
                    background: 'transparent', 
                    border: '1px solid #10b98140', 
                    borderRadius: 4, 
                    padding: '0.2rem 0.6rem', 
                    cursor: saving ? 'wait' : 'pointer', 
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#10b98115'; }}
                  onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'transparent'; }}
                >
                  Save
                </button>
                <button 
                  onClick={() => setEditing(false)} 
                  style={{ 
                    fontSize: '0.7rem', 
                    color: '#ef4444', 
                    background: 'transparent', 
                    border: '1px solid #ef444440', 
                    borderRadius: 4, 
                    padding: '0.2rem 0.6rem', 
                    cursor: 'pointer', 
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ef444415'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {profileLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>Loading profile...</div>
          ) : !editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Blood Group', value: profile.bloodGroup },
                { label: 'Medical Conditions', value: profile.medicalConditions },
                { label: 'Medications', value: profile.medications },
                { label: 'Allergies', value: profile.allergies },
                { label: 'Emergency Contact', value: profile.emergencyContact },
                { label: 'Contact Phone', value: profile.emergencyPhone },
                { label: 'Relation', value: profile.relation },
                { label: 'Home Address', value: profile.address },
              ].map(f => f.value && (
                <div key={f.label} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#1e293b', wordBreak: 'break-word' }}>{f.value}</div>
                </div>
              ))}
              <NavLink 
                to="/user/wearable" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  marginTop: 8, 
                  background: 'transparent', 
                  border: `1px solid ${accent}40`, 
                  borderRadius: 8, 
                  padding: '0.65rem', 
                  textDecoration: 'none', 
                  fontSize: '0.8rem', 
                  color: accent, 
                  fontWeight: 500, 
                  transition: 'all 0.2s' 
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}15`; e.currentTarget.style.borderColor = accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${accent}40`; }}
              >
                View Wearable QR ID →
              </NavLink>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Blood Group</label>
                <select 
                  value={draft.bloodGroup || ''} 
                  onChange={e => setDraft({ ...draft, bloodGroup: e.target.value })} 
                  style={{ 
                    width: '100%', 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 6, 
                    padding: '0.4rem 0.65rem', 
                    color: '#1e293b', 
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                >
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {[
                { key: 'medicalConditions', label: 'Medical Conditions', options: ["None", "Diabetes", "Hypertension", "Asthma", "Cardiac Issues", "Epilepsy", "Physical Disability", "Chronic Pain", "Other"] },
                { key: 'medications', label: 'Medications', options: ["None", "Insulin", "Blood Pressure Meds", "Inhaler", "Blood Thinners", "Anticonvulsants", "Painkillers", "Other"] },
                { key: 'allergies', label: 'Allergies', options: ["None", "Penicillin", "Latex", "Peanuts", "Shellfish", "Pollen", "NSAIDs", "Dairy", "Other"] },
                { key: 'emergencyContact', label: 'Emergency Contact', placeholder: 'Full name' },
                { key: 'emergencyPhone', label: 'Contact Phone', placeholder: '10-digit number', type: 'tel' },
                { key: 'relation', label: 'Relation', options: ["Spouse", "Father", "Mother", "Sibling", "Son", "Daughter", "Guardian", "Friend", "Neighbor", "Other"] },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 2 }}>{field.label}</label>
                  {field.options ? (
                    <select
                      value={draft[field.key] || ''}
                      onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}
                      style={{ 
                        width: '100%', 
                        background: '#ffffff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 6, 
                        padding: '0.4rem 0.65rem', 
                        color: '#1e293b', 
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    >
                      <option value="">Select Option</option>
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      placeholder={field.placeholder}
                      value={draft[field.key] || ''}
                      onChange={e => handleFieldUpdate(field.key, e.target.value, field.type)}
                      style={{ 
                        width: '100%', 
                        background: '#ffffff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 6, 
                        padding: '0.4rem 0.65rem', 
                        color: '#1e293b', 
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  )}
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Home Address</label>
                <textarea 
                  placeholder="Full home address" 
                  rows={2} 
                  value={draft.address || ''} 
                  onChange={e => setDraft({ ...draft, address: e.target.value })} 
                  style={{ 
                    width: '100%', 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 6, 
                    padding: '0.4rem 0.65rem', 
                    color: '#1e293b', 
                    fontSize: '0.85rem', 
                    resize: 'vertical',
                    outline: 'none',
                  }} 
                />
              </div>
              <button 
                onClick={saveProfile} 
                disabled={saving} 
                style={{ 
                  marginTop: 8, 
                  width: '100%', 
                  padding: '0.6rem', 
                  background: accent, 
                  border: 'none', 
                  borderRadius: 8, 
                  color: '#ffffff', 
                  fontWeight: 600, 
                  fontSize: '0.85rem', 
                  cursor: saving ? 'wait' : 'pointer', 
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1.05)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
              >
                {saving ? 'Saving...' : 'Save Emergency Profile'}
              </button>
              {saveMsg && <div style={{ fontSize: '0.75rem', color: saveMsg.includes('✅') ? '#10b981' : '#ef4444', textAlign: 'center', marginTop: 4 }}>{saveMsg}</div>}
            </div>
          )}
        </div>
      )}

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {links.map(l => {
          const isNotifications = l.to === '/user/notifications';
          const hasUnread = isNotifications && unreadCount > 0;

          return (
            <NavLink 
              key={l.to} 
              to={l.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0.7rem 1rem',
                borderRadius: 8,
                color: isActive ? '#1e293b' : '#64748b',
                background: isActive ? '#f8fafc' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s',
                position: 'relative',
                borderLeft: isActive ? `3px solid ${accent}` : '3px solid transparent',
              })}
              onMouseEnter={e => { 
                if (!e.currentTarget.classList.contains('active')) { 
                  e.currentTarget.style.background = '#f8fafc'; 
                  e.currentTarget.style.color = '#1e293b'; 
                } 
              }}
              onMouseLeave={e => { 
                if (!e.currentTarget.classList.contains('active')) { 
                  e.currentTarget.style.background = 'transparent'; 
                  e.currentTarget.style.color = '#64748b'; 
                } 
              }}
            >
              <span>{l.label}</span>
              {hasUnread && (
                <span style={{ 
                  marginLeft: 'auto', 
                  background: criticalCount > 0 ? '#ef4444' : '#f59e0b', 
                  color: '#ffffff', 
                  borderRadius: 20, 
                  padding: '0.1rem 0.5rem', 
                  fontSize: '0.65rem', 
                  fontWeight: 600, 
                  minWidth: 18, 
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}>
                  {unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
        <button 
          onClick={logout}
          style={{ 
            width: '100%', 
            padding: '0.7rem', 
            background: 'transparent', 
            border: '1px solid #e2e8f0', 
            borderRadius: 8, 
            color: '#64748b', 
            fontSize: '0.9rem', 
            fontWeight: 500, 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            transition: 'all 0.2s' 
          }}
          onMouseEnter={e => { 
            e.currentTarget.style.background = '#fef2f2'; 
            e.currentTarget.style.borderColor = '#ef4444'; 
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(239,68,68,0.1)';
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.background = 'transparent'; 
            e.currentTarget.style.borderColor = '#e2e8f0'; 
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}