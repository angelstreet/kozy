# Kozy — plan (2026-11-01)

Goal: Kozy runs the rentals (Gignac house + two Noisy-le-Grand T2) day to day — guest replies,
reservations, cleaning, prices — and replaces PriceLabs. Smoobu stays as the channel manager:
its official Airbnb / Booking.com connections are what make messages, bookings and price
pushes reach the channels, and Kozy cannot get that access itself. Kozy drives Smoobu through
its API.

Private facts (listing IDs, addresses, results) are in the owner's `kozy` Claude skill, not
here — this repo is public.

## Strategy: everything through APIs, Kozy as the brain, Smoobu as the pipe

Owner rule: APIs, not browser automation. Consequences:

- Airbnb and Booking.com have no API for hosts; Smoobu (an approved partner on both) is the
  only programmatic way in: bookings, rates, guest threads, sending messages.
- Smoobu's automated templates ("Communication"), Guest Guide and Online Check-in are UI-only,
  and so are the channels' own scheduled messages. So "configure it in Smoobu first" is not an
  API path. Instead **Kozy sends the automatic messages itself** through
  `POST /api/reservations/{id}/messages/send-message-to-guest`, which works the same for every
  channel, direct bookings included.
- Kozy then replaces PriceLabs (prices pushed with `POST /api/rates`). Smoobu stays as the pipe.
- One manual step is unavoidable: switching off the Booking.com scheduled messages in the
  extranet once Kozy's versions are live (no API for it), so guests don't get them twice.

### Automatic guest messages today (harvested via the Smoobu messages API, 2026-11-01)

All current automatic messages are **Booking.com scheduled messages**. Smoobu sends nothing
automatically (one manual "Facture" template; Guest Guide has no content; Online Check-in is
off). Airbnb's side is invisible: Smoobu only receives the guest half of Airbnb threads.
Full texts are kept privately (they contain door codes), not in this repo.

| Property | After booking | Arrival day | Day before check-out | After check-out |
|---|---|---|---|---|
| Gignac house | — | FR, ~07:00, access + keybox + wifi | FR, keys + linen | — |
| Noisy T2 Balcon | FR + EN, practical info (check-out time placeholder is broken) | EN self check-in | FR, keys + bins | — |
| Noisy T2 Jardin | — | EN self check-in | EN, keys + bins | — |

Gaps: no confirmation for Gignac and Jardin, single-language messages, no review request,
nothing at all on Airbnb (guests ask for the address on arrival day), nothing for direct bookings.

- [x] Inventory of current templates (via API).
- [x] Kozy message engine (`backend/src/messaging/`): 5 templates × FR/EN, per-apartment
      placeholders (encrypted), send log, modes off / dry_run / live per channel.
- [x] Triggers: scheduler every 10 min (openclaw cron → `/api/messaging/run`) and Smoobu webhook
      (`/api/messaging/webhook`), both behind `MESSAGING_CRON_SECRET`. Skips cancelled, blocked and
      owner-block bookings; J-3 not sent for later bookings; 6 h grace window.
- [ ] Dry-run week: Kozy shows what it would send; owner approves the texts.
- [ ] Go live on Airbnb first (nothing runs there today), then Booking.com + switch off its
      scheduled messages (manual, once).

## Phase 0 — Smoobu key migration (deadline: legacy `Api-Key` auth stops 3 Nov 2026)

New keys (`usr_live_…` + secret) sign every request: base64 HMAC-SHA256 over
`METHOD \n path \n sorted query \n timestamp \n nonce \n sha256(body) \n keyId`, sent as
`X-API-Key`, `X-Timestamp`, `X-Nonce`, `X-Signature` (docs.smoobu.com, HMAC Authentication).

- [x] New key + secret added to openclaw `~/.openclaw/secrets/smoobu.env`
      (`SMOOBU_API_KEY_ID`, `SMOOBU_API_SECRET`; legacy `SMOOBU_API_KEY` kept until 3 Nov).
