-- Pontregiszter v0.9.64: a versenyző saját bejegyzései — kedvenc versenyem, legjobb
-- versenyélményem, kedvenc szerem / elemem, célom (Sándor 2026.10.06).
-- Írja: a versenyző maga vagy a szülője (ugyanaz a szabály, mint az edzés-önrögzítésnél:
-- can_report_training_for), valamint az edzők; olvassa: minden bejelentkezett klubtag.
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.competitor_stories (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  kind          text not null check (kind in ('kedvenc_verseny','legjobb_elmeny','kedvenc_szer','kedvenc_elem','cel')),
  body          text not null check (char_length(btrim(body)) between 1 and 500),
  year          int  not null default extract(year from now())::int,
  achieved      boolean not null default false,   -- célnál: „Elértem!”
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists competitor_stories_competitor_idx on public.competitor_stories (competitor_id, year);

alter table public.competitor_stories enable row level security;

drop policy if exists competitor_stories_read on public.competitor_stories;
create policy competitor_stories_read on public.competitor_stories
  for select to authenticated using (true);

drop policy if exists competitor_stories_write on public.competitor_stories;
create policy competitor_stories_write on public.competitor_stories
  for all to authenticated
  using (public.can_report_training_for(competitor_id)
         or current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (public.can_report_training_for(competitor_id)
              or current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

grant select, insert, update, delete on public.competitor_stories to authenticated;
revoke all on public.competitor_stories from anon;
