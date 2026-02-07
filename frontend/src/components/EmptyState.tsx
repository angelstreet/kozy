import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaTo?: string;
}

export default function EmptyState({ emoji, title, subtitle, ctaLabel, ctaTo }: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <div className="text-6xl mb-4">{emoji}</div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">{subtitle}</p>
      {ctaLabel && ctaTo && (
        <button
          onClick={() => navigate(ctaTo)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl text-lg shadow-lg shadow-blue-500/25 transition-all active:scale-95"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
