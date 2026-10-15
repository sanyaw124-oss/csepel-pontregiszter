-- Pontregiszter v1.1.0: versenyre készülés — pipálható pakolólista (Sándor 2026.10.15)
--   packing_lists: versenyenként és gyerekenként a kipipált tételek (minden versenyre új, üres lista).
--   competitor_packing_items: a gyerek SAJÁT tételei — a gyerekhez mentve, minden versenyre megjelennek.
--   A gyerek és a szülője látja és pipálja (közös lista). Az edzők olvashatják.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.packing_lists (
  competitor_id  uuid not null references public.competitors(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  checked        text[] not null default '{}',
  extra          text[] not null default '{}' check (cardinality(extra) <= 15),   -- (nem használt)
  updated_at     timestamptz not null default now(),
  primary key (competitor_id, competition_id)
);

create table if not exists public.competitor_packing_items (
  competitor_id uuid primary key references public.competitors(id) on delete cascade,
  items         text[] not null default '{}' check (cardinality(items) <= 20),
  updated_at    timestamptz not null default now()
);

alter table public.packing_lists enable row level security;
alter table public.competitor_packing_items enable row level security;

drop policy if exists packing_lists_read on public.packing_lists;
create policy packing_lists_read on public.packing_lists for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists packing_lists_write on public.packing_lists;
create policy packing_lists_write on public.packing_lists for all to authenticated
  using (public.can_report_training_for(competitor_id))
  with check (public.can_report_training_for(competitor_id));

drop policy if exists competitor_packing_items_read on public.competitor_packing_items;
create policy competitor_packing_items_read on public.competitor_packing_items for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists competitor_packing_items_write on public.competitor_packing_items;
create policy competitor_packing_items_write on public.competitor_packing_items for all to authenticated
  using (public.can_report_training_for(competitor_id))
  with check (public.can_report_training_for(competitor_id));

grant select, insert, update, delete on public.packing_lists, public.competitor_packing_items to authenticated;
revoke all on public.packing_lists, public.competitor_packing_items from anon;
