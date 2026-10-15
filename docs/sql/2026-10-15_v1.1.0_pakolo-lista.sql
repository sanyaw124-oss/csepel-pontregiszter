-- Pontregiszter v1.1.0: versenyre készülés — pipálható pakolólista (Sándor 2026.10.15)
--   Versenyenként és gyerekenként egy lista: a kipipált tételek + a saját, hozzáadott tételek.
--   A gyerek és a szülője látja és pipálja (közös lista: amit az egyik kipipál, a másik is látja).
--   Az edzők olvashatják.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.packing_lists (
  competitor_id  uuid not null references public.competitors(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  checked        text[] not null default '{}',
  extra          text[] not null default '{}' check (cardinality(extra) <= 15),
  updated_at     timestamptz not null default now(),
  primary key (competitor_id, competition_id)
);

alter table public.packing_lists enable row level security;
drop policy if exists packing_lists_read on public.packing_lists;
create policy packing_lists_read on public.packing_lists for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists packing_lists_write on public.packing_lists;
create policy packing_lists_write on public.packing_lists for all to authenticated
  using (public.can_report_training_for(competitor_id))
  with check (public.can_report_training_for(competitor_id));
grant select, insert, update, delete on public.packing_lists to authenticated;
revoke all on public.packing_lists from anon;
