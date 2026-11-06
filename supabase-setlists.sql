-- Execute este arquivo no SQL Editor do Supabase depois de atualizar o app.
-- A chave secret/service_role nunca deve aparecer no navegador.

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
