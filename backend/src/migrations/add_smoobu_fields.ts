import db from '../db.js';

export async function migrateSmoobuFields() {
  console.log('Running Smoobu fields migration...');

  const cols = await db.execute("PRAGMA table_info(booking)");
  const columnNames = cols.rows.map((c: any) => c[1] || c.name);

  const fieldsToAdd = [
    { name: 'email', type: 'TEXT' },
    { name: 'phone', type: 'TEXT' },
    { name: 'adults', type: 'INTEGER' },
    { name: 'children', type: 'INTEGER' },
    { name: 'checkin_time', type: 'TEXT' },
    { name: 'checkout_time', type: 'TEXT' },
    { name: 'price', type: 'REAL' },
    { name: 'price_paid', type: 'INTEGER DEFAULT 0' }, // Boolean: 1 = true, 0 = false
    { name: 'prepayment', type: 'REAL' },
    { name: 'prepayment_paid', type: 'INTEGER DEFAULT 0' },
    { name: 'deposit', type: 'REAL' },
    { name: 'deposit_paid', type: 'INTEGER DEFAULT 0' },
    { name: 'notice', type: 'TEXT' },
    { name: 'language', type: 'TEXT' },
    { name: 'channel_name', type: 'TEXT' },
    { name: 'reference_id', type: 'TEXT' },
    { name: 'apartment_name', type: 'TEXT' },
  ];

  for (const field of fieldsToAdd) {
    if (!columnNames.includes(field.name)) {
      console.log(`Adding column: ${field.name}`);
      await db.execute(`ALTER TABLE booking ADD COLUMN ${field.name} ${field.type}`);
    } else {
      console.log(`Column ${field.name} already exists, skipping`);
    }
  }

  console.log('Smoobu fields migration complete');
}
