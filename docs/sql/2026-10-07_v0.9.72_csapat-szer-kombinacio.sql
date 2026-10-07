-- Pontregiszter v0.9.72: csapat (EKCS) startlista-során több szer is megadható
-- (pl. 'karika+labda' — „3 karika + 2 labda”). Eddig az adatbázis csak egy szert engedett,
-- ezért a csapattagok / szerek mentése hibára futott (startlist_entries_apparatus_check).
-- Új szabály: üres, vagy '+'-szal elválasztott szerek, mindegyik az engedélyezettek közül.
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható; meglévő adatot nem módosít
-- (a meglévő sorok egyszeres szerei az új szabálynak is megfelelnek).

alter table public.startlist_entries drop constraint if exists startlist_entries_apparatus_check;
alter table public.startlist_entries add constraint startlist_entries_apparatus_check
  check (apparatus is null
         or string_to_array(apparatus, '+') <@ array['szabad','karika','labda','buzogany','szalag','kotel']);
