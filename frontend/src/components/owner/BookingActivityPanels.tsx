import { Home, LogIn, LogOut } from 'lucide-react';
import { cleanGuestName, getSourceColor, getSourceLabel } from '@/components/owner/bookingActivityUtils';

type BookingActivity = {
  id: number;
  checkin_date: string;
  checkout_date: string;
  guest_name: string;
  source: string;
  property_name: string;
};

type Props = {
  bookings: BookingActivity[];
  lang: string;
  limit?: number;
};

export default function BookingActivityPanels({ bookings, lang, limit = 3 }: Props) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayActivity = {
    checkinsToday: bookings.filter(b => b.checkin_date === todayStr),
    checkoutsToday: bookings.filter(b => b.checkout_date === todayStr),
    currentlyStaying: bookings.filter(b => b.checkin_date <= todayStr && b.checkout_date > todayStr)
  };

  const upcomingCheckins = [...bookings]
    .filter(b => new Date(b.checkin_date) > today)
    .sort((a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime())
    .slice(0, limit);

  const upcomingCheckouts = [...bookings]
    .filter(b => new Date(b.checkout_date) > today)
    .sort((a, b) => new Date(a.checkout_date).getTime() - new Date(b.checkout_date).getTime())
    .slice(0, limit);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="text-base font-bold mb-3 text-gray-900 dark:text-white">
          {lang === 'fr' ? "Aujourd'hui" : 'Today'}
        </h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <LogIn size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lang === 'fr' ? "Arrivées aujourd'hui" : 'Check-ins today'}
              </p>
              <p className="text-xs text-gray-500">
                {todayActivity.checkinsToday.length} {lang === 'fr' ? 'réservations' : 'bookings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <LogOut size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lang === 'fr' ? "Départs aujourd'hui" : 'Check-outs today'}
              </p>
              <p className="text-xs text-gray-500">
                {todayActivity.checkoutsToday.length} {lang === 'fr' ? 'réservations' : 'bookings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Home size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lang === 'fr' ? 'Séjours en cours' : 'Currently staying'}
              </p>
              <p className="text-xs text-gray-500">
                {todayActivity.currentlyStaying.length} {lang === 'fr' ? 'réservations' : 'bookings'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <LogIn size={16} className="text-green-600 dark:text-green-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Prochaines arrivées' : 'Upcoming Check-ins'}
          </h2>
        </div>

        <div className="space-y-2">
          {upcomingCheckins.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {lang === 'fr' ? 'Aucune arrivée prévue' : 'No upcoming check-ins'}
            </p>
          ) : (
            upcomingCheckins.map(booking => {
              const checkin = new Date(booking.checkin_date);
              const checkout = new Date(booking.checkout_date);
              const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 p-2 rounded transition-colors"
                >
                  <div className="text-center w-9 flex-shrink-0">
                    <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                      {checkin.getDate()}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">
                      {checkin.toLocaleDateString(locale, { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {cleanGuestName(booking.guest_name)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{booking.property_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getSourceColor(booking.source) }} />
                      <span>{getSourceLabel(booking.source)}</span>
                      <span>· {nights}n</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <LogOut size={16} className="text-red-500 dark:text-red-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Prochains départs' : 'Upcoming Check-outs'}
          </h2>
        </div>

        <div className="space-y-2">
          {upcomingCheckouts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {lang === 'fr' ? 'Aucun départ prévu' : 'No upcoming check-outs'}
            </p>
          ) : (
            upcomingCheckouts.map(booking => {
              const checkout = new Date(booking.checkout_date);
              const checkin = new Date(booking.checkin_date);
              const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 p-2 rounded transition-colors"
                >
                  <div className="text-center w-9 flex-shrink-0">
                    <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                      {checkout.getDate()}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">
                      {checkout.toLocaleDateString(locale, { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {cleanGuestName(booking.guest_name)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{booking.property_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getSourceColor(booking.source) }} />
                      <span>{getSourceLabel(booking.source)}</span>
                      <span>· {nights}n</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
