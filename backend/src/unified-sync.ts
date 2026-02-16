import db from './db.js';
import { syncSmoobuBookings } from './smoobu-sync.js';
import { syncPropertyIcal } from './ical-sync.js';

/**
 * Unified sync: Use Smoobu API as primary source if configured, fallback to iCal
 */
export async function syncProperty(propertyId: number, userId: string): Promise<any> {
  // Check if user has Smoobu API key configured
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });

  const encryptedKey = keyResult.rows[0] ? (keyResult.rows[0] as any).smoobu_api_key_encrypted : null;

  if (encryptedKey) {
    // PRIMARY: Smoobu API (DELETE + INSERT strategy)
    const { decryptApiKey } = await import('./encryption.js');
    const apiKey = decryptApiKey(encryptedKey);

    // Get property's Smoobu apartment ID if configured
    const propResult = await db.execute({ 
      sql: 'SELECT smoobu_apartment_id FROM property WHERE id = ?', 
      args: [propertyId] 
    });
    const property = propResult.rows[0] as any;
    const apartmentId = property?.smoobu_apartment_id || undefined;

    return await syncSmoobuBookings(propertyId, apiKey, apartmentId);
  } else {
    // FALLBACK: iCal
    return await syncPropertyIcal(propertyId);
  }
}
