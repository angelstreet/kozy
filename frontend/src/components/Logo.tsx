import { Home } from 'lucide-react';

/** Kozy mark + word. `compact` hides the word below xl (collapsed sidebar). */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold text-ink">
      <span className="w-7 h-7 rounded-lg bg-accent text-accent-ink flex items-center justify-center" aria-hidden>
        <Home size={16} strokeWidth={2} />
      </span>
      <span className={compact ? 'hidden xl:inline' : ''}>kozy</span>
    </span>
  );
}
