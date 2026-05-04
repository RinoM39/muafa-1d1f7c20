
# Mu'afa (مُعافى) — Medical Booking Platform

A bilingual (AR/EN, RTL/LTR) Progressive Web App where users book appointments at radiology centers, labs, and clinics. Three roles, wallet-based payments, mutual ratings, medical report uploads, and 1-hour-before push reminders.

**Brand:** Primary `#5A9789`, clean medical aesthetic, mobile-first.

---

## 1. User Roles

### Role 0 — Regular User
- Browse facilities and services
- Book appointments using wallet balance
- View booking history (upcoming with countdown / past)
- View medical reports uploaded by facility
- Rate facility after session ends
- Receive push reminder 1 hour before appointment

### Role 1 — Facility Owner
- Create/edit facility (name, location/Maps link, phone, image, description)
- Define weekly schedule (working days, start/end hours, session duration, price)
- See incoming bookings, mark "End Session"
- Upload report image per booking
- Rate the user after session
- Receive push notification when a new booking is created

### Role 2 — Admin
- Full CRUD on users, facilities, bookings
- Ban/unban users and facilities
- Manually credit wallets (top-up requests queue)
- Analytics dashboard: total users by role, monthly revenue, growth, top facilities

---

## 2. End-to-End Lifecycle

1. **Auth** — Email/password signup with role selection (User or Facility Owner). Admin seeded.
2. **Onboarding** — Facility owners complete a facility profile before going live.
3. **Wallet top-up** — User submits a top-up request → admin approves → balance credited.
4. **Browse** — User opens grid of facilities (image, name, price, rating).
5. **Booking** — User picks day from upcoming week, picks an auto-generated time slot, confirms. Wallet is debited and the amount held as `pending`.
6. **Reminder** — Scheduled job fires web push to user 1h before; facility was notified at creation.
7. **Session** — Facility marks "End Session" → `pending` funds are released to facility wallet → both sides prompted to rate each other → optional report image upload.
8. **History** — Both parties see the completed booking with rating + report.

---

## 3. Pages & Interfaces

### Public
- `/` Landing — hero, how it works, featured facilities, AR/EN switcher
- `/login`, `/register`
- `/facilities` Grid of facilities (cards: image, name, price, ⭐rating, View Details, Book Now)
- `/facilities/$id` Details — full image, description, location (Maps embed), price, day picker, slot picker, confirm

### User (Role 0)
- `/account` Profile + wallet balance + top-up request button
- `/account/bookings` Upcoming (with live countdown) and Past tabs; each card shows status, report (if uploaded), rating action

### Facility (Role 1)
- `/facility/dashboard` Today's bookings, quick stats
- `/facility/setup` Create/edit facility + weekly schedule form
- `/facility/bookings` All bookings; actions: End Session, Upload Report, Rate User

### Admin (Role 2)
- `/admin` Analytics dashboard (charts: users by role, monthly revenue, growth, top facilities)
- `/admin/users` List + ban/unban
- `/admin/facilities` List + ban/unban
- `/admin/bookings` List + delete
- `/admin/wallet-requests` Approve/reject top-up requests

---

## 4. Booking System Logic

**Slot generation (client + server):** Given `start_time`, `end_time`, `session_duration_minutes`, generate slots `[start, start+dur), [start+dur, start+2dur), …` until end. Slots are *virtual* — only the booked ones are persisted.

**Weekly recurring:** Schedule stores `working_days` (array of weekday numbers 0–6) + hours. Available slots are computed for the next 7 days on demand. No monthly regeneration table needed.

**Conflict prevention:** Booking insert wraps a transaction that re-checks `WHERE facility_id=? AND slot_start=?` with a unique constraint `(facility_id, slot_start)`. Concurrent attempts get a unique-violation error → "slot just taken, pick another."

**Auto-close when full:** A day's slots disappear from the picker once all are booked.

**Wallet linkage:** On booking insert → debit user wallet, create `wallet_transaction(type=hold, status=pending)`. On `End Session` → flip to `released` and credit facility wallet.

---

## 5. Wallet System

- Each user has one wallet row (`balance`, `pending`).
- Top-up: user creates `wallet_request` → admin approves → `balance += amount`, transaction logged.
- Booking: `balance -= price`, `pending += price` on user side; mirrored as incoming pending on facility side.
- End session: user `pending -= price`; facility `pending -= price`, `balance += price`.
- Cancellation policy (v1): manual refund by admin.

---

## 6. Rating System

- Triggered by facility clicking **End Session**.
- Both sides see a rating prompt next time they open the app (and via in-app banner).
- 1–5 stars + optional comment. Stored in `ratings` with `rater_id`, `ratee_id`, `booking_id`, `direction` (user→facility or facility→user).
- Facility's displayed rating = avg of user→facility ratings. Same for users (visible to facilities only).

