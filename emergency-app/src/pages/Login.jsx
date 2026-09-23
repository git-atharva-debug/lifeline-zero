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

  .lr-logo-name span { 
    color: #ef4444; 
    font-weight: 900;
  }

  .lr-hero-content {
    position: relative;
    z-index: 2;
  }

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
    font-size: 1.1rem;
    color: #cbd5e1;
    line-height: 1.6;
    max-width: 480px;
    margin-bottom: 3rem;
  }

  .lr-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    z-index: 2;
    position: absolute;
    bottom: 4rem;
    left: 4rem;
    right: 4rem;
  }

  .lr-stat-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.8rem;
    font-weight: 700;
    color: #ef4444;
    text-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  .lr-stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
    margin-top: 4px;
    font-weight: 500;
  }

  /* ── RIGHT PANEL ── */
  .lr-right {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #f8fafc;
  }

  .lr-form-wrap {
    width: 100%;
    max-width: 420px;
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
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
  }

  .lr-form-title span {
    color: #ef4444;
  }

  .lr-form-sub {
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 400;
  }

  .lr-field { 
    margin-bottom: 1.5rem; 
  }

  .lr-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.5rem;
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

  .lr-btn {
    width: 100%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
  }

  .lr-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
  }

  .lr-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .lr-or-divider {
    display: flex;
    align-items: center;
    margin: 1.5rem 0;
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .lr-or-divider::before,
  .lr-or-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .lr-or-divider span {
    padding: 0 12px;
  }

  .lr-btn-secondary {
    width: 100%;
    background: #ffffff;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .lr-btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #ef4444;
    color: #ef4444;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
  }

  .lr-btn:disabled, .lr-btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

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

  .lr-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .lr-footer {
    margin-top: 2.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: #94a3b8;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: 500;
  }

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
  }
`;

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Credentials required');
    
    setLoading(true);
    try {
      const response = await authAPI.login(form);
      if (response.success && response.data.token) {
        const { user, token } = response.data;
        login(user, token);
        navigate(user.role === 'command' ? '/command/dashboard' : '/user/dashboard');
      } else {
        setError(response.message || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'System error. Try again.');
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
              Save lives.<br />
              Move fast.<br />
              <span>Stay ready.</span>
            </h1>
            <p className="lr-hero-desc">
              Real-time emergency coordination for teams that demand absolute uptime and zero latency.
            </p>
          </div>

          <div className="lr-stats">
            <div>
              <div className="lr-stat-val">99.9%</div>
              <div className="lr-stat-label">Uptime</div>
            </div>
            <div>
              <div className="lr-stat-val">1.2s</div>
              <div className="lr-stat-label">Latency</div>
            </div>
            <div>
              <div className="lr-stat-val">500+</div>
              <div className="lr-stat-label">Units</div>
            </div>
          </div>
        </section>

        {/* RIGHT SECTION - Clean white with good contrast */}
        <section className="lr-right">
          <div className="lr-form-wrap">
            <header className="lr-form-header">
              <h2 className="lr-form-title">
                System <span>Login</span>
              </h2>
              <p className="lr-form-sub">Secure access for Civilian & Command personnel</p>
            </header>

            {error && (
              <div className="lr-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="lr-field">
                <label className="lr-label">Personnel Email</label>
                <input
                  type="email"
                  placeholder="name@agency.gov"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                  className="lr-input"
                  required
                />
              </div>

              <div className="lr-field">
                <label className="lr-label">Access Key</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  disabled={loading}
                  className="lr-input"
                  required
                />
              </div>

              <button type="submit" className="lr-btn" disabled={loading}>
                {loading ? <div className="lr-spinner" /> : 'Authorize Access'}
              </button>

              <div className="lr-or-divider">
                <span>OR</span>
              </div>

              <Link to="/register" className="lr-btn-secondary">
                Create New Account
              </Link>
            </form>

            <footer className="lr-footer">
              Terminal v4.2 // Encrypted
            </footer>
          </div>
        </section>
      </div>
    </>
  );
}