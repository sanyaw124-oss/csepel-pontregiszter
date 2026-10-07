-- Pontregiszter v0.9.70: új verseny-besorolás: MRGSZ Magyar Kupa (külön az MB-től)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.
-- Meglévő adatot nem módosít; csak a megengedett értékek listája bővül.

alter table public.competitions drop constraint if exists competitions_importance_check;
alter table public.competitions add constraint competitions_importance_check
  check (importance = any (array['fig','nemzetkozi','mrgsz_mb','mrgsz_kupa','mrgsz_reg','diakolimpia','klub','egyeb']));
