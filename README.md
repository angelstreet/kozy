# 🏠 Kozy

Open-source property management for short-term rental owners.

Manage your properties, coordinate cleaners, track payments — all in one clean app.

## Features (MVP)

- 📅 **Calendar** — iCal sync from Airbnb, Smoobu & Booking.com feeds, booking preview, see all turnovers at a glance; week view optimized for mobile
- 🧹 **Cleaning coordination** — Assign cleaners to properties, track task status
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
| Analytics | 🔜 Step 2 | — |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Hono
- **Database:** Turso (libSQL) — migrated from better-sqlite3
- **Deployment:** Vercel (serverless adapter)
- **Auth:** Clerk
- **PWA:** Vite PWA plugin

## Deployment

The app runs under the `/kozy/` base path for subpath routing (e.g. `https://yourdomain.com/kozy/`).

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

## Contributing

This is an open-source project. PRs welcome!

## License

MIT
