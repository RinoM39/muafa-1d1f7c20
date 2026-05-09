-- 1. Foreign keys on bookings
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_user_fk FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT bookings_facility_fk FOREIGN KEY (facility_id)
    REFERENCES public.facilities(id) ON DELETE CASCADE;

-- 2. Prevent duplicate ratings per booking + direction
CREATE UNIQUE INDEX IF NOT EXISTS ratings_unique_per_direction
  ON public.ratings (booking_id, rater_id, direction);

-- 3. Speed up My Bookings list
CREATE INDEX IF NOT EXISTS bookings_user_slot_idx
  ON public.bookings (user_id, slot_start DESC);

-- 4. Realtime for bookings
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;