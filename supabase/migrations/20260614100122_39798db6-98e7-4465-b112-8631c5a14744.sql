REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_booking_report(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_facility_owner_for_booking(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_primary_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_booking_report(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_facility_owner_for_booking(uuid, uuid) TO service_role;