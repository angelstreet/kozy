import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties, Property } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, MoreVertical, X, EyeOff, Eye } from 'lucide-react';

export default function Properties() {
  const { lang } = useApp();
  const { properties, loading, isEmpty, deleteProperty, toggleEnabled } = useProperties();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Property | null>(null);

  if (loading) return <div className="p-4 text-center text-muted">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="page-title mb-4">{t('properties', lang)}</h1>
        <EmptyState
          emoji="🏘️"
          title="No properties yet"
          subtitle="Add your first rental property to get started with Kozy."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  const handleDelete = async (p: Property) => {
    await deleteProperty(p.id);
    setConfirmDelete(null);
  };

  const handleToggle = async (p: Property) => {
    await toggleEnabled(p.id, !p.enabled);
    setMenuOpen(null);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t('properties', lang)}</h1>
        <button
          onClick={() => navigate('/add-property')}
          className="bg-accent text-accent-ink p-2 rounded-xl shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-2">
        {properties.map(p => (
          <div
            key={p.id}
            className={`bg-surface rounded-xl relative transition-opacity ${!p.enabled ? 'opacity-50' : ''} border border-line`}
          >
            {/* Compact 2-line card */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                  {!p.enabled && (
                    <span className="text-[10px] bg-line text-muted px-1.5 py-0.5 rounded-full flex-shrink-0">Off</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="truncate">{p.address}</span>
                  <span className="flex-shrink-0">€{p.rate}</span>
                  {p.ical_airbnb && <span className="text-[10px] bg-danger-tint text-danger px-1.5 py-0.5 rounded-full flex-shrink-0">Airbnb</span>}
                  {p.ical_booking && <span className="text-[10px] bg-tint text-accent px-1.5 py-0.5 rounded-full flex-shrink-0">Booking</span>}
                  {(() => {
                    const cf = (p.monthly_revenue || 0) - (p.monthly_charges || 0) - (p.credit_mensuel || 0);
                    return cf !== 0 ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cf >= 0 ? 'bg-tint text-accent' : 'bg-danger-tint text-danger'}`}>
                        {cf >= 0 ? '+' : ''}{cf}€/m
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                  className="p-2 rounded-lg hover:bg-page transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <MoreVertical size={16} className="text-muted" />
                </button>
                {menuOpen === p.id && (
                  <div className="absolute right-0 top-10 bg-surface rounded-xl shadow-lg border py-1 z-10 min-w-[160px]">
                    <button
                      onClick={() => { setMenuOpen(null); navigate(`/edit-property/${p.id}`); }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-page flex items-center gap-2"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => handleToggle(p)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-page flex items-center gap-2"
                    >
                      {p.enabled ? <EyeOff size={14} /> : <Eye size={14} />} {p.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => { setMenuOpen(null); setConfirmDelete(p); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full-xl border border-line" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Delete Property</h3>
              <button onClick={() => setConfirmDelete(null)} className="p-1 rounded-lg hover:bg-page">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted mb-1">Are you sure you want to delete:</p>
            <p className="font-semibold mb-4">{confirmDelete.name}</p>
            <p className="text-xs text-danger mb-6">This will permanently remove the property and all associated bookings, tasks, and payments.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border font-medium">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-danger text-accent-ink font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
