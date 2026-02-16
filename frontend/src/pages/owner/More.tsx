import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/api';
import { Loader2, Key, Check, X } from 'lucide-react';

export default function More() {
  const { lang } = useApp();
  const [smoobuKey, setSmoobuKey] = useState('');
  const [smoobuKeyExists, setSmoobuKeyExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const existsRes = await apiFetch('/settings/smoobu-key-exists');
      const existsData = await existsRes.json();
      setSmoobuKeyExists(existsData.exists);

      if (existsData.exists) {
        const keyRes = await apiFetch('/settings/smoobu-key');
        const keyData = await keyRes.json();
        setSmoobuKey(keyData.key || '');
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    setLoading(false);
  };

  const saveSmoobuKey = async () => {
    if (!smoobuKey.trim()) {
      setErrorMessage('API key cannot be empty');
      setSaveStatus('error');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      const res = await apiFetch('/settings/smoobu-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: smoobuKey })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save API key');
      }

      setSaveStatus('success');
      setSmoobuKeyExists(true);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      setSaveStatus('error');
      setErrorMessage(e.message);
    }
    setSaving(false);
  };

  const syncBookings = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await apiFetch('/smoobu-sync', {
        method: 'POST'
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setSyncResult(data);
    } catch (e: any) {
      setSyncResult({ error: e.message });
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">{t('settings', lang)}</h1>

      {/* Smoobu Integration Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Key className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Smoobu Integration</h2>
            <p className="text-sm text-gray-500">Automatically sync bookings with full guest details</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Smoobu API Key</label>
            <input
              type="password"
              value={smoobuKey}
              onChange={(e) => setSmoobuKey(e.target.value)}
              placeholder="Enter your Smoobu API key"
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find your API key in Smoobu Settings → API → API Key
            </p>
          </div>

          <button
            onClick={saveSmoobuKey}
            disabled={saving || !smoobuKey.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Validating...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <Check size={18} />
                Saved!
              </>
            ) : (
              'Save API Key'
            )}
          </button>

          {saveStatus === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2 text-red-700 dark:text-red-400">
              <X size={18} />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {saveStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check size={18} />
              <span className="text-sm">API key saved successfully</span>
            </div>
          )}
        </div>

        {/* Sync Button */}
        {smoobuKeyExists && (
          <div className="pt-4 border-t dark:border-gray-700">
            <button
              onClick={syncBookings}
              disabled={syncing}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {syncing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync Bookings Now'
              )}
            </button>

            {syncResult && (
              <div className={`mt-3 p-3 rounded-lg ${syncResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
                {syncResult.error ? (
                  <p className="text-sm">{syncResult.error}</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Sync completed!</p>
                    <p>Properties synced: {syncResult.synced}</p>
                    <p>Bookings enriched: {syncResult.totalEnriched}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">ℹ️ How it works</p>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>When you add a Smoobu API key, iCal fields will be hidden</li>
            <li>Bookings will be synced automatically with full guest details</li>
            <li>Click "Sync Bookings Now" to manually trigger a sync</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
