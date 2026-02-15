import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';

const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkLogin() {
  const { lang, setLang, dark, toggleDark } = useApp();
  // Dynamic import to avoid crash when Clerk not configured
  const { SignIn } = require('@clerk/clerk-react');
  const { dark: clerkDark } = require('@clerk/themes');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <div className="flex justify-center">
          <SignIn routing="hash" appearance={{ baseTheme: clerkDark, elements: { rootBox: 'w-full', card: 'shadow-none border dark:border-gray-700 dark:bg-gray-800' } }} />
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="text-blue-500">{dark ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
  );
}

function LegacyLogin() {
  const { login, role } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (login(email, password)) {
      return;
    }
    setError('Invalid credentials');
  };

  if (role) return null; // Redirect handled in App

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            required
          />
          <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-3">
            Sign In
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
        <div className="text-xs text-gray-500 mt-4 text-center">
          Test accounts: owner@example.com / user   cleaner@example.com / user
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="text-blue-500">{dark ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return clerkEnabled ? <ClerkLogin /> : <LegacyLogin />;
}