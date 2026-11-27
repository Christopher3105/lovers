-- Lovers: shared calendar, private photo gallery, and shared to-do list.
-- Optimized lookup for unread incoming chat messages used by the Realtime recovery fallback.
create index if not exists messages_unread_inbox_idx
  on public.messages (receiver_id, id asc)
  where read_at is null and deleted_at is null;


-- This script is idempotent and has already been applied to the connected Supabase project.

-- Private allow-list: only these two existing profiles can access the shared space.
create table if not exists public.relationship_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.relationship_members enable row level security;
drop policy if exists "Users can see their own relationship membership" on public.relationship_members;
create policy "Users can see their own relationship membership"
  on public.relationship_members for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.relationship_members to authenticated;

do $
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'Expected exactly two existing profiles before seeding relationship members.';
  end if;
  insert into public.relationship_members (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;
end $;

create table if not exists public.relationship_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '',
  event_date date not null,
  color text not null default '#ff2a9d' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  repeat_yearly boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists relationship_events_title_date_uidx
  on public.relationship_events (title, event_date);
create index if not exists relationship_events_date_idx
  on public.relationship_events (event_date);
create index if not exists relationship_events_created_by_idx
  on public.relationship_events (created_by);

create table if not exists public.relationship_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  done boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists relationship_tasks_created_idx
  on public.relationship_tasks (done, created_at desc);
create index if not exists relationship_tasks_created_by_idx
  on public.relationship_tasks (created_by);

create table if not exists public.relationship_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 180),
  photo_date date not null default current_date,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists relationship_photos_date_idx
  on public.relationship_photos (photo_date desc, created_at desc);
create index if not exists relationship_photos_uploaded_by_idx
  on public.relationship_photos (uploaded_by);

alter table public.relationship_photos
  add column if not exists source_message_id bigint
  references public.messages(id) on delete set null;
create unique index if not exists relationship_photos_source_message_uidx
  on public.relationship_photos(source_message_id)
  where source_message_id is not null;

alter table public.relationship_events enable row level security;
alter table public.relationship_tasks enable row level security;
alter table public.relationship_photos enable row level security;

drop policy if exists "Couple members can read relationship events" on public.relationship_events;
create policy "Couple members can read relationship events"
  on public.relationship_events for select to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can add relationship events" on public.relationship_events;
create policy "Couple members can add relationship events"
  on public.relationship_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Couple members can update relationship events" on public.relationship_events;
create policy "Couple members can update relationship events"
  on public.relationship_events for update to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can delete relationship events" on public.relationship_events;
create policy "Couple members can delete relationship events"
  on public.relationship_events for delete to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can read shared tasks" on public.relationship_tasks;
create policy "Couple members can read shared tasks"
  on public.relationship_tasks for select to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can add shared tasks" on public.relationship_tasks;
create policy "Couple members can add shared tasks"
  on public.relationship_tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Couple members can update shared tasks" on public.relationship_tasks;
create policy "Couple members can update shared tasks"
  on public.relationship_tasks for update to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can delete shared tasks" on public.relationship_tasks;
create policy "Couple members can delete shared tasks"
  on public.relationship_tasks for delete to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Couple members can read shared gallery" on public.relationship_photos;
create policy "Couple members can read shared gallery"
  on public.relationship_photos for select to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Users add their own gallery metadata" on public.relationship_photos;
create policy "Users add their own gallery metadata"
  on public.relationship_photos for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Users remove their own gallery metadata" on public.relationship_photos;
create policy "Users remove their own gallery metadata"
  on public.relationship_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()));

drop policy if exists "Users can edit their own gallery captions" on public.relationship_photos;
create policy "Users can edit their own gallery captions"
  on public.relationship_photos for update to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.relationship_members m
      where m.user_id = (select auth.uid())
    )
  )
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.relationship_members m
      where m.user_id = (select auth.uid())
    )
  );


-- Timeline milestones, shared date ideas, and personal daily check-ins.

