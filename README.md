# 🏠 Kozy

Open-source property management for short-term rental owners.

Manage your properties, coordinate cleaners, track payments — all in one clean app.

## Features (MVP)

- 📅 **Calendar** — iCal sync from Airbnb/Booking.com, see all turnovers at a glance
- 🧹 **Cleaning coordination** — Assign cleaners to properties, track task status
- 💶 **Payments** — Per-intervention tracking, Sunday rates, mark as paid
- 🛒 **Shopping requests** — Cleaners flag what's needed, owners resolve
- 🌍 **Multi-language** — French & English
- 🌙 **Dark mode** — Because why not
- 📱 **Mobile-first PWA** — Works on any phone, no install needed

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
- **Database:** SQLite
- **PWA:** Vite PWA plugin

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
