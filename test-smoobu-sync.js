#!/usr/bin/env node
import { syncSmoobuData } from './backend/dist/smoobu-sync.js';
import db from './backend/dist/db.js';

const SMOOBU_API_KEY = 'g29HxSrjy9Kmq2xHp7iJOVCnaRASJAJidI03OYTyzY';

async function testSync() {
  // Get first property
  const propsResult = await db.execute('SELECT id, name FROM property LIMIT 1');
  const property = propsResult.rows[0];
  
  if (!property) {
    console.log('No properties found');
    return;
  }

  console.log(`\nTesting Smoobu sync for property: ${property.name} (ID: ${property.id})`);
  
  try {
    const result = await syncSmoobuData(property.id, SMOOBU_API_KEY);
    console.log('\n✅ Sync completed:');
    console.log(`   Total bookings: ${result.totalBookings}`);
    console.log(`   Enriched: ${result.enrichedCount}`);
    console.log(`   Smoobu reservations found: ${result.smoobuReservationsFound}`);
    
    // Show enriched data
    const bookingsResult = await db.execute({
      sql: 'SELECT checkin_date, checkout_date, guest_name, email, phone, price, channel_name FROM booking WHERE property_id = ? LIMIT 3',
      args: [property.id]
    });
    
    console.log('\nFirst 3 enriched bookings:');
    for (const b of bookingsResult.rows) {
      console.log(`\n  ${b.checkin_date} → ${b.checkout_date}`);
      console.log(`  Guest: ${b.guest_name}`);
      console.log(`  Email: ${b.email || 'N/A'}`);
      console.log(`  Phone: ${b.phone || 'N/A'}`);
      console.log(`  Price: ${b.price || 'N/A'}`);
      console.log(`  Channel: ${b.channel_name || 'N/A'}`);
    }
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
  }
}

testSync().catch(console.error);
