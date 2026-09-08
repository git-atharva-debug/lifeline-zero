export default function AlertBanner({ level = 'warning', message }) {
  const colors = {
    warning: { bg: 'rgba(249,115,22,0.1)', border: '#f97316', text: '#f97316' },
    danger:  { bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', text: '#ef4444' },
    safe:    { bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', text: '#22c55e' },
  };
  const c = colors[level];
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
      fontWeight: 600, fontSize: '0.9rem'
    }}>
      {message}
    </div>
  );
}