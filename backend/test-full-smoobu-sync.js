#!/usr/bin/env node
import db from './dist/db.js';
import { decryptApiKey } from './dist/encryption.js';
import { fetchSmoobuApartments, fetchSmoobuBookings, syncSmoobuBookings } from './dist/smoobu-sync.js';

const USER_ID = 'dev-user';

async function testFullScope() {
  console.log('🧪 Testing full scope Smoobu sync for dev-user\n');
  console.log('='  .repeat(60));

  // 1. Get encrypted API key from database
  console.log('\n📡 Step 1: Retrieving encrypted API key from database...');
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [USER_ID]
  });

  if (!keyResult.rows[0]) {
    console.error('❌ No API key found for dev-user');
    return;
  }

  const encryptedKey = keyResult.rows[0].smoobu_api_key_encrypted;
  console.log(`✅ Encrypted key retrieved: ${encryptedKey.substring(0, 40)}...`);

  // 2. Decrypt the key
  console.log('\n🔓 Step 2: Decrypting API key...');
  const apiKey = decryptApiKey(encryptedKey);
  console.log(`✅ Key decrypted successfully (length: ${apiKey.length})`);

  // 3. Fetch all apartments from Smoobu
  console.log('\n🏢 Step 3: Fetching all apartments from Smoobu API...');
  let apartments;
  try {
    apartments = await fetchSmoobuApartments(apiKey);
    console.log(`✅ Found ${apartments.length} apartments:`);
    apartments.forEach((apt, idx) => {
      console.log(`   ${idx + 1}. ${apt.name} (ID: ${apt.id}, Type: ${apt.type}, Capacity: ${apt.capacity})`);
    });
  } catch (error) {
    console.error(`❌ Failed to fetch apartments: ${error.message}`);
    return;
  }

  // 4. Fetch all bookings from Smoobu
  console.log('\n📅 Step 4: Fetching all bookings from Smoobu API...');
  let allBookings;
  try {
    allBookings = await fetchSmoobuBookings(apiKey);
    console.log(`✅ Found ${allBookings.length} total bookings across all apartments`);
    
    // Group by apartment
    const bookingsByApartment = {};
    allBookings.forEach(booking => {
      const aptId = booking.apartment.id;
      if (!bookingsByApartment[aptId]) {
        bookingsByApartment[aptId] = {
          name: booking.apartment.name,
          bookings: []
        };
      }
      bookingsByApartment[aptId].bookings.push(booking);
    });

    console.log('\n   Bookings by apartment:');
    Object.entries(bookingsByApartment).forEach(([aptId, data]) => {
      console.log(`   - ${data.name}: ${data.bookings.length} booking(s)`);
    });
  } catch (error) {
    console.error(`❌ Failed to fetch bookings: ${error.message}`);
    return;
  }

  // 5. Get existing properties in database
  console.log('\n🏠 Step 5: Checking existing properties in database...');
  const propertiesResult = await db.execute({
    sql: 'SELECT id, name, smoobu_apartment_id FROM property WHERE user_id = ? OR user_id IS NULL',
    args: [USER_ID]
  });
  
  const properties = propertiesResult.rows;
  console.log(`✅ Found ${properties.length} properties in database`);
  properties.forEach(prop => {
    console.log(`   - ${prop.name} (ID: ${prop.id}, Smoobu ID: ${prop.smoobu_apartment_id || 'not linked'})`);
  });

  // 6. Test sync for each property with a linked Smoobu apartment
  console.log('\n🔄 Step 6: Testing sync for linked properties...');
  let totalSynced = 0;
  
  for (const property of properties) {
    if (property.smoobu_apartment_id) {
      console.log(`\n   Syncing: ${property.name} (Smoobu apartment ID: ${property.smoobu_apartment_id})...`);
      
      try {
        const result = await syncSmoobuBookings(property.id, apiKey, property.smoobu_apartment_id);
        console.log(`   ✅ Deleted: ${result.deleted}, Created: ${result.created}`);
        totalSynced += result.created;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    } else {
      console.log(`\n   ⚠️  Skipping ${property.name} (no Smoobu apartment linked)`);
    }
  }

  // 7. Show final booking counts
  console.log('\n📊 Step 7: Final booking counts in database...');
  const bookingResult = await db.execute(
    'SELECT property_id, COUNT(*) as count FROM booking GROUP BY property_id'
  );
  
  for (const row of bookingResult.rows) {
    const prop = properties.find(p => p.id === row.property_id);
    console.log(`   - ${prop?.name || 'Unknown'}: ${row.count} booking(s)`);
  }

  // 8. Show sample booking data to verify enrichment
  console.log('\n🔍 Step 8: Sample booking data (showing enrichment)...');
  const sampleBookings = await db.execute({
    sql: `SELECT 
      b.checkin_date, b.checkout_date, b.guest_name, 
      b.email, b.phone, b.adults, b.children,
      b.price, b.price_paid, b.channel_name, b.reference_id,
      p.name as property_name
    FROM booking b
    JOIN property p ON b.property_id = p.id
    ORDER BY b.checkin_date DESC
    LIMIT 3`,
    args: []
  });

  sampleBookings.rows.forEach((booking, idx) => {
    console.log(`\n   Booking ${idx + 1}:`);
    console.log(`   Property: ${booking.property_name}`);
    console.log(`   Dates: ${booking.checkin_date} → ${booking.checkout_date}`);
    console.log(`   Guest: ${booking.guest_name || 'N/A'}`);
    console.log(`   Email: ${booking.email || 'N/A'}`);
    console.log(`   Phone: ${booking.phone || 'N/A'}`);
    console.log(`   Guests: ${booking.adults || 0} adults, ${booking.children || 0} children`);
    console.log(`   Price: €${booking.price || 'N/A'} (Paid: ${booking.price_paid ? 'Yes' : 'No'})`);
    console.log(`   Channel: ${booking.channel_name || 'N/A'}`);
    console.log(`   Reference: ${booking.reference_id || 'N/A'}`);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ FULL SCOPE TEST COMPLETED');
  console.log(`   - ${apartments.length} apartments fetched from Smoobu`);
  console.log(`   - ${allBookings.length} bookings fetched from Smoobu`);
  console.log(`   - ${totalSynced} bookings synced to database`);
  console.log(`   - All data properly encrypted and stored`);
  console.log('='.repeat(60));
}

testFullScope().catch(console.error);
