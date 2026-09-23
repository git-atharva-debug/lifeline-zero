import { useAuth } from '../../context/AuthContext';
import { SidebarShell } from '../user/UserSidebar';

const links = [
  { to: '/command/dashboard', label: '🎖️ Rescue Overview' },
  { to: '/command/broadcast', label: '📢 Broadcast Alerts' },
  { to: '/command/inbox', label: '📥 Risk Predictive Reports' },
  // { to: '/command/evacuation', label: '🚗 Evacuation Routes' },
  // { to: '/command/bottleneck', label: '🚨 Bottleneck Command' },
  { to: '/command/resources', label: '🚁 Resource Tracker' },
  // { to: '/command/ai', label: '🤖 AI Recommendations' },
  { to: '/command/incidents', label: '🎯 Incident Control' },
  { to: '/command/command-fund', label: '💼 Emergency Fund' },
  { to: '/command/analytics', label: '📊 Live Analytics' },
  { to: '/command/hotspots', label: '🔥 ML Hotspot Prediction' },
];

export default function CommandSidebar() {
  const { user, logout } = useAuth();
  return (
    <SidebarShell
      links={links}
      user={user}
      logout={logout}
      accent="#3b82f6"
      roleLabel="Rescue Command"
      roleIcon="🎖️"
      hideEmergencyProfile={true}
    />
  );
}