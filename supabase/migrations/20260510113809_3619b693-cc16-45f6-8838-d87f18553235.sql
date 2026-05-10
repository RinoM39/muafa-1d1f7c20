
-- Medical reports table
CREATE TABLE public.medical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  file_url text NOT NULL,
  file_path text NOT NULL,
  doctor_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;

-- Helper: can the current user access a given booking's report?
CREATE OR REPLACE FUNCTION public.can_access_booking_report(_booking_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.facilities f ON f.id = b.facility_id
    WHERE b.id = _booking_id
      AND (b.user_id = _user_id OR f.owner_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_facility_owner_for_booking(_booking_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.facilities f ON f.id = b.facility_id
    WHERE b.id = _booking_id
      AND f.owner_id = _user_id
  );
$$;

-- RLS: patient or facility owner can read
CREATE POLICY "reports_read_patient_or_owner"
ON public.medical_reports FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_facility_owner_for_booking(booking_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Only facility owner can insert / update
CREATE POLICY "reports_insert_owner"
ON public.medical_reports FOR INSERT
WITH CHECK (public.is_facility_owner_for_booking(booking_id, auth.uid()));

CREATE POLICY "reports_update_owner"
ON public.medical_reports FOR UPDATE
USING (public.is_facility_owner_for_booking(booking_id, auth.uid()));

CREATE TRIGGER trg_medical_reports_updated_at
BEFORE UPDATE ON public.medical_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies for medical-reports bucket (path = {booking_id}/filename)
CREATE POLICY "medical_reports_storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-reports'
  AND public.can_access_booking_report(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);

CREATE POLICY "medical_reports_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-reports'
  AND public.is_facility_owner_for_booking(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);

CREATE POLICY "medical_reports_storage_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'medical-reports'
  AND public.is_facility_owner_for_booking(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);
