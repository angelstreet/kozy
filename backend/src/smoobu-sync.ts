import db from './db.js';

export interface SmoobuReservation {
  id: number;
  arrival: string; // "2026-02-20"
  departure: string; // "2026-02-25"
  'guest-name': string;
  'firstname': string;
  'lastname': string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  'check-in': string; // "16:00"
  'check-out': string; // "10:00"
  price: number;
  'price-paid': boolean;
  prepayment: number;
  'prepayment-paid': boolean;
  deposit: number;
  'deposit-paid': boolean;
  notice: string;
  language: string; // "en", "fr", etc.
  channel: {
    id: number;
    name: string; // "Airbnb", "Booking.com"
  };
  'reference-id': string; // Airbnb/Booking.com booking ID
  apartment: {
    id: number;
    name: string;
  };
}

export interface SmoobuApiResponse {
  bookings: SmoobuReservation[];
  page_size: number;
  page: number;
  total: number;
}

export interface SmoobuApartment {
  id: number;
  name: string;
  type: string;
  capacity: number;
}

export interface SmoobuApartmentsResponse {
  apartments: SmoobuApartment[];
}

/**
 * Fetch all apartments from Smoobu API
 * Docs: https://docs.smoobu.com/#get-apartments
 */
export async function fetchSmoobuApartments(apiKey: string): Promise<SmoobuApartment[]> {
  const url = 'https://login.smoobu.com/api/apartments';
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Smoobu API error: ${response.status} ${response.statusText}`);
  }

  const data: SmoobuApartmentsResponse = await response.json();
  return data.apartments || [];
}

/**
 * Fetch all reservations from Smoobu API
 * Docs: https://docs.smoobu.com/#get-bookings-api
 */
export async function fetchSmoobuBookings(apiKey: string): Promise<SmoobuReservation[]> {
  const url = 'https://login.smoobu.com/api/reservations';
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Smoobu API error: ${response.status} ${response.statusText}`);
  }

  const data: SmoobuApiResponse = await response.json();
  return data.bookings || [];
}

/**
 * Helper: check if two dates are within 1 day of each other (handles timezone issues)
 */
function datesMatch(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
}

/**
 * Match a booking from DB with Smoobu reservation by dates
 * Returns enriched booking data or null if no match
 * Uses fuzzy date matching (±1 day) to handle timezone/iCal parsing issues
 */
export function enrichBookingFromSmoobu(
  booking: any,
  smoobuReservations: SmoobuReservation[]
): Partial<SmoobuReservation> | null {
  // Match by arrival/departure dates (with 1-day tolerance for timezone issues)
  const match = smoobuReservations.find(
    (r) =>
      datesMatch(r.arrival, booking.checkin_date) && 
      datesMatch(r.departure, booking.checkout_date)
  );

  if (!match) return null;

  return {
    'guest-name': match['guest-name'] || undefined,
    email: match.email || undefined,
    phone: match.phone || undefined,
    adults: match.adults || 0,
    children: match.children || 0,
    'check-in': match['check-in'] || undefined,
    'check-out': match['check-out'] || undefined,
    price: match.price || 0,
    'price-paid': match['price-paid'] || false,
    prepayment: match.prepayment || 0,
    'prepayment-paid': match['prepayment-paid'] || false,
    deposit: match.deposit || 0,
    'deposit-paid': match['deposit-paid'] || false,
    notice: match.notice || undefined,
    language: match.language || undefined,
    channel: match.channel,
    'reference-id': match['reference-id'] || undefined,
    apartment: match.apartment,
  };
}

/**
 * Sync bookings from Smoobu as PRIMARY source (replaces ALL existing data)
 * Strategy: DELETE all existing bookings for this property, then INSERT fresh Smoobu data
 * @param propertyId - Property ID in local DB
 * @param apiKey - Smoobu API key
 * @param apartmentId - Optional Smoobu apartment ID to filter reservations
 */
