
-- 1. Drop overly permissive realtime.messages policy.
-- postgres_changes still filters via source table (bookings) RLS, which already
-- scopes rows to the patient, facility owner, or admin.
DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;

-- 2. Restrict which columns facility owners may modify on bookings.
CREATE OR REPLACE FUNCTION public.enforce_facility_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass column-level restrictions
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Patients updating their own booking also bypass (covered by other policies)
  IF OLD.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Facility owners: only allow safe columns to change
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.slot_start IS DISTINCT FROM OLD.slot_start
     OR NEW.slot_end IS DISTINCT FROM OLD.slot_end
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Facility owners may only update status, report_url, ended_at, or reminder_sent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_facility_booking_update ON public.bookings;
CREATE TRIGGER trg_enforce_facility_booking_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_facility_booking_update();

-- Also harden the policy with an explicit WITH CHECK matching USING
DROP POLICY IF EXISTS bookings_facility_update ON public.bookings;
CREATE POLICY bookings_facility_update
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
);
