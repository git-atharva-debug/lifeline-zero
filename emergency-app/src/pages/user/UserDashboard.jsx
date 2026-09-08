import { useAuth } from '../../context/AuthContext';
import AlertBanner from '../../components/AlertBanner';
import { useNavigate } from 'react-router-dom';

const features = [
  //{ label: '🚨 Report Emergency', path: '/user/severity', color: '#ef4444', desc: 'Submit AI severity report' },
  { label: '🎯 Risk & Readiness Engine', path: '/user/preparedness', color: '#22c55e', desc: 'Check your readiness %' },
  { label: '🛡️ Survival Mode', path: '/user/survival', color: '#f97316', desc: 'Step-by-step survival guide' },
  { label: '🗺️ Phantom Map', path: '/user/mapping', color: '#10b981', desc: 'Offline 3D indoor routing' },
  { label: '💰 Emergency Funds', path: '/user/civilian-fund', color: '#8b5cf6', desc: 'Access emergency financial support' },
  // { label: '🔊 Sonic Link', path: '/user/sonic', color: '#ec4899', desc: 'SOS via audio signal' },
  { label: '📦 Offline Packs', path: '/user/offline', color: '#8b5cf6', desc: 'Download local risk data' },
  { label: '💳 Wearable ID', path: '/user/wearable', color: '#f59e0b', desc: 'Your emergency digital ID' },
  { label: '🌐 My Alerts', path: '/user/notifications', color: '#3b82f6', desc: 'Multilingual notifications' },
  { label: '🆘 Emergency Report', path: '/user/incidents', color: '#dc2626', desc: 'Report & track emergencies' },
  { label: '🔮 What-If', path: '/user/whatif', color: '#06b6d4', desc: 'Simulate disaster scenarios' },


];

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.9rem' }}>Hey, {user?.name} 👋</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Your personal emergency readiness hub</p>
      </div>

      {/* <AlertBanner level="warning" message="⚠️ Command Center issued: Moderate flood advisory for your zone. Check Evacuation routes." /> */}

      {/* Status Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Preparedness', value: '62%', color: '#f97316' },
          { label: 'Local Risk', value: 'MODERATE', color: '#f59e0b' },
          { label: 'Offline Packs', value: 'Ready', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
        {features.map(f => (
          <div key={f.path} className="card" onClick={() => navigate(f.path)}
            style={{ cursor: 'pointer', borderLeft: `3px solid ${f.color}`, transition: 'transform 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}