-- Pontregiszter v0.9.67: edzői értékelés (Sándor 2026.10.06) — az edző a Statisztika
-- menüben, az évösszefoglaló (PDF) előtt értékelést ír a gyereknek; mentve a gyerekhez
-- (évenként egy), a szülő és a gyerek is látja, és a PDF-be is bekerül.
-- Írja: Admin, Szülő-admin, Vezetőedző, Edző. Olvassa: az edzők + a versenyző maga + a szülője.
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.competitor_evaluations (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  year          int  not null,
  body          text not null check (char_length(btrim(body)) between 1 and 4000),
  updated_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (competitor_id, year)
);

alter table public.competitor_evaluations enable row level security;

drop policy if exists competitor_evaluations_read on public.competitor_evaluations;
create policy competitor_evaluations_read on public.competitor_evaluations
  for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));

drop policy if exists competitor_evaluations_write on public.competitor_evaluations;
create policy competitor_evaluations_write on public.competitor_evaluations
  for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

grant select, insert, update, delete on public.competitor_evaluations to authenticated;
revoke all on public.competitor_evaluations from anon;