export async function syncSmoobuBookings(propertyId: number, apiKey: string, apartmentId?: number) {
  // Fetch all Smoobu reservations
  let smoobuReservations = await fetchSmoobuBookings(apiKey);

  // Filter by apartment if specified
  if (apartmentId) {
    smoobuReservations = smoobuReservations.filter(r => r.apartment.id === apartmentId);
  }

  // DELETE all existing data for this property (clean slate)
  // First delete cleaning_tasks (foreign key constraint)
  await db.execute({
    sql: 'DELETE FROM cleaning_task WHERE property_id = ?',
    args: [propertyId],
  });

  // Then delete bookings
  const deleteResult = await db.execute({
    sql: 'DELETE FROM booking WHERE property_id = ?',
    args: [propertyId],
  });

  const deleted = Number(deleteResult.rowsAffected) || 0;
  let created = 0;

  // INSERT all Smoobu reservations
  for (const reservation of smoobuReservations) {
    const referenceId = reservation['reference-id'] || `smoobu-${reservation.id}`;
    const source = reservation.channel?.name?.toLowerCase() || 'smoobu';

    await db.execute({
      sql: `INSERT INTO booking (
        property_id, reference_id, checkin_date, checkout_date, guest_name,
        email, phone, adults, children, checkin_time, checkout_time,
        price, price_paid, prepayment, prepayment_paid, deposit, deposit_paid,
        notice, language, channel_name, apartment_name, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        propertyId,
        referenceId,
        reservation.arrival,
        reservation.departure,
        reservation['guest-name'] || null,
        reservation.email || null,
        reservation.phone || null,
        reservation.adults || null,
        reservation.children || null,
        reservation['check-in'] || null,
        reservation['check-out'] || null,
        reservation.price || null,
        reservation['price-paid'] ? 1 : 0,
        reservation.prepayment || null,
        reservation['prepayment-paid'] ? 1 : 0,
        reservation.deposit || null,
        reservation['deposit-paid'] ? 1 : 0,
        reservation.notice || null,
        reservation.language || null,
        reservation.channel?.name || null,
        reservation.apartment?.name || null,
        source,
      ],
    });
    created++;
  }

  return {
    source: 'smoobu',
    propertyId,
    smoobuReservations: smoobuReservations.length,
    deleted,
    created,
  };
}

/**
 * Sync all bookings for a property with Smoobu data (ENRICHMENT mode - legacy)
 * @param propertyId - Property ID in local DB
 * @param apiKey - Smoobu API key
 * @param apartmentId - Optional Smoobu apartment ID to filter reservations
 */
export async function syncSmoobuData(propertyId: number, apiKey: string, apartmentId?: number) {
  // Fetch all Smoobu reservations
  let smoobuReservations = await fetchSmoobuBookings(apiKey);

  // Filter by apartment if specified
  if (apartmentId) {
    smoobuReservations = smoobuReservations.filter(r => r.apartment.id === apartmentId);
  }

  // Fetch all bookings for this property
  const bookingsResult = await db.execute({
    sql: 'SELECT * FROM booking WHERE property_id = ?',
    args: [propertyId],
  });

  const bookings = bookingsResult.rows as any[];
  let enrichedCount = 0;

  for (const booking of bookings) {
    const enrichedData = enrichBookingFromSmoobu(booking, smoobuReservations);

    if (enrichedData) {
      // Update booking with enriched data
      await db.execute({
        sql: `UPDATE booking SET
          guest_name = ?,
          email = ?,
          phone = ?,
          adults = ?,
          children = ?,
          checkin_time = ?,
          checkout_time = ?,
          price = ?,
          price_paid = ?,
          prepayment = ?,
          prepayment_paid = ?,
          deposit = ?,
          deposit_paid = ?,
          notice = ?,
          language = ?,
          channel_name = ?,
          reference_id = ?,
          apartment_name = ?
        WHERE id = ?`,
        args: [
          enrichedData['guest-name'] ?? null,
          enrichedData.email ?? null,
          enrichedData.phone ?? null,
          enrichedData.adults ?? null,
          enrichedData.children ?? null,
          enrichedData['check-in'] ?? null,
          enrichedData['check-out'] ?? null,
          enrichedData.price ?? null,
          enrichedData['price-paid'] ? 1 : 0,
          enrichedData.prepayment ?? null,
          enrichedData['prepayment-paid'] ? 1 : 0,
          enrichedData.deposit ?? null,
          enrichedData['deposit-paid'] ? 1 : 0,
          enrichedData.notice ?? null,
          enrichedData.language ?? null,
          enrichedData.channel?.name ?? null,
          enrichedData['reference-id'] ?? null,
          enrichedData.apartment?.name ?? null,
          booking.id,
        ],
      });

      enrichedCount++;
    }
  }

  return {
    propertyId,
    totalBookings: bookings.length,
    enrichedCount,
    smoobuReservationsFound: smoobuReservations.length,
  };
}
