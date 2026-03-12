# 🏠 Kozy

Open-source property management for short-term rental owners.

Manage your properties, coordinate cleaners, track payments — all in one clean app.

## Features (MVP)

- 📅 **Calendar** — Advanced views: timeline Gantt (multi-property rows, horizontal bars, upcoming check-ins), week/month with filters/modals/source colors/continuation indicators; popover details; iCal + primary Smoobu API sync (encrypted keys, full property/bookings sync); Moobu/Smoobu-style UX redesign V2 (gradients, shadows, typography, chips); mobile-optimised filter bar (icon-only toggle, viewport-friendly)
- 📊 **Analytics** — Revenue & booking trend charts (area charts via Recharts); filter by property and period (30d / 3m / 6m / 1y); breakdown by source (Airbnb, Booking.com, Smoobu, Direct) with deduplication logic; owner-only page accessible from sidebar
- 🧹 **Cleaning coordination** — Assign cleaners to properties, track task status
- 👥 **Cleaners management** — Full CRUD for cleaners (list, add, edit, delete); cleaner detail page with property assignment manager (primary/backup roles); accessible from More page (`GET /cleaners`, `PUT /cleaners/:id`, `DELETE /cleaners/:id`, `GET/PUT /cleaners/:id/assignments`)
- 🔔 **Notification system** — Weekly notifications for cleaners; bell icon with unread badge in Sidebar and BottomNav; `/c/notifications` route with mark-as-read support (`GET /api/notifications`, `PATCH /api/notifications`, `POST /api/dev/seed`)
- 💶 **Payments** — Per-intervention tracking, Sunday rates, mark as paid
- 🏗️ **Travaux (Renovation Works)** — Track renovation costs per property with automatic cashflow impact calculation
- 🛒 **Shopping requests** — Cleaners flag what's needed, owners resolve
- 🌍 **Multi-language** — French & English
- 🌙 **Dark mode** — Because why not
- 📱 **Mobile-first PWA** — Works on any phone, no install needed; compact dashboard and property cards for optimal mobile UX

## Profiles

| Feature | Owner | Cleaner |
|---------|-------|---------|
| Dashboard | ✅ | — |
| Calendar | ✅ | — |
| Properties | ✅ (CRUD) | 👀 (read-only, assigned only) |
| Cleaning tasks | ✅ | ✅ (assigned only) |
| Payments | ✅ | 👀 (own earnings) |
| Shopping requests | ✅ (resolve) | ✅ (create) |
| Analytics | ✅ | — |
| Notifications | — | ✅ (own) |
| Cleaners mgmt | ✅ (CRUD + assign) | — |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Hono
- **Database:** Turso (libSQL) — migrated from better-sqlite3
- **Deployment:** Vercel (serverless adapter)
- **Auth:** Clerk
- **PWA:** Vite PWA plugin

## Deployment

The app supports configurable base path routing via the `VITE_BASE_PATH` environment variable. Set it to the desired subpath (e.g. `/kozy/`) and the router will use it automatically. If not set, the app runs at the root path. Previously this was hardcoded to `/kozy`.

Backend is deployed as a Vercel serverless function via `backend/api/index.ts`.

## Getting Started

```bash
# Install dependencies
npm install

# Start development
npm run dev
```

## Project Structure

```
kozy/
├── frontend/          # React app
├── backend/           # API server
├── docs/              # PRD, mockups
├── tests/             # Test suites
├── LICENSE            # MIT
└── README.md
```

## Integration

Kozy integrates with ClawBox/OpenClaw for AI-powered property management. See [docs/CLAWBOX-INTEGRATION.md](docs/CLAWBOX-INTEGRATION.md) and [docs/api.md](docs/api.md).

## Contributing

This is an open-source project. PRs welcome!

## License

MIT
