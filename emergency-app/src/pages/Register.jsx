import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .lr-root {
    min-height: 100vh;
    display: grid;
    /* Perfect 50/50 Split */
    grid-template-columns: 1fr 1fr;
    font-family: 'Inter', sans-serif;
    background: #f8fafc;
  }

  /* ── LEFT PANEL ── */
  .lr-left {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 4rem;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    overflow: hidden;
  }

  .lr-left-glow {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 20% 80%, rgba(239, 68, 68, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%);
    pointer-events: none;
  }

  .lr-logo {
    position: absolute;
    top: 4rem;
    left: 4rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .lr-logo-mark {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
  }

  .lr-logo-name {
    font-size: 2.2rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.04em;
    text-transform: uppercase;
    line-height: 1;
    text-shadow: 0 4px 10px rgba(0,0,0,0.3);
  }

  .lr-logo-name span { color: #ef4444; font-weight: 900; }

  .lr-hero-content { position: relative; z-index: 2; }

  .lr-hero-title {
    font-size: 3.5rem;
    font-weight: 800;
    color: #f8fafc;
    line-height: 1.1;
    letter-spacing: -0.04em;
    margin-bottom: 1.5rem;
    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .lr-hero-title span {
    background: linear-gradient(to right, #ef4444, #f87171);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .lr-hero-desc {
    color: #cbd5e1;
    max-width: 440px;
    line-height: 1.6;
    font-size: 1rem;
  }

  /* ── RIGHT PANEL ── */
  .lr-right {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #f8fafc;
    overflow-y: auto;
  }

  .lr-form-wrap {
    width: 100%;
    max-width: 460px;
    padding: 3rem 2.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 32px;
    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.1);
    animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .lr-form-header { 
    margin-bottom: 2rem; 
    text-align: center;
  }
  
  .lr-form-title { 
    font-size: 2rem; 
    font-weight: 800; 
    color: #0f172a; 
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  .lr-form-title span {
    color: #ef4444;
  }

  .lr-form-sub { 
    font-size: 0.9rem; 
    color: #64748b; 
    font-weight: 400;
  }

  /* Error message */
  .lr-error {
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    padding: 1rem 1.2rem;
    color: #b91c1c;
    font-size: 0.9rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid #fecaca;
  }

  /* Role Grid Selector */
  .role-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .role-card {
    padding: 1.25rem 1rem;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .role-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.05);
    border-color: #cbd5e1;
  }

  .role-card.active-user { 
    border-color: #ef4444; 
    background: #fee2e2;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
  }
  
  .role-card.active-command { 
    border-color: #3b82f6; 
    background: #dbeafe;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  .role-label { 
    display: block; 
    font-weight: 700; 
    font-size: 1rem; 
    color: #1e293b; 
    margin-bottom: 4px; 
  }

  .role-desc { 
    font-size: 0.75rem; 
    color: #64748b; 
    line-height: 1.4; 
  }

  .role-card.active-user .role-desc,
  .role-card.active-command .role-desc {
    color: #334155;
    font-weight: 500;
  }

  /* Inputs */
  .lr-field { margin-bottom: 1.25rem; }
  
  .lr-label { 
    display: block; 
    font-size: 0.8rem; 
    font-weight: 600; 
    color: #475569; 
    margin-bottom: 0.4rem; 
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .lr-input {
    width: 100%;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 0.9rem 1.2rem;
    color: #0f172a;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .lr-input:focus { 
    outline: none; 
    border-color: #ef4444; 
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); 
    background: #ffffff;
  }

  .lr-input::placeholder {
    color: #94a3b8;
    font-weight: 300;
  }

  /* Dynamic Buttons */
  .lr-btn {
    width: 100%;
    border: none;
    border-radius: 16px;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .lr-btn.btn-user {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
  }

  .lr-btn.btn-command {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  }

  .lr-btn:hover:not(:disabled) { 
    transform: translateY(-2px); 
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
  }

  .lr-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .lr-btn:disabled { 
    opacity: 0.6; 
    cursor: not-allowed; 
    transform: none;
  }

  .lr-footer { 
    margin-top: 2rem; 
    text-align: center; 
    font-size: 0.9rem; 
    color: #64748b; 
  }
  
  .lr-footer a { 
    color: #ef4444; 
    text-decoration: none; 
    font-weight: 600;
    transition: all 0.2s;
  }

  .lr-footer a:hover {
    color: #dc2626;
    text-decoration: underline;
  }

  .lr-spinner {
    width: 18px; 
    height: 18px; 
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; 
    border-radius: 50%; 
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Responsive */
  @media (max-width: 1024px) {
    .lr-root { grid-template-columns: 1fr; }
    .lr-left { display: none; }
    
    .lr-form-wrap {
      max-width: 90%;
      padding: 2rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .lr-form-wrap {
      padding: 2rem 1.25rem;
    }
    
    .lr-form-title {
      font-size: 1.75rem;
    }
    
    .role-grid {
      gap: 0.75rem;
    }
    
    .role-card {
      padding: 1rem;
    }
  }
`;

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authAPI.register({
        ...form,
        role: form.role === 'command' ? 'command_center' : 'user',
      });
      if (response.success && response.data.token) {
        login(response.data.user, response.data.token);
        navigate(form.role === 'command' ? '/command/dashboard' : '/user/dashboard');
      } else {
        setError(response.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'System error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="lr-root">
        
        {/* LEFT SECTION - Dark gradient for contrast */}
        <section className="lr-left">
          <div className="lr-left-glow" />
          <div className="lr-logo">
            <div className="lr-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="lr-logo-name">LifeLine<span>Zero</span></div>
          </div>

          <div className="lr-hero-content">
            <h1 className="lr-hero-title">
              Join the<br />Network of<br /><span>Resilience.</span>
            </h1>
            <p className="lr-hero-desc">
              Built for speed, reliability, and human life. Secure your credentials to join the network.
            </p>
          </div>
        </section>

        {/* RIGHT SECTION - Clean white with good contrast */}
        <section className="lr-right">
          <div className="lr-form-wrap">
            <header className="lr-form-header">
              <h2 className="lr-form-title">
                Create <span>Account</span>
              </h2>
              <p className="lr-form-sub">Identify your role in the system</p>
            </header>

            {error && (
              <div className="lr-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="role-grid">
              <div 
                className={`role-card ${form.role === 'user' ? 'active-user' : ''}`}
                onClick={() => setForm({...form, role: 'user'})}
              >
                <span className="role-label">Civilian</span>
                <span className="role-desc">Need assistance during emergencies</span>
              </div>
              <div 
                className={`role-card ${form.role === 'command' ? 'active-command' : ''}`}
                onClick={() => setForm({...form, role: 'command'})}
              >
                <span className="role-label">Command</span>
                <span className="role-desc">Coordinate response teams</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="lr-field">
                <label className="lr-label">Full Name</label>
                <input 
                  className="lr-input" 
                  type="text" 
                  placeholder="Pranav Chaudhari" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  required 
                />
              </div>
              
              <div className="lr-field">
                <label className="lr-label">Email Address</label>
                <input 
                  className="lr-input" 
                  type="email" 
                  placeholder="name@agency.gov" 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  required 
                />
              </div>
              
              <div className="lr-field">
                <label className="lr-label">Password</label>
                <input 
                  className="lr-input" 
                  type="password" 
                  placeholder="••••••••" 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                  required 
                />
              </div>

              {/* Dynamic Button Class */}
              <button 
                type="submit" 
                className={`lr-btn ${form.role === 'command' ? 'btn-command' : 'btn-user'}`} 
                disabled={loading}
              >
                {loading ? <div className="lr-spinner" /> : `Register as ${form.role === 'command' ? 'Command Officer' : 'Civilian'}`}
              </button>
            </form>

            <footer className="lr-footer">
              Already have credentials? <Link to="/login">Log In</Link>
            </footer>
          </div>
        </section>
      </div>
    </>
  );
}