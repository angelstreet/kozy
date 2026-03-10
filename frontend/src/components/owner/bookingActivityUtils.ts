export function normalizeSource(source: string): string {
  const lower = (source || '').toLowerCase().trim();
  if (lower === 'airbnb') return 'airbnb';
  if (lower.includes('booking')) return 'booking';
  if (lower === 'smoobu') return 'smoobu';
  if (lower.includes('direct')) return 'direct';
  return lower;
}

export function getSourceColor(source: string): string {
  const norm = normalizeSource(source);
  if (norm === 'airbnb') return '#E8927C';
  if (norm === 'booking') return '#7C9FE8';
  if (norm === 'smoobu' || norm === 'direct') return '#7CC5A8';
  return '#9CA3AF';
}

export function getSourceLabel(source: string): string {
  const norm = normalizeSource(source);
  if (norm === 'airbnb') return 'Airbnb';
  if (norm === 'booking') return 'Booking.com';
  if (norm === 'smoobu') return 'Smoobu';
  if (norm === 'direct') return 'Direct';
  return source;
}

export function cleanGuestName(name: string): string {
  if (!name) return 'Reservation';

  if (/^language:\s*[a-z]{2}(-[A-Z]{2})?$/i.test(name.trim())) {
    return 'Reservation';
  }

  let cleaned = name.replace(/^message:\s*/i, '').trim();

  if (/^(Check-in|Check-out)\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(Check-in|Check-out)\s+/i, '').trim();
    const parts = cleaned.split(',');
    if (parts.length > 1 && parts[1].includes('Maison')) {
      return parts[0].trim() || 'Reservation';
    }
    return cleaned.split(',')[0].trim() || 'Reservation';
  }

  if (cleaned.includes(', Maison') || cleaned.includes(', Villa') || cleaned.includes(', T2 ') || cleaned.includes(', Appartement')) {
    return cleaned.split(',')[0].trim() || 'Reservation';
  }

  if (cleaned.length > 50 || cleaned.includes('RESERVATION') || cleaned.includes('BOOKING NOTE')) {
    const nameMatch = cleaned.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\b/);
    if (nameMatch) return nameMatch[1];
    return 'Reservation';
  }

  const firstPart = cleaned.split(/[\n,]/)[0].trim();

  if (firstPart.startsWith('**') || firstPart.toUpperCase() === firstPart) {
    return 'Reservation';
  }

  return firstPart || 'Reservation';
}
