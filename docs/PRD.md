# Kozy — Product Requirements Document

**Version:** 2.0 (Lean MVP)
**Date:** 2026-02-07
**Status:** Ready for development

---

## Vision
Open-source property management app for short-term rental owners. Replaces Smoobu + cleaning coordination via WhatsApp with one clean tool.

## Profiles

### Owner
- Dashboard (time, date, weather, upcoming turnovers, alerts)
- Calendar (bookings per property, color-coded)
- Properties (CRUD, iCal sync, cleaner assignment, payment rate)
- Cleaners (manage team, assign to properties, invite by email, backup system)
- Shopping requests (from cleaners, filterable by property)
- Payments (per intervention, mark paid, Sunday rate)
- Settings (FR/EN, dark/light, notifications)

### Cleaner
- Schedule (only assigned properties, upcoming cleanings)
- Cleaning detail (address, time window, map link, mark done)
- Shopping request (flag what's needed per property)
- Settings (FR/EN, dark/light)

## Navigation
- **Bottom nav bar**: 4 tabs max (Dashboard/Calendar/Properties/More for owner; Schedule/Shopping/Settings for cleaner)
- **Hamburger menu**: overflow items (cleaners, payments, settings under "More")
- Mobile-first, clean, elegant, simple

## MVP Scope (Step 1)
- Hard-coded auth: `owner/owner`, `cleaner/cleaner`
- Property CRUD + iCal sync (Airbnb, Booking.com feeds)
- Auto-create cleaning tasks from turnovers
- Cleaner assignment (primary + backup per property)
- Cleaner invite by email
- Payment tracking: X€ per intervention, Sunday rate, mark paid
- Shopping requests: cleaner flags → owner resolves
- Notifications: new booking only + 1 day before reminder
- Language: FR/EN selector
- Theme: dark/light
- Dashboard shows: current time, date, weather, next turnovers

## Step 2 (Later)
- Real auth with onboarding (signup → add property → connect iCal → invite cleaner)
- In-app chat (simple, per property)
- Photos (post-cleaning proof, incident reporting)
- Smoobu API integration
- PriceLabs integration
- Push notifications
- Complex payment (invoicing, history export)

## Tech Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Hono (lightweight)
- **Database:** SQLite (simple, no external DB needed for MVP)
- **iCal:** `ical.js` npm package
- **PWA:** Vite PWA plugin
- **Auth MVP:** hard-coded credentials
- **Monorepo:** npm workspaces

## Data Model (MVP)

```
Property: id, name, address, ical_url, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color
Cleaner: id, name, email, phone
PropertyCleaner: property_id, cleaner_id, role (primary|backup)
Booking: id, property_id, ical_uid, checkin_date, checkout_date, guest_name?, source
CleaningTask: id, property_id, booking_id, date, status (pending|confirmed|in_progress|done), assigned_to, rate
Payment: id, cleaner_id, task_id, amount, paid (bool), paid_at
ShoppingRequest: id, property_id, cleaner_id, items (text), status (pending|resolved), created_at
```

## Repo Structure
```
kozy/
├── README.md
├── LICENSE (MIT)
├── docs/
│   ├── PRD.md
│   └── mockups/
├── frontend/
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── vite.config.ts
├── backend/
│   ├── package.json
│   ├── src/
│   └── db/
├── tests/
│   ├── frontend/
│   └── backend/
└── package.json (workspace root)
```
