import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, Inbox, Plus, Sparkles, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Legacy emoji hint, mapped to an icon (no emoji in the UI). */
  emoji: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaTo?: string;
}

const ICONS: Record<string, LucideIcon> = { '🏠': Building2, '🏘️': Building2, '🧹': Sparkles, '✨': CheckCircle2, '📅': CalendarDays };

export default function EmptyState({ emoji, title, subtitle, ctaLabel, ctaTo }: EmptyStateProps) {
  const navigate = useNavigate();
  const Icon = ICONS[emoji] || Inbox;
  const label = ctaLabel?.replace(/^\+\s*/, '');

  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16 gap-2">
      <span className="tile w-14 h-14 rounded-2xl mb-2"><Icon size={26} strokeWidth={1.75} aria-hidden /></span>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted max-w-xs">{subtitle}</p>
      {label && ctaTo && (
        <button onClick={() => navigate(ctaTo)} className="btn-primary mt-6">
          <Plus size={18} aria-hidden />{label}
        </button>
      )}
    </div>
  );
}
