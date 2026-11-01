import { QualityMetric } from './types';

type Props = {
  lang: string;
  qualityMetrics: QualityMetric[];
};

export default function QualityTab({ lang, qualityMetrics }: Props) {
  return (
    <div className="space-y-4">
      <section className="bg-surface rounded-2xl p-5 border border-line">
        <p className="text-xs text-muted uppercase tracking-[0.2em]">
          {lang === 'fr' ? 'Qualite' : 'Quality'}
        </p>
        <h2 className="text-2xl font-semibold mt-2 text-ink">
          {lang === 'fr' ? 'Base qualite prete, donnees avis encore manquantes' : 'Quality foundation ready, review data still missing'}
        </h2>
        <p className="text-sm text-muted mt-2 max-w-3xl">
          {lang === 'fr'
            ? 'Airbnb montre notes, avis et qualite d annonce. Kozy ne recoit pas encore ces donnees depuis Smoobu ou les OTA, donc cette vue affiche ce qui est reel aujourd hui et ce qu il faut ajouter ensuite.'
            : 'Airbnb shows ratings, reviews, and listing quality. Kozy does not receive that data yet from Smoobu or the OTAs, so this view shows what is real today and what must be added next.'}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {qualityMetrics.map(metric => (
          <div key={metric.label} className="bg-surface rounded-2xl p-4 border border-line">
            <p className="text-xs text-muted uppercase tracking-wide">{metric.label}</p>
            <p className="text-3xl font-semibold mt-2 text-ink">{metric.value}</p>
            <p className="text-sm text-muted mt-2">{metric.hint}</p>
          </div>
        ))}
      </div>

      <section className="bg-surface rounded-2xl p-5 border border-line">
        <p className="text-xs text-muted uppercase tracking-[0.2em]">
          {lang === 'fr' ? 'Prochaine etape' : 'Next unlock'}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 text-sm">
          <div className="rounded-xl border border-line p-4">
            <p className="font-semibold text-ink">
              {lang === 'fr' ? 'Avis et notes' : 'Reviews and ratings'}
            </p>
            <p className="text-muted mt-2">
              {lang === 'fr' ? 'Importer note moyenne, nombre d avis, 5 etoiles et tendance mensuelle.' : 'Import average rating, review count, five-star share, and monthly trend.'}
            </p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="font-semibold text-ink">
              {lang === 'fr' ? 'Problemes sejour' : 'Stay issues'}
            </p>
            <p className="text-muted mt-2">
              {lang === 'fr' ? 'Suivre remboursements, incidents, litiges et temps de resolution.' : 'Track refunds, incidents, disputes, and resolution time.'}
            </p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="font-semibold text-ink">
              {lang === 'fr' ? 'Qualite annonce' : 'Listing quality'}
            </p>
            <p className="text-muted mt-2">
              {lang === 'fr' ? 'Mesurer contenu, photos, minimum stay, conversion et opportunites d optimisation.' : 'Measure content, photos, minimum stay, conversion, and optimization opportunities.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
