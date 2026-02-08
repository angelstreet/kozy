import { SignIn } from '@clerk/clerk-react';
import { useApp } from '@/contexts/AppContext';

export default function Login() {
  const { lang, setLang, dark, toggleDark } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <div className="flex justify-center">
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border dark:border-gray-700 dark:bg-gray-800',
              },
            }}
          />
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="text-blue-500">{dark ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
  );
}