- [x] Mac `~/kozy/.env` uses the same two names.
- [x] openclaw `workspace/skills/smoobu/scripts/smoobu.py` already signs when both are set — verified live.
- [x] Kozy backend: `backend/src/smoobu-client.ts` signs requests; sync, apartments and
      settings use it. Stored value = encrypted JSON `{keyId, secret}`; a legacy plain key still works.
      Signature checked against Smoobu's documented example and live (`/api/me`, apartments, reservations).
- [x] Settings page takes key + secret.
- [x] Legacy key removed from tracked files (`store-smoobu-key.js`, `test-smoobu-sync.js`, proof doc).
      It stays in git history; it dies on 3 Nov anyway.
- [x] Production build fixed (invalid `vercel.json`, broken pre-push hook, API function built as
      CommonJS, default-export handler). Live at kozy-steel.vercel.app since 2026-11-01.
- [x] `ENCRYPTION_KEY` added to Vercel; new key + secret stored (encrypted) for the owner's Clerk user;
      live `/api/smoobu/apartments` returns the three apartments.
- [x] Konto (separate repo) Property ROI moved to signed requests (angelstreet/konto 26a53d4), new key stored, live ROI verified.
- [ ] After 3 Nov: delete legacy `SMOOBU_API_KEY` everywhere.

## Phase 1 — one source of truth for the three properties

- [ ] Prod DB holds the real three properties linked to Smoobu apartments (today: test data).
- [ ] Turn the `dev` branch / openclaw checkout state into `main` (dev is 3 ahead, 91 behind).
- [ ] Smoobu webhooks → Kozy endpoint (new / changed / cancelled bookings, new guest message)
      instead of polling; verify webhook signatures.
- [ ] Store the full booking record (price details, commission, city tax, guest language, notes).

## Phase 2 — guest messaging (Airbnb, Booking.com, direct)

- [ ] Read threads: `GET /api/reservations/{id}/messages`.
- [ ] Inbox in Kozy: unanswered messages first, per property, with booking context.
- [ ] Drafted replies in the guest's language from a per-property knowledge base
      (access, wifi, parking, check-in/out, house rules, local tips) — owner approves, then
      `POST /api/reservations/{id}/messages/send-message-to-guest`.
- [ ] Scheduled messages: booking confirmation, pre-arrival instructions, mid-stay check, check-out, review request.
- [ ] Later: auto-send for safe templates only; anything about money, refunds, dates or complaints waits for the owner.

- [ ] Idea (owner: not now, 2026-11-01): guest reviews can't be posted by API (no review endpoint
      in Smoobu, no Airbnb host API). Daily Telegram nudge from openclaw instead: guests who left
      yesterday, a ready-to-paste 5-star text in their language, reservation link; flagged guests skipped.

## Phase 3 — reservations

- [ ] Create / edit / cancel direct bookings from Kozy (`POST/PUT/DELETE /api/reservations`),
      availability check first (`/booking/checkApartmentAvailability`).
- [ ] Owner blocks, early check-in / late check-out, guest count changes.
- [ ] Cleaning task follows every change (exists for synced bookings already).

## Phase 4 — pricing engine (replaces PriceLabs)

PriceLabs today: base/min/max per listing, pushes daily prices to Smoobu.

- [ ] Shadow mode: Kozy computes a daily price + min stay per property for 365 days and shows
      it next to the current Smoobu rate (`GET /api/rates`). Nothing pushed.
- [ ] Inputs: own history (ADR, occupancy by month and weekday), booking pace vs same date last
      year, lead time, season, school holidays (zones A/C), events (Disneyland, Marseille / Aix),
      gap nights, last-minute discounts, min/max guardrails per property.
- [ ] Compare 4–6 weeks: Kozy vs PriceLabs recommendations vs what actually books.
- [ ] Push via `POST /api/rates` (price + min stay), owner switch per property, daily job, audit log.
- [ ] Cancel PriceLabs once Kozy prices have matched or beaten it for a full month.
- [ ] Clean up PriceLabs meanwhile: 7 listings tracked, only 3 push (duplicates of the Airbnb
      listings, an empty studio, an old Courbevoie flat) — check what is billed.

## Phase 5 — ROI

