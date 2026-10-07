-- Pontregiszter v0.9.71: az Áttekintés „Szülő fiókok” száma mindenkinek helyes legyen.
-- A versenyző és a szülő a profilokat nem olvashatja (helyesen), ezért eddig 0-t látott.
-- Ez a függvény csak egy SZÁMOT ad vissza (nevet, e-mailt nem), bejelentkezett felhasználónak.
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható; adatot nem módosít.

create or replace function public.count_parent_accounts() returns integer
language sql stable security definer set search_path = public as $f$
  select count(*)::int from profiles where role in ('szulo', 'szulo_admin')
$f$;

revoke all on function public.count_parent_accounts() from public, anon;
grant execute on function public.count_parent_accounts() to authenticated;
