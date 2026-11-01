import { API_BASE } from '@/apiBase';
import { AlertCircle, Home } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';

interface InviteData {
  name: string;
  status: string;
  properties: string[];
  language: string;
}

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          if (d.status === 'active') setAccepted(true);
        }
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || undefined, email: email || undefined })
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else setAccepted(true);
    } catch { setError('Failed to accept invite'); }
    setAccepting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-page"><Loader2 className="animate-spin text-accent" size={32} /></div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="bg-surface rounded-2xl p-8 max-w-md w-full text-center border border-line">
        <p className="flex justify-center mb-4 text-warn"><AlertCircle size={40} strokeWidth={1.5} /></p>
        <h1 className="page-title mb-2">Oops</h1>
        <p className="text-muted">{error}</p>
      </div>
    </div>
  );

  if (accepted) return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="bg-surface rounded-2xl p-8 max-w-md w-full text-center border border-line">
        <div className="w-16 h-16 bg-tint rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-accent" />
        </div>
        <h1 className="page-title mb-2">You're all set!</h1>
        <p className="text-muted mb-6">Welcome to Kozy, {data?.name}! You can now access your cleaning schedule.</p>
        <a href="/kozy" className="inline-block bg-accent text-accent-ink font-semibold px-6 py-3 rounded-xl">Open Kozy</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="bg-surface rounded-2xl p-8 max-w-md w-full">
        <p className="flex justify-center mb-4 text-accent"><Home size={40} strokeWidth={1.5} /></p>
        <h1 className="page-title text-center mb-2">You're invited to Kozy!</h1>
        <p className="text-muted text-center mb-6">
          Hi <strong>{data?.name}</strong>, you've been invited to manage cleaning for:
        </p>

        {data?.properties && data.properties.length > 0 && (
          <div className="bg-tint rounded-xl p-4 mb-6">
            {data.properties.map((p, i) => (
              <p key={i} className="text-accent font-medium">{p}</p>
            ))}
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+33 6 12 34 56 78"
              className="w-full px-3 py-2.5 rounded-xl border bg-surface outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email (optional)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com"
              className="w-full px-3 py-2.5 rounded-xl border bg-surface outline-none" />
          </div>
        </div>

        <button onClick={accept} disabled={accepting}
          className="w-full bg-accent hover:bg-accent-hover disabled:bg-gray-300 text-accent-ink font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/25">
          {accepting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {accepting ? 'Joining...' : 'Accept & Join'}
        </button>
      </div>
    </div>
  );
}