- [ ] Net revenue per booking after channel commission (verify what Smoobu `price` contains).
- [ ] Per property: revenue, costs (cleaning, Travaux, charges, loan), cash flow, yield.
- [ ] Channel mix and direct-booking push (direct = no commission): returning-guest offer, own booking page.
- [ ] Cancellation analysis per property and channel; adjust cancellation policies.
- [ ] Price checks the data already shows: Noisy flats at 80–92 % occupancy with flat prices year-round;
      Gignac fully booked in Jul/Aug.

## Phase 6 — UI/UX glow-up

Mockup first, then build, in light and dark, mobile first (owner rules: `web-ui-ux-rules` skill).

- [x] Mockup v1 (2026-11-01, private canvas https://claude.ai/artifact/6AK4o6P32jUN7E5owWz42U): Today, Inbox +
      quick replies, Automatic messages, Calendar, Results, Today dark. Warm off-white / teal, Inter, 5-tab nav
      (Today, Calendar, Inbox, Results, More). Waiting for owner feedback before building.
- [x] Build v1 (2026-11-01): colour tokens light/dark (`frontend/src/index.css`, Tailwind `page/surface/line/ink/
      muted/accent/...`), Inter, new header (language, theme, role, account icons), 5-tab nav (Today, Calendar,
      Messages, Results, More; Properties in More and the desktop sidebar), new Today and Messages screens
      (sending mode, rules on/off, 7-day preview, quick replies, log), every other screen moved onto the tokens,
      emoji replaced by icons. Fixed: the deployed app called `/kozy/api` (HTML) instead of `/api`.
- [x] Owner's 3 properties created in prod Kozy and Smoobu history imported (804 bookings).
- [ ] Calendar and Results: real redesign (today only re-coloured); booking bars still use old channel hexes.
- [ ] Imported bookings include Smoobu cancellations? `status` is null on all 804. The full sync already drops
      `type: cancellation` (`smoobu-sync.ts`), so probably fine: confirm against one known cancellation.
- [ ] Logo: today the favicon is a house emoji, the PWA icons are 1×1 placeholder pixels (phone home screen shows a
      blank tile) and `index.html` still points icons at `/kozy/`. Mockup 3 marks (light/dark, 16 px to 512 px), then
      favicon.svg, PWA 192/512 + maskable, apple-touch-icon, `Logo.tsx`.
- [ ] Audit every owner screen (dashboard, calendar, properties, analytics, cleaners, payments, settings) and the cleaner screens.
- [ ] Design tokens + one component set (shadcn/ui is already in the stack); icons with labels, one primary action per screen.
- [ ] New screens: Inbox (Phase 2), Pricing (Phase 4), ROI (Phase 5).
- [ ] Remove debug/screenshot scripts and PNGs from the repo root.

## Security

- [x] `POST /api/seed`, `/api/reset` and `/api/dev/*` were public and wipe the DB: now 403 on Vercel/production (2026-11-01).
- [x] `/api/notifications*` was public and read every owner's tasks: removed (2026-11-02). `/api/tasks`,
      `/api/shopping`, `/api/cleaners*`, cleaning credits / links / invites scoped to the owner (`cleaner.owner_id`)
      or the cleaner's own data.
- [x] The legacy login page showed the owner's email and a password in the public bundle: removed (still in git
      history).

## Phase 7 — cleaning (2026-11-01)

Before (2026-11-01): `cleaning_task` (date, status, assigned cleaner, rate), `shopping_request` (free text), in-app notifications
only, a daily reminder endpoint nothing calls. Prod has 0 tasks and only seed cleaners. A full Smoobu sync deletes
every task of the property, so anything attached to a task would be lost.

- [x] Tasks follow bookings (`backend/src/cleaning/`, 2026-11-01): one task per guest check-out for 60 days, window =
      check-out time → next guest check-in, primary cleaner assigned, keyed on the Smoobu id (`booking_ref`) so syncs
      no longer wipe tasks; moved / cancelled / new-next-arrival detected. Rebuilt every 10 min by openclaw.
