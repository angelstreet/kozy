# Analytics Page — Test Cases

> Added: 2026-02-24 (tasks #760, #761)

## Component: `frontend/src/pages/owner/Analytics.tsx`

### Unit / Integration

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Page loads for owner role | No JS errors; area chart renders with Recharts |
| 2 | Period selector: 30d / 3m / 6m / 1y | Chart data recalculates to correct date window |
| 3 | Property filter dropdown | Selecting a property filters bookings to that property only |
| 4 | "All properties" option | Shows aggregated data across all properties |
| 5 | Booking deduplication | Same property + checkin + checkout appears only once in chart |
| 6 | Source colours | Airbnb (#FF385C), Booking.com (#003580), Smoobu (#7C3AED), Direct (#10B981) |
| 7 | Empty state (no bookings) | Chart renders without crash; shows zero-value area |
| 8 | Loading state | Spinner/skeleton shown while API calls are in-flight |
| 9 | API error | Graceful fallback, no unhandled rejection |

### Route

| # | Scenario | Expected |
|---|----------|----------|
| 10 | `GET /analytics` | Renders `<Analytics />` component (route added in App.tsx) |
| 11 | Sidebar link "Analytics" | Active state highlights on `/analytics` |
| 12 | Cleaner role | `/analytics` route not in cleaner nav (not accessible via sidebar) |

---

## Component: `frontend/src/pages/owner/Calendar.tsx` (task #760)

### Mobile Filter Bar

| # | Scenario | Expected |
|---|----------|----------|
| 13 | Mobile viewport (< lg) | Filter bar fits within screen width, no horizontal scroll |
| 14 | Filter toggle button | Icon-only (no text label), taps to show/hide filter panel |
| 15 | Removed fields | Search input and platform dropdown no longer present in mobile bar |

---

## How to Run (manual, until E2E is set up)

1. `npm run dev` in `kozy/`
2. Log in as owner (`user/user` or Clerk dev credentials)
3. Navigate to `/analytics` — verify chart loads
4. Switch periods and properties — verify chart updates
5. Resize to mobile width — verify calendar filter bar fits
