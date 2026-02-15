import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

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
  const { setRole } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <div className="space-y-3">
          <button onClick={() => setRole('owner')} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-3">Owner</button>
          <button onClick={() => setRole('cleaner')} className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg py-3">Cleaner</button>
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
