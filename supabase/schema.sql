-- Execute este arquivo no SQL Editor do projeto Supabase.
-- A chave secret/service_role nunca deve aparecer no navegador.

create table if not exists public.songs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  artist text not null default '',
  key text not null default '',
  body text not null,
  structure jsonb,
  semi integer not null default 0,
  pref text not null default 'auto' check (pref in ('auto', 'sharp', 'flat')),
  pdf_path text,
  created_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  primary key (user_id, id)
);

alter table public.songs add column if not exists pdf_path text;
alter table public.songs add column if not exists structure jsonb;

create index if not exists songs_user_id_idx on public.songs using btree (user_id);

create table if not exists public.setlists (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  deleted boolean not null default false,
  created_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  primary key (user_id, id)
);

create index if not exists setlists_user_id_idx on public.setlists using btree (user_id);

alter table public.songs enable row level security;

revoke all on table public.songs from anon;
grant select, insert, update, delete on table public.songs to authenticated;

drop policy if exists "Users can read their own songs" on public.songs;
create policy "Users can read their own songs"
  on public.songs for select to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('song-pdfs', 'song-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own song PDFs" on storage.objects;
create policy "Users can read their own song PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'song-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their own song PDFs" on storage.objects;
create policy "Users can upload their own song PDFs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'song-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own song PDFs" on storage.objects;
create policy "Users can update their own song PDFs"
  on storage.objects for update to authenticated
  using (bucket_id = 'song-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'song-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own song PDFs" on storage.objects;
create policy "Users can delete their own song PDFs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'song-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can create their own songs" on public.songs;
create policy "Users can create their own songs"
  on public.songs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own songs" on public.songs;
create policy "Users can update their own songs"
  on public.songs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own songs" on public.songs;
create policy "Users can delete their own songs"
  on public.songs for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.setlists enable row level security;

revoke all on table public.setlists from anon;
grant select, insert, update, delete on table public.setlists to authenticated;

drop policy if exists "Users can read their own setlists" on public.setlists;
create policy "Users can read their own setlists"
  on public.setlists for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own setlists" on public.setlists;
create policy "Users can create their own setlists"
  on public.setlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own setlists" on public.setlists;
create policy "Users can update their own setlists"
  on public.setlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own setlists" on public.setlists;
create policy "Users can delete their own setlists"
  on public.setlists for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Atualiza o cache de esquema do PostgREST para o app enxergar as mudanças na hora.
notify pgrst, 'reload schema';
