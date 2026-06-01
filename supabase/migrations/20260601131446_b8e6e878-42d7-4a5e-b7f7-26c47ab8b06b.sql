
-- 1. Lock down SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_role(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_booking_report(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_booking_report(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_facility_owner_for_booking(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_facility_owner_for_booking(uuid, uuid) TO authenticated, service_role;

-- Trigger-only functions: not callable from the API at all
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_facility_rating() FROM PUBLIC, anon, authenticated;

-- 2. Hide facilities.phone from anonymous visitors via column-level grants
REVOKE SELECT ON public.facilities FROM anon;
GRANT SELECT (
  id, owner_id, name, description, image_url, location_url,
  session_duration_min, price, start_time, end_time, working_days,
  is_active, is_banned, avg_rating, ratings_count, created_at, updated_at
) ON public.facilities TO anon;
-- authenticated users keep full read (including phone)
GRANT SELECT ON public.facilities TO authenticated;

-- 3. Restrict ratings reads to signed-in users
DROP POLICY IF EXISTS ratings_public_read ON public.ratings;
CREATE POLICY ratings_authenticated_read ON public.ratings
  FOR SELECT TO authenticated USING (true);

-- 4. Bookings insert: enforce price + status integrity
DROP POLICY IF EXISTS bookings_user_insert ON public.bookings;
CREATE POLICY bookings_user_insert ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'upcoming'
    AND price = (SELECT f.price FROM public.facilities f WHERE f.id = facility_id)
  );

-- 5. Wallet requests insert: prevent self-approval
DROP POLICY IF EXISTS wallet_req_insert_self ON public.wallet_requests;
CREATE POLICY wallet_req_insert_self ON public.wallet_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND decided_by IS NULL
    AND decided_at IS NULL
  );

-- 6. Storage: remove broad listing policy on facility-images.
-- Public URLs (/storage/v1/object/public/facility-images/...) keep working
-- because the bucket has public=true; we only block API listing/enumeration.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (qual LIKE '%facility-images%' OR policyname ILIKE '%facility%image%' OR policyname ILIKE '%facility-images%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 7. Remove sensitive tables from realtime broadcast to prevent eavesdropping
ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallets;
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallet_requests;
