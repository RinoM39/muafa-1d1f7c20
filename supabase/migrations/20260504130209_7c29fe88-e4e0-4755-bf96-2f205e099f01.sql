
-- Re-create functions with explicit search_path (some Postgres versions don't keep SET clause from CREATE OR REPLACE on existing fns)
alter function public.handle_new_user() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.recompute_facility_rating() set search_path = public;
alter function public.has_role(uuid, public.app_role) set search_path = public;
alter function public.get_primary_role(uuid) set search_path = public;

-- Make facility-images bucket non-public (we will use signed URLs in app code)
update storage.buckets set public = false where id = 'facility-images';
