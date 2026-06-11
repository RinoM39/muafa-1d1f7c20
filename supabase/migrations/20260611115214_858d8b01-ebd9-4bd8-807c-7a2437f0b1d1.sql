CREATE POLICY "profiles_select_facility_owner_for_booking" ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.facilities f ON f.id = b.facility_id
    WHERE b.user_id = profiles.id AND f.owner_id = auth.uid()
  )
);