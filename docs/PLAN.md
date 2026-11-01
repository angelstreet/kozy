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
- [ ] `/api/notifications*` skips auth (any cleaner_id readable): put it behind Clerk or a cleaner token.

## Phase 7 — cleaning (2026-11-01)

Today: `cleaning_task` (date, status, assigned cleaner, rate), `shopping_request` (free text), in-app notifications
only, a daily reminder endpoint nothing calls. Prod has 0 tasks and only seed cleaners. A full Smoobu sync deletes
every task of the property, so anything attached to a task would be lost.

- [ ] Tasks follow bookings: one task per check-out (window = check-out → next check-in), primary cleaner assigned,
      upsert keyed on the booking instead of delete + recreate; moved or cancelled booking moves or cancels the task.
- [ ] Real cleaners per property (name, phone, email, language, preferred channel).
- [ ] Messages to the cleaner, each with a no-login link to the task page:
      new task, J-1 reminder (18:00) with time window + guests count, change (moved / cancelled / new) with the full
      upcoming schedule, weekly schedule on Sunday. Email via Resend (free tier); SMS via Brevo or Twilio (paid,
      about 0.07 € per SMS) or WhatsApp. Owner picks.
- [ ] Cleaning guide per property: rooms → steps (beds, bathroom, kitchen, bins, linen, restock, keys), reference
      photo per step ("how it should look"), editable by the owner, FR/EN.
- [ ] Cleaner flow on the phone: start → tick steps → photo for required steps (camera upload, Vercel Blob) →
      done. Done is blocked until required steps and photos are in.
- [ ] Reports from any step: missing item, broken item, product needed, damage by guest — type, note, photo.
      Owner is notified at once; damage within 14 days of check-out is flagged for an Airbnb / Booking claim.
- [ ] Stock per property (toilet paper, soap, coffee, cleaning products, linen sets): cleaner sets low / out,
      replaces the free-text shopping list; owner gets one restock list.
- [ ] Owner view: task timeline, photos, reports, approve → payment created.
- [ ] Before any of this: put `/api/tasks`, `/api/shopping`, `/api/notifications*` behind auth (Security).

## Phase 8 — assistant / automation

- [ ] Extend `backend/src/integration/` actions (today read-only) with draft-reply, create-booking,
      price-preview, so OpenClaw / Claude can run the same flows from chat.
- [ ] Daily brief: arrivals, departures, cleanings, unanswered messages, price changes.
