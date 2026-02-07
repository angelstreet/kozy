import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';

export default function Login() {
  const { login } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, password)) setError(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('username', lang)}</label>
            <input value={username} onChange={e => { setUsername(e.target.value); setError(false); }} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('password', lang)}</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(false); }} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
          {error && <p className="text-red-500 text-sm">Invalid credentials. Try owner/owner or cleaner/cleaner</p>}
          <button type="submit" className="w-full bg-blue-500 text-white rounded-lg py-2 font-medium hover:bg-blue-600">{t('login', lang)}</button>
        </form>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500">{lang === 'en' ? 'FR' : 'EN'}</button>
          <button onClick={toggleDark} className="text-blue-500">{dark ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
  );
}
