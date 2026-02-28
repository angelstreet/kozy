import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import RoleSelect from '@/pages/RoleSelect';
import Dashboard from '@/pages/owner/Dashboard';
import Calendar from '@/pages/owner/Calendar';
import Properties from '@/pages/owner/Properties';
import More from '@/pages/owner/More';
import Cleaners from '@/pages/owner/Cleaners';
import Payments from '@/pages/owner/Payments';
import AddProperty from '@/pages/owner/AddProperty';
import EditProperty from '@/pages/owner/EditProperty';
import Analytics from '@/pages/owner/Analytics';
import Schedule from '@/pages/cleaner/Schedule';
import Shopping from '@/pages/cleaner/Shopping';
import CleanerMore from '@/pages/cleaner/CleanerMore';
import CleanerNotifications from '@/pages/cleaner/CleanerNotifications';
import Invite from '@/pages/Invite';

function AppRoutes() {
  const { role, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!role) return <Login />;

  // Signed in but no role selected yet
  if (role === null) return <RoleSelect />;

  return (
    <Routes>
      <Route element={<Layout />}>
        {role === 'owner' && <>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/more" element={<More />} />
          <Route path="/cleaners" element={<Cleaners />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/add-property" element={<AddProperty />} />
          <Route path="/edit-property/:id" element={<EditProperty />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>}
        {role === 'cleaner' && <>
          <Route path="/c/schedule" element={<Schedule />} />
          <Route path="/c/shopping" element={<Shopping />} />
          <Route path="/c/more" element={<CleanerMore />} />
          <Route path="/c/notifications" element={<CleanerNotifications />} />
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
        <BrowserRouter basename={import.meta.env.VITE_BASE_PATH?.replace(/\/$/, '') || ''}>
          <Routes>
            <Route path="/invite/:token" element={<Invite />} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  );
}
