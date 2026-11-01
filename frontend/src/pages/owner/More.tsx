import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/api';
import { Loader2, Key, Check, X, Users, Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function More() {
  const { lang } = useApp();
  const [smoobuKey, setSmoobuKey] = useState('');
  const [smoobuSecret, setSmoobuSecret] = useState('');
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

      // Note: We don't fetch the actual key for security reasons (it's encrypted in DB)
      // If key exists, show masked version in UI
      if (existsData.exists) {
        setSmoobuKey('****************************************'); // Masked
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
        body: JSON.stringify({ key: smoobuKey, secret: smoobuSecret || undefined })
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
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="page-title">{t('settings', lang)}</h1>

      <Link to="/properties" className="bg-surface rounded-xl border p-5 flex items-center gap-4 hover:bg-page transition-colors lg:hidden">
        <div className="w-10 h-10 rounded-lg bg-tint flex items-center justify-center">
          <Building2 className="text-accent" size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">{t('properties', lang)}</h2>
          <p className="text-sm text-muted">{lang === 'fr' ? 'Vos logements et leurs réglages' : 'Your homes and their settings'}</p>
        </div>
        <ChevronRight className="text-muted" size={20} aria-hidden />
      </Link>

      {/* Cleaners Section */}
      <Link to="/cleaners" className="bg-surface rounded-xl border p-5 flex items-center gap-4 hover:bg-page transition-colors">
        <div className="w-10 h-10 rounded-lg bg-info-tint flex items-center justify-center">
          <Users className="text-info" size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Cleaners</h2>
          <p className="text-sm text-muted">Manage your cleaning team</p>
        </div>
        <ChevronRight className="text-muted" size={20} aria-hidden />
      </Link>

      {/* Smoobu Integration Section */}
      <div className="bg-surface rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-tint flex items-center justify-center">
            <Key className="text-accent" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Smoobu Integration</h2>
            <p className="text-sm text-muted">Automatically sync bookings with full guest details</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Smoobu API Key</label>
            <input
              type="password"
              value={smoobuKey}
              onChange={(e) => setSmoobuKey(e.target.value)}
              placeholder="usr_live_..."
              className="w-full px-3 py-2.5 rounded-xl border bg-surface focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Smoobu API Secret</label>
            <input
              type="password"
              value={smoobuSecret}
              onChange={(e) => setSmoobuSecret(e.target.value)}
              placeholder="Shown once when the key is created"
              className="w-full px-3 py-2.5 rounded-xl border bg-surface focus:ring-2 focus:ring-accent outline-none"
            />
            <p className="text-xs text-muted mt-1">
              Smoobu Settings → Developers → API keys. Requests are signed with the secret (HMAC).
            </p>
          </div>

          <button
            onClick={saveSmoobuKey}
            disabled={saving || !smoobuKey.trim()}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-accent-ink font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
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
            <div className="bg-danger-tint border border-red-200 rounded-lg p-3 flex items-center gap-2 text-danger">
              <X size={18} />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {saveStatus === 'success' && (
            <div className="bg-tint border border-green-200 rounded-lg p-3 flex items-center gap-2 text-accent">
              <Check size={18} />
              <span className="text-sm">API key saved successfully</span>
            </div>
          )}
        </div>

        {/* Sync Button */}
        {smoobuKeyExists && (
          <div className="pt-4 border-t">
            <button
              onClick={syncBookings}
              disabled={syncing}
              className="w-full bg-accent hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-accent-ink font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
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
              <div className={`mt-3 p-3 rounded-lg ${syncResult.error ? 'bg-danger-tint text-danger' : 'bg-tint text-accent'}`}>
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

        <div className="bg-tint rounded-lg p-3 text-sm text-accent">
          <p className="font-medium mb-1">How it works</p>
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
