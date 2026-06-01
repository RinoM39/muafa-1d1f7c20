## Update Facility "View Bookings" page

The page at `/facility/bookings` already has the core structure (Upcoming/Completed tabs, status update via `endSession`, user name display). This plan brings it fully in line with the requirements.

### Changes to `src/routes/facility.bookings.tsx`

1. **Chronological sorting**
   - Currently all rows are fetched with `order("slot_start", { ascending: false })`.
   - Split into the right order per tab:
     - `upcoming`: sort ascending (closest first).
     - `completed`: sort descending (most recent first — natural history view).
   - Done client-side after fetch (single query, two sorted lists).

2. **Default tab**
   - Already `defaultValue="upcoming"` — keep as-is.

3. **Action button rename**
   - Rename the "End session" trigger button to **"Complete Booking"** with Arabic label **"إنهاء الحجز"**.
   - Dialog title → "Complete Booking / إنهاء الحجز".
   - Confirm button → "Confirm / تأكيد".
   - Keep the existing flow: optional report URL, calls `endSession` server fn, marks status `completed`, releases funds, opens the patient-rating dialog.

4. **Upcoming card polish**
   - Show patient name prominently (already there).
   - Add a small badge showing the time-until (e.g. "in 2h", "tomorrow") next to the date for quick scanning.
   - Make the "Complete Booking" button visually prominent (primary, full-width on mobile, right-aligned on desktop).

5. **State refresh after completion**
   - Already calls `load()` after `endSession` succeeds → booking automatically disappears from Upcoming and shows up under Completed. No change needed beyond confirming this still works after the sort change.

6. **Tab labels**
   - "Upcoming Bookings (n)" and "Completed Bookings (n)" — slight rename from current "Upcoming"/"Completed".

### Out of scope
- No database / RLS / server-fn changes. `endSession` already does the status flip and wallet release.
- No changes to the medical-report uploader or the rating dialogs.
- No changes outside `src/routes/facility.bookings.tsx`.
