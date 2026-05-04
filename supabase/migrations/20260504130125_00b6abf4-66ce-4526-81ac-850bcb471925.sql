
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('user', 'facility', 'admin');
create type public.booking_status as enum ('upcoming', 'completed', 'cancelled');
create type public.wallet_tx_type as enum ('topup', 'hold', 'release', 'refund', 'payout');
create type public.wallet_tx_status as enum ('pending', 'completed', 'cancelled');
create type public.wallet_request_status as enum ('pending', 'approved', 'rejected');
create type public.rating_direction as enum ('user_to_facility', 'facility_to_user');

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  locale text not null default 'ar',
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========================================================
-- USER ROLES (security-critical: separate table)
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create or replace function public.get_primary_role(_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = _user_id
  order by case role when 'admin' then 0 when 'facility' then 1 else 2 end
  limit 1
$$;

-- =========================================================
-- FACILITIES
-- =========================================================
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  location_url text,
  phone text,
  price numeric(10,2) not null check (price >= 0),
  session_duration_min integer not null check (session_duration_min between 5 and 480),
  start_time time not null,
  end_time time not null,
  working_days integer[] not null default '{0,1,2,3,4,5,6}',
  is_active boolean not null default true,
  is_banned boolean not null default false,
  avg_rating numeric(3,2) not null default 0,
  ratings_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.facilities enable row level security;
create index facilities_owner_id_idx on public.facilities(owner_id);
create index facilities_active_idx on public.facilities(is_active, is_banned);

-- =========================================================
-- BOOKINGS
-- =========================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status public.booking_status not null default 'upcoming',
  price numeric(10,2) not null,
  report_url text,
  reminder_sent boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (facility_id, slot_start)
);
alter table public.bookings enable row level security;
create index bookings_user_idx on public.bookings(user_id);
create index bookings_facility_idx on public.bookings(facility_id);
create index bookings_slot_idx on public.bookings(slot_start);

-- =========================================================
-- WALLETS
-- =========================================================
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  pending numeric(12,2) not null default 0 check (pending >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  amount numeric(12,2) not null,
  type public.wallet_tx_type not null,
  status public.wallet_tx_status not null default 'completed',
  note text,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create index wallet_tx_user_idx on public.wallet_transactions(user_id);

create table public.wallet_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status public.wallet_request_status not null default 'pending',
  note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.wallet_requests enable row level security;

-- =========================================================
-- RATINGS
-- =========================================================
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  ratee_id uuid not null references auth.users(id) on delete cascade,
  direction public.rating_direction not null,
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, direction)
);
alter table public.ratings enable row level security;

-- =========================================================
-- PUSH SUBSCRIPTIONS + NOTIFICATIONS
-- =========================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications(user_id, read);

-- =========================================================
-- RLS POLICIES
-- =========================================================
-- profiles
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_admin_update" on public.profiles
  for update using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "roles_select_self_or_admin" on public.user_roles
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "roles_admin_all" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- facilities
create policy "facilities_public_read_active" on public.facilities
  for select using (is_active and not is_banned);
create policy "facilities_owner_read" on public.facilities
  for select using (auth.uid() = owner_id);
create policy "facilities_admin_read" on public.facilities
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "facilities_owner_insert" on public.facilities
  for insert with check (auth.uid() = owner_id and public.has_role(auth.uid(), 'facility'));
create policy "facilities_owner_update" on public.facilities
  for update using (auth.uid() = owner_id);
create policy "facilities_admin_update" on public.facilities
  for update using (public.has_role(auth.uid(), 'admin'));
create policy "facilities_admin_delete" on public.facilities
  for delete using (public.has_role(auth.uid(), 'admin'));

-- bookings
create policy "bookings_user_read" on public.bookings
  for select using (auth.uid() = user_id);
create policy "bookings_facility_read" on public.bookings
  for select using (exists (select 1 from public.facilities f where f.id = facility_id and f.owner_id = auth.uid()));
create policy "bookings_admin_read" on public.bookings
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "bookings_user_insert" on public.bookings
  for insert with check (auth.uid() = user_id);
