import { API_BASE } from '@/apiBase';
import { apiFetch } from '@/api';
import Logo from '@/components/Logo';
import { useApp } from '@/contexts/AppContext';
import { SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface InviteData { name: string; status: string; properties: string[]; language: string }

const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Cleaner invite (/invite/:token, sent by the owner on WhatsApp): create a Kozy account, then join. Joining ties
 * the account to the cleaner, so the app opens her planning from then on.
 */
export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const { lang } = useApp();
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/invite/${token}`)
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Failed to load invite'));
  }, [token]);

  const fr = (data?.language || lang) === 'fr';

  return (
    <div className="min-h-screen bg-page text-ink flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        {error && (
          <div className="card p-5 flex items-center gap-3 text-danger">
            <AlertCircle size={20} aria-hidden />
            <p className="text-sm">{fr ? 'Cette invitation ne fonctionne plus. Demandez-en une nouvelle au propriétaire.' : 'This invite no longer works. Ask the owner for a new one.'}</p>
          </div>
        )}
        {!data && !error && <div className="flex justify-center"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>}
        {data && (
          <>
            <div className="text-center space-y-1">
              <h1 className="page-title">{fr ? `Bonjour ${data.name}` : `Hello ${data.name}`}</h1>
              <p className="text-sm text-muted">
                {fr ? 'Créez votre compte Kozy pour voir vos ménages' : 'Create your Kozy account to see your cleanings'}
                {data.properties.length > 0 && ` : ${data.properties.join(', ')}`}
              </p>
            </div>
            {clerkEnabled ? <ClerkJoin token={token!} fr={fr} /> : <Join token={token!} fr={fr} />}
          </>
        )}
      </div>
    </div>
  );
}

function ClerkJoin({ token, fr }: { token: string; fr: boolean }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="flex justify-center">
        <SignUp routing="hash" forceRedirectUrl={window.location.href} signInForceRedirectUrl={window.location.href}
          appearance={{ elements: { rootBox: 'w-full', card: 'shadow-none border' } }} />
      </div>
    );
  }
  return <Join token={token} fr={fr} />;
}

function Join({ token, fr }: { token: string; fr: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setBusy(true); setError('');
    const res = await apiFetch(`/invite/${token}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) window.location.href = import.meta.env.BASE_URL; // reload: the app now opens the cleaner view
    else { setError(d.error || 'Error'); setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <button onClick={join} disabled={busy} className="btn-primary w-full min-h-[48px] flex items-center justify-center gap-2">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {fr ? 'Rejoindre et voir mon planning' : 'Join and see my planning'}
      </button>
      {error && <p className="text-sm text-danger text-center">{error}</p>}
    </div>
  );
}
