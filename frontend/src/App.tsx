import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/owner/Dashboard';
import Properties from '@/pages/owner/Properties';
import More from '@/pages/owner/More';
import Cleaners from '@/pages/owner/Cleaners';
import Payments from '@/pages/owner/Payments';
import Messages from '@/pages/owner/Messages';
import AddProperty from '@/pages/owner/AddProperty';
import EditProperty from '@/pages/owner/EditProperty';
import Schedule from '@/pages/cleaner/Schedule';
import Shopping from '@/pages/cleaner/Shopping';
import Task from '@/pages/cleaner/Task';
import CleanerReport from '@/pages/cleaner/Report';
import CleaningReport from '@/pages/owner/CleaningReport';
import Invite from '@/pages/Invite';
import CleanerLink from '@/pages/CleanerLink';

function AppRoutes() {
  const { role, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-line border-t-accent" />
      </div>
    );
  }

  if (!role) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        {role === 'owner' && <>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={null} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/more" element={<More />} />
          <Route path="/cleaners" element={<Cleaners />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/cleaning/:id" element={<CleaningReport />} />
          <Route path="/add-property" element={<AddProperty />} />
          <Route path="/edit-property/:id" element={<EditProperty />} />
          <Route path="/analytics" element={null} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>}
        {role === 'cleaner' && <>
          <Route path="/c/schedule" element={<Schedule />} />
          <Route path="/c/shopping" element={<Shopping />} />
          <Route path="/c/task/:id" element={<Task />} />
          <Route path="/c/report" element={<CleanerReport />} />
          <Route path="*" element={<Navigate to="/c/schedule" />} />
        </>}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <BrowserRouter basename={window.location.pathname.startsWith('/kozy') ? (import.meta.env.VITE_BASE_PATH?.replace(/\/$/, '') || '') : ''}>
          <Routes>
            <Route path="/invite/:token" element={<Invite />} />
            <Route path="/s/:token" element={<CleanerLink />} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  );
}
