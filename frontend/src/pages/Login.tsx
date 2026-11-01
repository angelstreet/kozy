import { Moon, Sun } from 'lucide-react';
import Logo from '@/components/Logo';
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
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6 scale-150"><Logo /></div>
        <div className="flex justify-center">
          <SignIn routing="hash" appearance={{ baseTheme: clerkDark, elements: { rootBox: 'w-full', card: 'shadow-none border' } }} />
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-accent">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="icon-btn" aria-label="Theme">{dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}</button>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      return;
    }
    setError('Invalid credentials');
  };

  if (role) return null; // Redirect handled in App

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6 scale-150"><Logo /></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            required
          />
          <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-accent-ink font-semibold rounded-lg py-3">
            Sign In
          </button>
        </form>
        {error && <p className="text-danger text-sm mt-2 text-center">{error}</p>}
        <div className="text-xs text-muted mt-4 text-center">
          Test: owner@example.com / user | Your account: joachim.ndoye@gmail.com / kozy123
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-accent">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="icon-btn" aria-label="Theme">{dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}</button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return clerkEnabled ? <ClerkLogin /> : <LegacyLogin />;
}