DROP POLICY IF EXISTS "profiles_select_facility_owner_for_booking" ON public.profiles;

CREATE POLICY "profiles_select_facility_owner_for_upcoming_booking"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    JOIN public.facilities AS f ON f.id = b.facility_id
    WHERE b.user_id = profiles.id
      AND f.owner_id = auth.uid()
      AND b.status = 'upcoming'::public.booking_status
  )
);