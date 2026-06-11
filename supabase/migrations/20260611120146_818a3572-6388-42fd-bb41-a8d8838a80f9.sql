
-- Fix 1: Prevent facility owners from booking their own facility
DROP POLICY IF EXISTS bookings_user_insert ON public.bookings;
CREATE POLICY bookings_user_insert ON public.bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND status = 'upcoming'::booking_status
  AND price = (
    SELECT f.price FROM public.facilities f
    WHERE f.id = bookings.facility_id AND f.is_active = true AND f.is_banned = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
);

-- Fix 2: Restrict ratings reads to participants (rater, ratee) and facility owner aggregates via separate logic
DROP POLICY IF EXISTS ratings_authenticated_read ON public.ratings;
CREATE POLICY ratings_participant_read ON public.ratings
FOR SELECT
TO authenticated
USING (
  auth.uid() = rater_id
  OR auth.uid() = ratee_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
