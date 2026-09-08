// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { AlertProvider } from '../context/AlertContext';
import AlertToast from '../components/AlertToast';

import UserSidebar from '../components/user/UserSidebar';
import CommandSidebar from '../components/command/CommandSidebar';

import Login from '../pages/Login';
import Register from '../pages/Register';

// User pages
import UserDashboard from '../pages/user/UserDashboard';
import SurvivalMode from '../pages/user/SurvivalMode';
import WhatIf from '../pages/user/WhatIf';
import SonicLink from '../pages/user/SonicLink';
import PreparednessScore from '../pages/user/AegisComplete';
import OfflinePacks from '../pages/user/OfflinePacks';
import WearableID from '../pages/user/WearableID';
import Notifications from '../pages/user/Notifications';
import PhantomMap from '../pages/user/PhantomMap';
import ReportIncident from '../pages/user/ReportIncident';
import CivilianBottleneck from '../components/bottleneck/CivilianBottleneck'; // Keep your extra import
import CivilianEmergencyFund from "../pages/user/CivilianEmergencyFund";
// Command pages
import CommandDashboard from '../pages/command/CommandDashboard';
import BroadcastAlerts from '../pages/command/BroadcastAlerts';
import SeverityInbox from '../pages/command/SeverityInbox';
import ResourceTracker from '../pages/command/ResourceTracker';
import AICommandCenter from '../pages/command/AICommandCenter';
import EvacuationControl from '../pages/command/EvacuationControl';
import IncidentControl from '../pages/command/IncidentControl';
import AdminRescueDashboard from '../pages/command/AdminRescueDashboard';
import CommandBottleneck from '../components/bottleneck/CommandBottleneck'; // Keep your extra import
import CommandEmergencyFund from "../pages/command/CommandEmergencyFund";
function UserLayout({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <UserSidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

function CommandLayout({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <CommandSidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <NotificationProvider>
      <Routes>

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* User Routes */}
        <Route
          path="/user/*"
          element={
            <ProtectedRoute>
              <AlertProvider role={user?.role}>
                <AlertToast />
                <UserLayout>
                  <Routes>
                    <Route path="dashboard" element={<UserDashboard />} />
                    <Route path="survival" element={<SurvivalMode />} />
                    <Route path="whatif" element={<WhatIf />} />
                    {/* <Route path="sonic" element={<SonicLink />} /> */}
                    <Route path="preparedness" element={<PreparednessScore />} />
                    <Route path="offline" element={<OfflinePacks />} />
                    <Route path="wearable" element={<WearableID />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="mapping" element={<PhantomMap />} />
                    <Route path="incidents" element={<ReportIncident />} />
                    <Route path="civilian-fund" element={<CivilianEmergencyFund />} />
                    {/* <Route path="bottleneck" element={<CivilianBottleneck />} /> Your extra route */}
                  </Routes>
                </UserLayout>
              </AlertProvider>
            </ProtectedRoute>
          }
        />

        {/* Command Routes */}
        <Route
          path="/command/*"
          element={
            <ProtectedRoute>
              <AlertProvider role={user?.role}>
                <AlertToast />
                <CommandLayout>
                  <Routes>
                    <Route path="dashboard" element={<CommandDashboard />} />
                    <Route path="broadcast" element={<BroadcastAlerts />} />
                    <Route path="inbox" element={<SeverityInbox />} />
                    <Route path="resources" element={<ResourceTracker />} />
                    <Route path="ai" element={<AICommandCenter />} />
                    <Route path="evacuation" element={<EvacuationControl />} />
                    <Route path="incidents" element={<IncidentControl />} />
                    <Route path="sos" element={<AdminRescueDashboard />} />
                    <Route path="command-fund" element={<CommandEmergencyFund />} />
                    <Route path="bottleneck" element={<CommandBottleneck />} /> {/* Your extra route */}
                  </Routes>
                </CommandLayout>
              </AlertProvider>
            </ProtectedRoute>
          }
        />

        {/* Smart Redirect */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to={user.role === 'command' ? '/command/dashboard' : '/user/dashboard'} />
              : <Navigate to="/login" />
          }
        />

        {/* Optional: Catch-all route */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </NotificationProvider>
  );
}