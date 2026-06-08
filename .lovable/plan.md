## Goal

On the facility owner's `View Bookings` page (`/facility/bookings`), make tab placement time-aware so a booking automatically moves out of "Upcoming" the moment its slot starts, even before the owner clicks Complete.

## Current behavior

`src/routes/facility.bookings.tsx` splits rows purely by DB `status`:
- `upcoming` → Upcoming tab
- `completed` → Completed tab

The badge already flips to "In progress / جارية" when `slot_start <= now`, but the row stays under Upcoming until the owner clicks Complete. The Complete button is shown inside the Upcoming card only after the slot starts.

## Proposed behavior

Re-bucket rows by an `effectiveStatus` derived from time + DB status, not DB status alone.

1. **Buckets**
   - **Upcoming Bookings** = `status === 'upcoming'` AND `slot_start > now`
   - **Active / In Progress** (new middle tab) = `status === 'upcoming'` AND `slot_start <= now`
   - **Completed Bookings** = `status === 'completed'`
   - Cancelled stays out of all three (unchanged).

2. **Reactivity**
   - Add a `useEffect` ticking `setNow(Date.now())` every 30s at the page level so rows migrate between tabs without a refresh (the per-card ticker already exists; lift one to the parent for bucketing).
   - Realtime subscription on `bookings` already triggers `load()` on insert/update, so new bookings appear instantly in Upcoming.

3. **UI per tab**
   - **Upcoming**: read-only card (patient name, time, "Confirmed / مؤكد" badge, countdown `timeUntil`). No Complete button. No "Not started yet" disabled button — just omit it.
   - **Active**: same card layout, "In progress / جارية" badge, prominent **Complete Booking / إنهاء الحجز** button opening the existing report-URL dialog. After confirm → `endSession` server fn → row moves to Completed via realtime refresh.
   - **Completed**: unchanged (rate patient + medical report uploader). Status is frozen — no Complete button, no edits to slot.

4. **Tab counts** update from the new buckets: `Upcoming (n)`, `Active (n)`, `Completed (n)`.

## Files to change

- `src/routes/facility.bookings.tsx`
  - Add page-level `now` state with 30s interval.
  - Compute `upcoming`, `active`, `completed` arrays using `now` + status.
  - Add third `<TabsTrigger value="active">` + `<TabsContent value="active">`.
  - Simplify `BookingCard` to always show Complete (it only renders in the Active tab now); drop the internal `started` gate and the "Not started yet" disabled button.

## Out of scope

- No DB schema change. Existing `status` enum (`upcoming`, `completed`, `cancelled`) is sufficient; "active" is a derived view, not a stored state. This keeps `endSession` and RLS untouched.
- No change to the patient's bookings page (already handled in a prior turn).
- No change to server functions, migrations, or realtime config.
