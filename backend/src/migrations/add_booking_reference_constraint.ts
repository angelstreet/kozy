import db from '../db.js';

export async function migrateBookingReferenceConstraint() {
  try {
    // Check if the index already exists
    const indexes = await db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_booking_property_reference'");
    
    if (indexes.rows.length === 0) {
      // Create unique constraint on (property_id, reference_id) where reference_id is not null
      await db.execute(`
        CREATE UNIQUE INDEX idx_booking_property_reference 
        ON booking(property_id, reference_id) 
        WHERE reference_id IS NOT NULL
      `);
      console.log('✅ Created unique index on booking(property_id, reference_id)');
    }
  } catch (e) {
    console.error('Migration add_booking_reference_constraint failed:', e);
  }
}