create policy "bookings_facility_update" on public.bookings
  for update using (exists (select 1 from public.facilities f where f.id = facility_id and f.owner_id = auth.uid()));
create policy "bookings_admin_all" on public.bookings
  for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- wallets
create policy "wallets_select_self" on public.wallets
  for select using (auth.uid() = user_id);
create policy "wallets_admin_select" on public.wallets
  for select using (public.has_role(auth.uid(), 'admin'));
-- writes only via server functions (service role)

-- wallet_transactions
create policy "wallet_tx_select_self" on public.wallet_transactions
  for select using (auth.uid() = user_id);
create policy "wallet_tx_admin_select" on public.wallet_transactions
  for select using (public.has_role(auth.uid(), 'admin'));

-- wallet_requests
create policy "wallet_req_select_self_or_admin" on public.wallet_requests
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "wallet_req_insert_self" on public.wallet_requests
  for insert with check (auth.uid() = user_id);
create policy "wallet_req_admin_update" on public.wallet_requests
  for update using (public.has_role(auth.uid(), 'admin'));

-- ratings
create policy "ratings_public_read" on public.ratings for select using (true);
create policy "ratings_insert_self" on public.ratings
  for insert with check (auth.uid() = rater_id);

-- push_subscriptions
create policy "push_self_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notifications
create policy "notif_self_select" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notif_self_update" on public.notifications
  for update using (auth.uid() = user_id);

-- =========================================================
-- TRIGGERS
-- =========================================================
-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger facilities_touch before update on public.facilities
  for each row execute function public.touch_updated_at();
create trigger wallets_touch before update on public.wallets
  for each row execute function public.touch_updated_at();

-- on signup: create profile, wallet, default 'user' role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role public.app_role;
begin
  desired_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'user');

  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');

  insert into public.wallets (user_id) values (new.id);

  insert into public.user_roles (user_id, role) values (new.id, desired_role);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- recompute facility avg rating after a user_to_facility rating
create or replace function public.recompute_facility_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if new.direction <> 'user_to_facility' then return new; end if;
  select b.facility_id into fid from public.bookings b where b.id = new.booking_id;
  update public.facilities set
    avg_rating = coalesce((select round(avg(r.stars)::numeric, 2)
                           from public.ratings r
                           join public.bookings b on b.id = r.booking_id
                           where b.facility_id = fid and r.direction = 'user_to_facility'), 0),
    ratings_count = (select count(*) from public.ratings r
                     join public.bookings b on b.id = r.booking_id
                     where b.facility_id = fid and r.direction = 'user_to_facility')
  where id = fid;
  return new;
end $$;

create trigger ratings_recompute
  after insert on public.ratings
  for each row execute function public.recompute_facility_rating();

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
insert into storage.buckets (id, name, public)
values ('facility-images', 'facility-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('medical-reports', 'medical-reports', false)
on conflict (id) do nothing;

-- facility-images: public read, owner write
create policy "facility_images_public_read"
  on storage.objects for select using (bucket_id = 'facility-images');
create policy "facility_images_owner_write"
  on storage.objects for insert with check (
    bucket_id = 'facility-images' and auth.uid() is not null
  );
create policy "facility_images_owner_update"
  on storage.objects for update using (
    bucket_id = 'facility-images' and owner = auth.uid()
  );
create policy "facility_images_owner_delete"
  on storage.objects for delete using (
    bucket_id = 'facility-images' and owner = auth.uid()
  );

-- medical-reports: facility owner of related booking can write; user of booking can read
create policy "medical_reports_owner_write"
  on storage.objects for insert with check (
    bucket_id = 'medical-reports' and auth.uid() is not null
  );
create policy "medical_reports_owner_update"
  on storage.objects for update using (
    bucket_id = 'medical-reports' and owner = auth.uid()
  );
create policy "medical_reports_authenticated_read"
  on storage.objects for select using (
    bucket_id = 'medical-reports' and auth.uid() is not null
  );
