import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/owner/Dashboard';
import Calendar from '@/pages/owner/Calendar';
import Properties from '@/pages/owner/Properties';
import More from '@/pages/owner/More';
import Cleaners from '@/pages/owner/Cleaners';
import Payments from '@/pages/owner/Payments';
import AddProperty from '@/pages/owner/AddProperty';
import CleanerDashboard from '@/pages/cleaner/CleanerDashboard';
import CleanerCalendar from '@/pages/cleaner/CleanerCalendar';
import CleanerProperties from '@/pages/cleaner/CleanerProperties';
import CleanerMore from '@/pages/cleaner/CleanerMore';

function AppRoutes() {
  const { role } = useAuth();
  if (!role) return <Login />;

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
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>}
        {role === 'cleaner' && <>
          <Route path="/c/dashboard" element={<CleanerDashboard />} />
          <Route path="/c/calendar" element={<CleanerCalendar />} />
          <Route path="/c/properties" element={<CleanerProperties />} />
          <Route path="/c/more" element={<CleanerMore />} />
          <Route path="*" element={<Navigate to="/c/dashboard" />} />
        </>}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <BrowserRouter basename="/kozy">
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  );
}
