import { apiFetch } from '@/api';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { API_BASE } from '@/apiBase';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function EditProperty() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invalidateCache } = useApp();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', address: '', ical_airbnb: '', ical_booking: '',
    checkout_time: '10:00', checkin_time: '16:00', cleaning_mins: 120,
    rate: 50, sunday_rate: 70, color: '#3B82F6',
  });

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiFetch(`/properties`).then(r => r.json()).then(data => {
      const p = (Array.isArray(data) ? data : []).find((x: any) => x.id === Number(id));
      if (p) {
        setForm({
          name: p.name || '', address: p.address || '',
          ical_airbnb: p.ical_airbnb || '', ical_booking: p.ical_booking || '',
          checkout_time: p.checkout_time || '10:00', checkin_time: p.checkin_time || '16:00',
          cleaning_mins: p.cleaning_mins || 120, rate: p.rate || 50,
          sunday_rate: p.sunday_rate || 70, color: p.color || '#3B82F6',
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const submit = async () => {
    setSaving(true);
    try {
      await apiFetch(`/properties/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      invalidateCache(`${API_BASE}/properties`);
      navigate('/properties');
    } catch { alert('Failed to save'); }
    setSaving(false);
  };

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-lg flex-1">Edit Property</h1>
      </header>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Property Name *</label>
          <input value={form.name} onChange={e => upd('name', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input value={form.address} onChange={e => upd('address', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Checkout Time</label>
            <input type="time" value={form.checkout_time} onChange={e => upd('checkout_time', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Checkin Time</label>
            <input type="time" value={form.checkin_time} onChange={e => upd('checkin_time', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rate (€)</label>
            <input type="number" value={form.rate} onChange={e => upd('rate', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sunday Rate (€)</label>
            <input type="number" value={form.sunday_rate} onChange={e => upd('sunday_rate', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Clean (min)</label>
            <input type="number" value={form.cleaning_mins} onChange={e => upd('cleaning_mins', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Airbnb iCal URL</label>
          <input value={form.ical_airbnb} onChange={e => upd('ical_airbnb', e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/..."
            className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-sm" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Booking.com iCal URL</label>
          <input value={form.ical_booking} onChange={e => upd('ical_booking', e.target.value)}
            placeholder="https://admin.booking.com/..."
            className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-sm" />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => upd('color', c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <button disabled={saving || !form.name.trim()} onClick={submit}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/25">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
