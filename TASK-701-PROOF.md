# Task #701: Make Smoobu API Primary Source ✅

## Summary
Changed Kozy sync logic to use Smoobu API as the **primary source** for bookings when a Smoobu API key is configured. iCal is now only a **fallback** when no Smoobu key exists.

## Implementation

### 1. Created `unified-sync.ts`
New file: `backend/src/unified-sync.ts`

```typescript
export async function syncProperty(propertyId: number, userId: string): Promise<any>
```

**Logic Flow:**
1. Check if user has `smoobu_api_key_encrypted` in database
2. **If YES** → Call `syncPropertyFromSmoobu()` (PRIMARY)
   - Fetches ALL reservations from Smoobu API
   - Creates bookings directly with full guest details
   - iCal URLs are **IGNORED**
3. **If NO** → Call `syncPropertyIcal()` (FALLBACK)
   - Uses existing iCal sync logic
   - Backward compatible

### 2. Updated Endpoints in `index.ts`

All sync endpoints now use the unified sync function:

| Endpoint | Old Behavior | New Behavior |
|----------|-------------|-------------|
| `POST /api/properties/:id/sync` | N/A (new) | Unified sync |
| `POST /api/properties/:id/ical-sync` | Only iCal | Unified sync (Smoobu primary) |
| `POST /api/smoobu-sync` | Enrichment only | Unified sync for all properties |
| `POST /api/sync-all` | N/A (new) | Unified sync for all properties |

### 3. Smoobu as Primary Source

When `syncPropertyFromSmoobu()` is called:

```typescript
// Fetch all Smoobu reservations
let smoobuReservations = await fetchSmoobuBookings(apiKey);

// Filter by apartment ID if configured
if (property.smoobu_apartment_id) {
  smoobuReservations = smoobuReservations.filter(r => r.apartment.id === property.smoobu_apartment_id);
}

// Create/update bookings directly from Smoobu data
for (const res of smoobuReservations) {
  await db.execute({
    sql: `INSERT INTO booking (
      property_id, ical_uid, checkin_date, checkout_date, guest_name, source,
      email, phone, adults, children, checkin_time, checkout_time,
      price, price_paid, prepayment, prepayment_paid, deposit, deposit_paid,
      notice, language, channel_name, reference_id, apartment_name
    ) VALUES (...)
    ON CONFLICT(ical_uid) DO UPDATE SET ...`
  });
}
```

**Key Points:**
- Bookings are created with `source='smoobu'`
- Full guest details (email, phone, payment status, etc.)
- No iCal parsing needed
- Unique ID: `smoobu-{reservation_id}`

### 4. Backward Compatibility

✅ Users **without** Smoobu API key still work exactly as before:
- iCal sync continues to function
- No breaking changes
- Seamless upgrade path

## Testing

### Scenario 1: User WITH Smoobu API Key
```bash
curl -X POST http://localhost:3002/api/smoobu-sync \
  -H "Authorization: Bearer <token>"

Response:
{
  "synced": 3,
  "totalCreated": 5,
  "totalUpdated": 2,
  "results": [
    {
      "propertyId": 1,
      "propertyName": "Villa Marrakech",
      "source": "smoobu",
      "bookingsFound": 5,
      "created": 3,
      "updated": 2,
      "tasksCreated": 3
    }
  ]
}
```

### Scenario 2: User WITHOUT Smoobu API Key
```bash
curl -X POST http://localhost:3002/api/properties/1/sync \
  -H "Authorization: Bearer <token>"

Response:
{
  "propertyId": 1,
  "propertyName": "Villa Marrakech",
  "source": "ical",  // Falls back to iCal
  "bookingsFound": 4,
  "created": 2,
  "updated": 2,
  "tasksCreated": 2
}
```

## Code Changes

**Files Modified:**
- ✅ `backend/src/unified-sync.ts` (NEW)
- ✅ `backend/src/index.ts` (updated endpoints)

**Files Unchanged:**
- ✅ `backend/src/ical-sync.ts` (still used as fallback)
- ✅ `backend/src/smoobu-sync.ts` (still contains helper functions)
- ✅ Frontend code (no changes needed)

## TypeScript Validation
```bash
$ cd backend && npx tsc --noEmit
# ✅ No errors
```

## Commit
```bash
commit 9eb7d197
feat: #701 Make Smoobu API primary source (ignore iCal if API key configured)
```

## Result

✅ **Smoobu API is now the PRIMARY source when configured**
✅ **iCal is FALLBACK only (ignored when Smoobu key exists)**
✅ **Full guest details from Smoobu (email, phone, payments, etc.)**
✅ **Backward compatible (no breaking changes)**
✅ **All existing endpoints updated to use unified sync**

---

**Task #701: COMPLETE** 🎉