create table if not exists public.relationship_timeline_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  milestone_date date not null,
  color text not null default '#ff168f' check (color ~ '^#[0-9A-Fa-f]{6}
grant select, insert, update, delete on public.relationship_events to authenticated;
grant select, insert, update, delete on public.relationship_tasks to authenticated;
grant select, insert, delete on public.relationship_photos to authenticated;
grant update (caption) on public.relationship_photos to authenticated;
grant select, insert, delete on public.relationship_voice_records to authenticated;
grant select, insert, delete on public.relationship_timeline_entries to authenticated;
grant select, insert, delete on public.relationship_date_ideas to authenticated;
grant update (last_picked_at) on public.relationship_date_ideas to authenticated;
grant select, insert, update, delete on public.relationship_daily_checkins to authenticated;

insert into public.relationship_events
  (title, description, event_date, color, repeat_yearly, created_by)
values
  ('My husband''s birthday', 'A day to celebrate him.', date '2000-03-05', '#1677ff', true, null),
  ('My wife''s birthday', 'A day to celebrate her.', date '2000-03-19', '#ff2a9d', true, null)
on conflict (title, event_date) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relationship-gallery',
  'relationship-gallery',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couple members can view gallery objects" on storage.objects;
create policy "Couple members can view gallery objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Users upload their own gallery objects" on storage.objects;
create policy "Users upload their own gallery objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'relationship-gallery'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Users delete their own gallery objects" on storage.objects;
create policy "Users delete their own gallery objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and owner_id = (select auth.uid())::text
  );


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relationship-voice',
  'relationship-voice',
  false,
  20971520,
  array[
    'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac',
    'audio/x-m4a','audio/wav','audio/x-wav','audio/flac'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Relationship members can read voice files" on storage.objects;
create policy "Relationship members can read voice files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'relationship-voice'
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Relationship members can upload their voice files" on storage.objects;
create policy "Relationship members can upload their voice files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'relationship-voice'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Members can delete their own voice files" on storage.objects;
create policy "Members can delete their own voice files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'relationship-voice'
    and owner_id = (select auth.uid())::text
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

do $
declare
  tbl text;
begin
  foreach tbl in array array[
    'relationship_events',
    'relationship_tasks',
    'relationship_photos',
    'relationship_timeline_entries',
    'relationship_date_ideas',
    'relationship_daily_checkins',
    'relationship_voice_records'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists relationship_timeline_date_idx
  on public.relationship_timeline_entries (milestone_date desc, created_at desc);
create index if not exists relationship_timeline_creator_idx
  on public.relationship_timeline_entries (created_by);

create table if not exists public.relationship_date_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  category text not null default 'Anything' check (char_length(category) <= 32),
  last_picked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists relationship_date_ideas_pick_idx
  on public.relationship_date_ideas (last_picked_at nulls first, created_at);

create table if not exists public.relationship_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  checkin_date date not null default current_date,
  mood text not null check (mood in ('great','good','okay','tired','quiet')),
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);
create index if not exists relationship_daily_checkins_date_idx
  on public.relationship_daily_checkins (checkin_date desc, updated_at desc);
create index if not exists relationship_daily_checkins_user_idx
  on public.relationship_daily_checkins (user_id);

alter table public.relationship_timeline_entries enable row level security;
alter table public.relationship_date_ideas enable row level security;
alter table public.relationship_daily_checkins enable row level security;

drop policy if exists "Relationship members can read timeline entries" on public.relationship_timeline_entries;
create policy "Relationship members can read timeline entries"
  on public.relationship_timeline_entries for select to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));

drop policy if exists "Members can add their own timeline entries" on public.relationship_timeline_entries;
create policy "Members can add their own timeline entries"
  on public.relationship_timeline_entries for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Members can delete their own timeline entries" on public.relationship_timeline_entries;
create policy "Members can delete their own timeline entries"
  on public.relationship_timeline_entries for delete to authenticated
  using (
    created_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Relationship members can read date ideas" on public.relationship_date_ideas;
create policy "Relationship members can read date ideas"
  on public.relationship_date_ideas for select to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));

drop policy if exists "Members can add date ideas" on public.relationship_date_ideas;
create policy "Members can add date ideas"
  on public.relationship_date_ideas for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Relationship members can mark date ideas picked" on public.relationship_date_ideas;
create policy "Relationship members can mark date ideas picked"
  on public.relationship_date_ideas for update to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));

