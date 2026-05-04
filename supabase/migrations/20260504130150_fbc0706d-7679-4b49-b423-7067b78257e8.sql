
-- Lock down execution on internal helpers
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.recompute_facility_rating() from public, anon, authenticated;
revoke execute on function public.get_primary_role(uuid) from public, anon;

-- Replace storage policies with tighter scoping
drop policy if exists "facility_images_public_read" on storage.objects;
drop policy if exists "facility_images_owner_write" on storage.objects;
drop policy if exists "facility_images_owner_update" on storage.objects;
drop policy if exists "facility_images_owner_delete" on storage.objects;
drop policy if exists "medical_reports_owner_write" on storage.objects;
drop policy if exists "medical_reports_owner_update" on storage.objects;
drop policy if exists "medical_reports_authenticated_read" on storage.objects;

-- Facility images: anyone can read individual files (URLs are unguessable UUIDs);
-- only authenticated facility owners can write.
create policy "facility_images_read_individual"
  on storage.objects for select
  using (bucket_id = 'facility-images');

create policy "facility_images_facility_write"
  on storage.objects for insert
  with check (
    bucket_id = 'facility-images'
    and auth.uid() is not null
    and public.has_role(auth.uid(), 'facility')
  );

create policy "facility_images_owner_modify"
  on storage.objects for update
  using (bucket_id = 'facility-images' and owner = auth.uid());

create policy "facility_images_owner_remove"
  on storage.objects for delete
  using (bucket_id = 'facility-images' and owner = auth.uid());

-- Medical reports: file path convention is "<booking_id>/<filename>".
-- Read: the user who made the booking OR the facility owner OR an admin.
-- Write: only the facility owner of that booking.
create policy "medical_reports_read_participant"
  on storage.objects for select
  using (
    bucket_id = 'medical-reports'
    and auth.uid() is not null
    and exists (
      select 1 from public.bookings b
      left join public.facilities f on f.id = b.facility_id
      where b.id::text = (storage.foldername(name))[1]
        and (b.user_id = auth.uid() or f.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

create policy "medical_reports_facility_write"
  on storage.objects for insert
  with check (
    bucket_id = 'medical-reports'
    and auth.uid() is not null
    and exists (
      select 1 from public.bookings b
      join public.facilities f on f.id = b.facility_id
      where b.id::text = (storage.foldername(name))[1]
        and f.owner_id = auth.uid()
    )
  );

create policy "medical_reports_facility_update"
  on storage.objects for update
  using (bucket_id = 'medical-reports' and owner = auth.uid());
