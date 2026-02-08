import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';

interface Payment {
  id: number;
  cleaner_id: number;
  task_id: number;
  amount: number;
  paid: number;
  paid_at: string | null;
  cleaner_name: string;
  task_date: string;
  property_name: string;
}

export default function Payments() {
  const { lang } = useApp();
  const { loading, isEmpty } = useProperties();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  useEffect(() => {
    if (!isEmpty) {
      apiFetch('/payments').then(r => r.json()).then(d => setPayments(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isEmpty]);

  const togglePaid = async (p: Payment) => {
    const res = await apiFetch(`/payments/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: !p.paid }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPayments(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x));
    }
  };

  const filtered = payments.filter(p => {
    if (filter === 'unpaid') return !p.paid;
    if (filter === 'paid') return p.paid;
    return true;
  });

  const totalUnpaid = payments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('payments', lang)}</h1>
        <EmptyState
          emoji="💰"
          title="Nothing to track yet"
          subtitle="Payment tracking will appear here once you have properties and cleanings scheduled."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">{t('payments', lang)}</h1>

      {totalUnpaid > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">{lang === 'fr' ? 'À payer' : 'Outstanding'}</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalUnpaid.toFixed(2)} €</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-full ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {f === 'all' ? (lang === 'fr' ? 'Tous' : 'All') : f === 'unpaid' ? (lang === 'fr' ? 'À payer' : 'Unpaid') : (lang === 'fr' ? 'Payés' : 'Paid')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-8">{lang === 'fr' ? 'Aucun paiement' : 'No payments'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-medium">{p.cleaner_name}</p>
                <p className="text-sm text-gray-500">{p.property_name} · {p.task_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{p.amount} €</span>
                <button onClick={() => togglePaid(p)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${p.paid ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {p.paid ? <Check size={16} /> : <Clock size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