drop policy if exists "Members can delete their own date ideas" on public.relationship_date_ideas;
drop policy if exists "Members can remove shared date ideas" on public.relationship_date_ideas;
create policy "Members can remove shared date ideas"
  on public.relationship_date_ideas for delete to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Relationship members can read daily check-ins" on public.relationship_daily_checkins;
create policy "Relationship members can read daily check-ins"
  on public.relationship_daily_checkins for select to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));

drop policy if exists "Users can add their own daily check-in" on public.relationship_daily_checkins;
create policy "Users can add their own daily check-in"
  on public.relationship_daily_checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Users can update their own daily check-in" on public.relationship_daily_checkins;
create policy "Users can update their own daily check-in"
  on public.relationship_daily_checkins for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Users can delete their own daily check-in" on public.relationship_daily_checkins;
create policy "Users can delete their own daily check-in"
  on public.relationship_daily_checkins for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

grant select, insert, delete on public.relationship_timeline_entries to authenticated;
grant select, insert, delete on public.relationship_date_ideas to authenticated;
grant update (last_picked_at) on public.relationship_date_ideas to authenticated;
grant select, insert, update, delete on public.relationship_daily_checkins to authenticated;

insert into public.relationship_date_ideas (title, description, category)
values
  ('Movie night at home', 'Pick a film, make a cosy snack, and rate it together.', 'At home'),
  ('Make a shared playlist', 'Choose songs for a playlist and explain why each one made the list.', 'Creative'),
  ('Photo walk', 'Take turns choosing little details to photograph on a walk in a familiar public place.', 'Outdoors'),
  ('Try a new recipe', 'Choose a simple recipe and make it together.', 'Food'),
  ('Board-game evening', 'Pick a favourite game or learn a new one together.', 'Games'),
  ('Draw each other as cartoons', 'Make funny little portraits and save them in the gallery.', 'Creative'),
  ('Build a blanket-fort cinema', 'Set up a comfortable movie corner and choose a double feature.', 'At home'),
  ('Plan a future day trip', 'Make a list of places you would like to visit with the right arrangements.', 'Planning'),
  ('Blind snack tasting', 'Choose a few familiar snacks and guess each one with your eyes open.', 'Food'),
  ('Memory-lane evening', 'Look through your gallery and choose a favourite memory each.', 'At home')
on conflict (title) do nothing;


-- Private voice-message library and source-message links for saved chat media.
create table if not exists public.relationship_voice_records (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  voice_date date not null default current_date,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  uploaded_by uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  source_message_id bigint unique
    references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists relationship_voice_date_idx
  on public.relationship_voice_records(voice_date desc, created_at desc);
create index if not exists relationship_voice_uploader_idx
  on public.relationship_voice_records(uploaded_by);
alter table public.relationship_voice_records enable row level security;

drop policy if exists "Relationship members can read voice library" on public.relationship_voice_records;
create policy "Relationship members can read voice library"
  on public.relationship_voice_records for select to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));

drop policy if exists "Members can add their own voice records" on public.relationship_voice_records;
create policy "Members can add their own voice records"
  on public.relationship_voice_records for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "Members can delete their own voice records" on public.relationship_voice_records;
create policy "Members can delete their own voice records"
  on public.relationship_voice_records for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.relationship_events to authenticated;
grant select, insert, update, delete on public.relationship_tasks to authenticated;
grant select, insert, delete on public.relationship_photos to authenticated;

insert into public.relationship_events
  (title, description, event_date, color, repeat_yearly, created_by)
values
  ('My husband''s birthday', 'A day to celebrate him.', date '2000-03-05', '#1677ff', true, null),
  ('My wife''s birthday', 'A day to celebrate her.', date '2000-03-19', '#ff2a9d', true, null)
on conflict (title, event_date) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relationship-gallery',
  'relationship-gallery',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couple members can view gallery objects" on storage.objects;
create policy "Couple members can view gallery objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Users upload their own gallery objects" on storage.objects;
create policy "Users upload their own gallery objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'relationship-gallery'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  )
  );

drop policy if exists "Users delete their own gallery objects" on storage.objects;
create policy "Users delete their own gallery objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and owner_id = (select auth.uid())::text
  );

do $$
declare
  tbl text;
begin
  foreach tbl in array array['relationship_events','relationship_tasks','relationship_photos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
