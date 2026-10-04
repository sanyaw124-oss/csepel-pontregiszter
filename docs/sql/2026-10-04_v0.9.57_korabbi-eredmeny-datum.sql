-- Pontregiszter v0.9.57: korábbi eredmény pontos dátuma (a fejlődési grafikonhoz)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.
-- Meglévő adatot nem módosít: a régi bejegyzéseknél a dátum üres marad (csak az év ismert),
-- a grafikon ezeket továbbra is január 1-re teszi, amíg dátumot nem kapnak.

alter table public.historical_results add column if not exists competition_date date;