---

## 7. Notification System (Web Push)

- VAPID keys generated and stored as server secrets.
- Service worker registers push subscription on first login (with permission prompt).
- Subscriptions stored in `push_subscriptions` table.
- **Trigger 1 — booking created:** server function sends push to facility immediately.
- **Trigger 2 — 1h before:** a cron-style server route `/api/public/cron/send-reminders` runs every 5 minutes (called by pg_cron), finds bookings starting in 55–65 min, sends push, marks `reminder_sent=true`.
- In-app notification center mirrors all pushes (`notifications` table) so users without push permission still see them.

---

## 8. PWA Architecture

- **Manifest** (`/manifest.webmanifest`): `name: "Mu'afa"`, `short_name: "Mu'afa"`, `theme_color: #5A9789`, `background_color: #5A9789`, `display: standalone`, icons 192/512 + maskable.
- **Service worker** (`/sw.js`): precache app shell, runtime `NetworkFirst` for HTML, `CacheFirst` for static assets, push event handler, notification click → open booking.
- **Install prompt:** custom "Add to Home Screen" button using `beforeinstallprompt`.
- **Splash:** browser-generated from manifest `name` + icon + `background_color`.
- **Preview-safe:** SW registration skipped when running in iframe / preview host (only active on published deployment).
- **Responsive:** Tailwind breakpoints, mobile-first grid → 2-col tablet → 3-col desktop.

---

## 9. UX Flow Story

> Sara opens Mu'afa from her home screen. The teal splash with the Mu'afa logo flashes, then the facility grid loads. She taps a radiology center, sees its rating and price, picks Thursday at 11:00, and confirms — 150 EGP leaves her wallet and shows as "pending." She gets a push at 10:00 Thursday: *"Your appointment is in 1 hour."* After her scan, the technician taps **End Session** and uploads her report. Sara opens the app, sees the report, gives the center 5 stars. The center rates her too. Done.

---

## 10. Database Design

```text
profiles(id, full_name, phone, avatar_url, locale, created_at)
user_roles(id, user_id, role)              -- enum: user|facility|admin
facilities(id, owner_id, name, description, image_url, location_url,
           phone, price, session_duration_min, start_time, end_time,
           working_days int[], is_active, banned)
bookings(id, user_id, facility_id, slot_start, slot_end, status,
         price, report_url, reminder_sent, ended_at, created_at)
  UNIQUE(facility_id, slot_start)
wallets(user_id, balance, pending)
wallet_transactions(id, user_id, booking_id, amount, type, status, created_at)
wallet_requests(id, user_id, amount, status, created_at, decided_at)
ratings(id, booking_id, rater_id, ratee_id, direction, stars, comment)
push_subscriptions(id, user_id, endpoint, p256dh, auth, created_at)
notifications(id, user_id, title, body, link, read, created_at)
```

All tables have RLS. Roles checked via `has_role(uid, role)` security-definer function (never store role on profiles).

---

## 11. Technical Section

- **Stack:** TanStack Start + React 19 + Tailwind v4, Lovable Cloud (Supabase) for DB/Auth/Storage, web-push for VAPID.
- **Auth:** Email/password via Supabase. `_authenticated` layout route + `_admin` / `_facility` nested layouts using `has_role`.
- **Server logic:** `createServerFn` with `requireSupabaseAuth` for booking creation (transactional slot lock), wallet ops, rating writes. Admin ops use `supabaseAdmin`.
- **Cron:** `pg_cron` calls `/api/public/cron/send-reminders` every 5 min with a shared secret header.
- **Storage buckets:** `facility-images` (public), `medical-reports` (private, signed URLs, RLS: user can read own booking's report; facility can write to own booking).
- **i18n:** `react-i18next` with `ar` + `en`, `dir="rtl"` toggled on `<html>`. Tailwind logical properties (`ms-*`, `me-*`).
- **PWA:** `vite-plugin-pwa` with iframe/preview guard, `NetworkFirst` for HTML, `devOptions.enabled: false`.

---

## 12. Future Scalability

- Online payments (Stripe/Paymob) replacing manual top-up
- Multi-branch facilities
- Doctor-level scheduling within a facility
- SMS reminders fallback
- Patient medical history timeline
- Facility analytics & payout dashboard
- Native wrappers via Capacitor

---

**Build order after approval:** DB schema + roles → auth + i18n shell → facility CRUD + schedule → public browse + booking transaction + wallet → reports + ratings → admin dashboard → push + cron → PWA manifest/SW polish.
