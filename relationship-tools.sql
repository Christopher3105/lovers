-- Lovers: shared notes and personal saved/pinned messages
-- Run after the core Lovers database setup and relationship-space.sql.

create table if not exists public.relationship_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null default '' check (char_length(content) <= 12000),
  created_by uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  updated_by uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relationship_notes_updated_idx
  on public.relationship_notes(updated_at desc);

alter table public.relationship_notes enable row level security;
drop policy if exists "Relationship members can read shared notes" on public.relationship_notes;
create policy "Relationship members can read shared notes"
  on public.relationship_notes for select to authenticated
  using (exists (
    select 1 from public.relationship_members m
    where m.user_id = (select auth.uid())
  ));
drop policy if exists "Relationship members can create shared notes" on public.relationship_notes;
create policy "Relationship members can create shared notes"
  on public.relationship_notes for insert to authenticated
  with check (
    created_by = (select auth.uid()) and updated_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );
drop policy if exists "Relationship members can edit shared notes" on public.relationship_notes;
create policy "Relationship members can edit shared notes"
  on public.relationship_notes for update to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())))
  with check (
    updated_by = (select auth.uid())
    and exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid()))
  );
drop policy if exists "Relationship members can delete shared notes" on public.relationship_notes;
create policy "Relationship members can delete shared notes"
  on public.relationship_notes for delete to authenticated
  using (exists (select 1 from public.relationship_members m where m.user_id = (select auth.uid())));
grant select, insert, update, delete on public.relationship_notes to authenticated;

create table if not exists public.relationship_saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message_id bigint not null references public.messages(id) on delete cascade,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists relationship_saved_messages_user_pin_idx
  on public.relationship_saved_messages(user_id, pinned desc, created_at desc);

alter table public.relationship_saved_messages enable row level security;
drop policy if exists "Users can read their own saved messages" on public.relationship_saved_messages;
create policy "Users can read their own saved messages"
  on public.relationship_saved_messages for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can save messages from their conversations" on public.relationship_saved_messages;
create policy "Users can save messages from their conversations"
  on public.relationship_saved_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages msg
      where msg.id = message_id
        and (msg.sender_id = (select auth.uid()) or msg.receiver_id = (select auth.uid()))
    )
  );
drop policy if exists "Users can pin their own saved messages" on public.relationship_saved_messages;
create policy "Users can pin their own saved messages"
  on public.relationship_saved_messages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can remove their own saved messages" on public.relationship_saved_messages;
create policy "Users can remove their own saved messages"
  on public.relationship_saved_messages for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.relationship_saved_messages to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='relationship_notes') then
    alter publication supabase_realtime add table public.relationship_notes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='relationship_saved_messages') then
    alter publication supabase_realtime add table public.relationship_saved_messages;
  end if;
end $$;
