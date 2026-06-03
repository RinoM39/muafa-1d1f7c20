
-- 1. Remove buggy duplicate medical-reports storage policies (path extraction bug)
DROP POLICY IF EXISTS medical_reports_read_participant ON storage.objects;
DROP POLICY IF EXISTS medical_reports_facility_write ON storage.objects;
DROP POLICY IF EXISTS medical_reports_facility_update ON storage.objects;

-- 2. Add explicit DELETE policy for medical-reports bucket
CREATE POLICY medical_reports_storage_delete
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'medical-reports'
  AND (
    public.is_facility_owner_for_booking(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 3. Tighten bookings_user_insert: require facility active + not banned
DROP POLICY IF EXISTS bookings_user_insert ON public.bookings;
CREATE POLICY bookings_user_insert
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'upcoming'::booking_status
  AND price = (
    SELECT f.price FROM public.facilities f
    WHERE f.id = bookings.facility_id
      AND f.is_active = true
      AND f.is_banned = false
  )
);

-- 4. Enable RLS on realtime.messages and require authenticated subscribers
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;
CREATE POLICY realtime_authenticated_only
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
