# Kozy — plan (2026-11-01)

Goal: Kozy runs the rentals (Gignac house + two Noisy-le-Grand T2) day to day — guest replies,
reservations, cleaning, prices — and replaces PriceLabs. Smoobu stays as the channel manager:
its official Airbnb / Booking.com connections are what make messages, bookings and price
pushes reach the channels, and Kozy cannot get that access itself. Kozy drives Smoobu through
its API.

Private facts (listing IDs, addresses, results) are in the owner's `kozy` Claude skill, not
here — this repo is public.

## Strategy: consolidate in Smoobu first, then move to Kozy

1. **Smoobu first.** Everything that is configured separately on Airbnb and Booking.com today
   (automatic messages, house rules, check-in info) moves into Smoobu, so there is one place
   that covers every channel, direct bookings included. Then switch the channel-side copies
   off so guests don't get the same message twice.
2. **Then Kozy.** Kozy takes over from Smoobu and PriceLabs feature by feature (messages,
   reservations, pricing), always through Smoobu's API, with Smoobu's version switched off only
   once Kozy's has run without problems.
3. **What stays in Smoobu:** the Airbnb / Booking.com connection itself (only approved partners
   get those APIs). Kozy can shrink Smoobu to a pipe, not remove it.

### Automatic guest messages — state on 2026-11-01 (from Smoobu message threads)

| | Booking.com | Airbnb |
|---|---|---|
| Booking confirmation | Rare: 1 of ~10 recent bookings got "Merci pour votre réservation…" minutes after booking | Not visible — Smoobu only receives the guest side of Airbnb threads |
| Arrival day check-in instructions (~08:30) | Yes: Gignac (French) and Noisy (English, address + code) | Not visible; guests ask for the address on arrival day, which suggests none |
| Day before check-out reminder | Yes (~09:00) | Not visible |
| Check-in time requests | Answered "Request approved/declined" | — |

Smoobu UI, checked 2026-11-01:
- **Experience → Communication** (automated templates): one template only, "Facture", manual
  sending only. Smoobu sends nothing automatically, so the Booking.com messages above come from
  Booking.com's own scheduled messages.
- **Guest Guide**: enabled, standard blocks on (tours, weather, review, map, book next stay…),
  but no content blocks and no message sends its `[guestAppLink]` — guests never see it.
- **Online Check-in**: disabled.

- [x] Smoobu automated messages checked (above).
- [ ] Booking.com extranet → scheduled messages, Airbnb → scheduled messages: list each template,
      language and trigger (needs the owner signed in to both in Chrome).
- [ ] Rebuild the full set in Smoobu for all channels and all 3 properties, in FR + EN:
      booking confirmation, J-3 practical info, arrival-day check-in (address, code, photos),
      mid-stay check, day-before check-out, after check-out thank-you + review request.
- [ ] Switch off the Airbnb / Booking.com copies; check the next booking on each channel.
- [ ] Move to Smoobu what can replace PriceLabs there (seasonal rates, weekday/weekend,
      length-of-stay and last-minute rules) — then Kozy's pricing engine (Phase 4) replaces both.

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

- [ ] Audit every owner screen (dashboard, calendar, properties, analytics, cleaners, payments, settings) and the cleaner screens.
- [ ] Design tokens + one component set (shadcn/ui is already in the stack); icons with labels, one primary action per screen.
- [ ] New screens: Inbox (Phase 2), Pricing (Phase 4), ROI (Phase 5).
- [ ] Remove debug/screenshot scripts and PNGs from the repo root.

## Phase 7 — assistant / automation

- [ ] Extend `backend/src/integration/` actions (today read-only) with draft-reply, create-booking,
      price-preview, so OpenClaw / Claude can run the same flows from chat.
- [ ] Daily brief: arrivals, departures, cleanings, unanswered messages, price changes.
