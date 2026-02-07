import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface FormData {
  name: string;
  ical_airbnb: string;
  ical_booking: string;
  color: string;
  cleaner_option: 'skip' | 'invite' | 'existing';
  cleaner_name: string;
  cleaner_email: string;
  cleaner_id: number | null;
}

export default function AddProperty() {
  const navigate = useNavigate();
  const { invalidateCache } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [airbnbValid, setAirbnbValid] = useState<boolean | null>(null);
  const [bookingValid, setBookingValid] = useState<boolean | null>(null);
  const [testingAirbnb, setTestingAirbnb] = useState(false);
  const [testingBooking, setTestingBooking] = useState(false);
  const [existingCleaners, setExistingCleaners] = useState<any[]>([]);
  const [form, setForm] = useState<FormData>({
    name: '', ical_airbnb: '', ical_booking: '', color: '#3B82F6',
    cleaner_option: 'skip', cleaner_name: '', cleaner_email: '', cleaner_id: null,
  });

  const upd = (k: keyof FormData, v: any) => setForm(f => ({ ...f, [k]: v }));

  const testIcal = async (url: string, type: 'airbnb' | 'booking') => {
    const setTesting = type === 'airbnb' ? setTestingAirbnb : setTestingBooking;
    const setValid = type === 'airbnb' ? setAirbnbValid : setBookingValid;
    setTesting(true);
    try {
      const res = await fetch('/api/properties/0/ical-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setValid(data.valid);
    } catch { setValid(false); }
    setTesting(false);
  };

  useEffect(() => {
    fetch('/api/cleaners').then(r => r.json()).then(setExistingCleaners).catch(() => {});
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      let cleanerId = form.cleaner_id;
      if (form.cleaner_option === 'invite' && form.cleaner_name && form.cleaner_email) {
        const res = await fetch('/api/cleaners/invite', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.cleaner_name, email: form.cleaner_email })
        });
        const cleaner = await res.json();
        cleanerId = cleaner.id;
      }

      await fetch('/api/properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, address: '',
          ical_airbnb: form.ical_airbnb || null,
          ical_booking: form.ical_booking || null,
          color: form.color,
          cleaner_id: cleanerId,
        })
      });

      invalidateCache('/api/properties');
      navigate('/dashboard');
    } catch (e) { alert('Failed to save property'); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg flex-1">Add Property</h1>
        <span className="text-sm text-gray-400">Step {step}/2</span>
      </header>

      <div className="flex gap-1 px-4 pt-3">
        {[1, 2].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>

      <div className="p-4">
        {/* Step 1: Name + iCal URLs */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Property Name *</label>
              <input
                value={form.name} onChange={e => upd('name', e.target.value)}
                placeholder="e.g. Studio Montmartre"
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => upd('color', c)}
                    className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm mt-4">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">📅 Connect your calendars</p>
              <p className="text-blue-600 dark:text-blue-400">Import bookings from Airbnb and/or Booking.com. Both optional.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Airbnb iCal URL</label>
              <div className="flex gap-2">
                <input
                  value={form.ical_airbnb} onChange={e => { upd('ical_airbnb', e.target.value); setAirbnbValid(null); }}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  className="flex-1 px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-sm"
                />
                {form.ical_airbnb && (
                  <button onClick={() => testIcal(form.ical_airbnb, 'airbnb')}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium">
                    {testingAirbnb ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
                  </button>
                )}
              </div>
              {airbnbValid === true && <p className="text-green-500 text-sm mt-1">✅ Valid iCal feed</p>}
              {airbnbValid === false && <p className="text-red-500 text-sm mt-1">❌ Could not validate URL</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Booking.com iCal URL</label>
              <div className="flex gap-2">
                <input
                  value={form.ical_booking} onChange={e => { upd('ical_booking', e.target.value); setBookingValid(null); }}
                  placeholder="https://admin.booking.com/..."
                  className="flex-1 px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-sm"
                />
                {form.ical_booking && (
                  <button onClick={() => testIcal(form.ical_booking, 'booking')}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium">
                    {testingBooking ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
                  </button>
                )}
              </div>
              {bookingValid === true && <p className="text-green-500 text-sm mt-1">✅ Valid iCal feed</p>}
              {bookingValid === false && <p className="text-red-500 text-sm mt-1">❌ Could not validate URL</p>}
            </div>

            <button
              disabled={!form.name.trim()}
              onClick={() => setStep(2)}
              className="w-full bg-blue-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Assign Cleaner */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Assign a Cleaner</h2>
            <p className="text-sm text-gray-500">Optionally assign a cleaner to this property now, or do it later.</p>

            <div className="space-y-3">
              <button onClick={() => upd('cleaner_option', 'skip')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${form.cleaner_option === 'skip' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="font-medium">⏭️ Skip for now</p>
                <p className="text-sm text-gray-500">You can assign cleaners later</p>
              </button>

              <button onClick={() => upd('cleaner_option', 'invite')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${form.cleaner_option === 'invite' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="font-medium">✉️ Invite by email</p>
                <p className="text-sm text-gray-500">Send an invite to a new cleaner</p>
              </button>

              {form.cleaner_option === 'invite' && (
                <div className="pl-4 space-y-3">
                  <input value={form.cleaner_name} onChange={e => upd('cleaner_name', e.target.value)}
                    placeholder="Cleaner name" className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
                  <input value={form.cleaner_email} onChange={e => upd('cleaner_email', e.target.value)}
                    placeholder="cleaner@email.com" type="email" className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
                </div>
              )}

              {existingCleaners.length > 0 && (
                <button onClick={() => upd('cleaner_option', 'existing')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${form.cleaner_option === 'existing' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className="font-medium">👥 Select existing cleaner</p>
                  <p className="text-sm text-gray-500">Choose from your team</p>
                </button>
              )}

              {form.cleaner_option === 'existing' && (
                <div className="pl-4 space-y-2">
                  {existingCleaners.map(c => (
                    <button key={c.id} onClick={() => upd('cleaner_id', c.id)}
                      className={`w-full p-3 rounded-xl border text-left ${form.cleaner_id === c.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-gray-400">{c.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button disabled={saving} onClick={submit}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-6 shadow-lg shadow-green-500/25">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? 'Saving...' : 'Create Property'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