- [x] Cleaners (2026-11-02): Ester on the two Noisy flats, Christelle on the villa.
- [x] WhatsApp planning per cleaner, in the owner's own format (owner: the first version was too long):
      `Haut : 31 oct, 3, 10, 21 nov` per property, today + 3 weeks, guests for the villa `3(8)`. Sent Sunday 19:00
      to everyone; a booking change inside 3 weeks sends one planning at 19:00 that day, a change for today or
      tomorrow at once, beyond 3 weeks waits for Sunday (`cleaner.planning_due`). "Send now" on Cleaners. Labels per property (`PUT /api/cleaning/properties/:id`). No reminders or week plans.
      Each cleaner also has a no-login schedule page `/s/<token>`. Outbox `cleaner_message`; openclaw
      `scripts/openclaw/kozy-cleaning-run.py` sends through its WhatsApp channel (relinked 2026-11-02).
- [x] Evening reminder (2026-11-10, owner's wording): 20:00 the day before each cleaning, "Bonjour Ester,\nPetit
      rappel demain intervention en haut et en bas" (`property.cleaning_place`, default 'en ' + label; villa "à la
      villa"). The pack counter is no longer in the planning message (owner adds it by hand; still in the app).
- [x] Test number: while set, every live message goes to the owner's phone headed `[Christelle]` (on now).
- [x] Prepaid pack counter (Ester, 2026-11-02): packs of 6, last line of her planning `9/12` = used / paid,
      +1 per cleaning, +2 on Sunday or a public holiday, moves by itself on the cleaning day.
      "+6 payés" button on Cleaners. Christelle is paid per cleaning: no counter.
- [ ] Go live to the real numbers: clear the test number (both cleaners' numbers are in).
- [ ] Email / SMS as a second channel if a cleaner has no WhatsApp.
- [ ] Guest-damage reports: flag the ones within 14 days of check-out for an Airbnb / Booking claim.
- [x] Cleaner accounts (2026-11-02, owner chose accounts over link sign-in): "Envoyer l'invitation" on the cleaner
      screen sends `/invite/<token>` by WhatsApp; she creates a Clerk account there and joins (`cleaner.clerk_user_id`).
      `GET /api/me` decides cleaner vs owner (no role picker or switch in prod). Cleaner app: Planning (her cleanings,
      window, guests, pack counter, mark done) + Courses. Old cleaner screens removed.
- [x] Mockup v1 of the cleaner app (2026-11-03, private canvas https://claude.ai/artifact/3GRFvMuzFj6C6RnPQdxsiN):
      planning, cleaning in progress (checklist by room, progress, photo steps), photo step (reference vs taken),
      report (missing / broken / product / guest damage + photo), finish (summary, pack counter), stock per
      property (OK / Bas / Vide → shopping list), owner's cleaning report, dark mode. Waiting for owner feedback.
- [x] Cleaner app built (2026-11-03, `backend/src/cleaning/visit.ts`): checklist per property (default 5 rooms,
      16 steps, 5 photo steps), cleaning screen (progress, photo steps with reference, report, finish + note),
      report screen, stock (OK / Bas / Vide), owner's cleaning report page and "Ménages" section on Cleaners
      (open reports, shopping list, recent cleanings). Photos: resized on the phone (1280 px JPEG), kept in the DB,
      served only to the owner or the property's cleaner. Owner gets a WhatsApp note per report and per finished
      cleaning (`owner_phone`).
- [x] Checklist editor (2026-11-03, Cleaners › "Liste de ménage", `/checklist`): per property, rename / add / delete /
      reorder rooms and steps, photo on or off per step, reference photo per photo step, stock product list.
      Deleted steps stay inactive so past cleanings keep their history.
- [ ] Pack counter from cleanings marked done (today: by calendar date).
- [x] Cron health (2026-11-03): openclaw job every 10 min, Telegram alert to the owner when WhatsApp drops or a
      run fails (max one per 6 h). Kozy dates checked against Smoobu: all November check-outs match.

## Phase 8 — assistant / automation

- [ ] Extend `backend/src/integration/` actions (today read-only) with draft-reply, create-booking,
      price-preview, so OpenClaw / Claude can run the same flows from chat.
- [ ] Daily brief: arrivals, departures, cleanings, unanswered messages, price changes.
