-- Pontregiszter v1.2.0: Csepeli eredmények = kontrollfelület (Sándor, Magyar Kupa 2026.10.17.)
--   1) competition_teams.team_type: 'klub' (klubcsapat) vagy 'kombinalt' (kombinált csapat).
--      Az EKCS-csapatokat továbbra is a startlista köti (team_id), azokra ez nem vonatkozik.
--      Mindkét fajta helyezését kézzel adjuk meg (a program nem számolja).
--   2) startlist_entries.is_exhibition: BEMUTATÓ — pontozták, de a végleges értékelésbe nem számít
--      (nincs helyezés, nem számít érembe, versenyszámba, statisztikába).
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít
-- (a meglévő klub-csapatok 'klub' típusúak lesznek).

alter table public.competition_teams add column if not exists team_type text not null default 'klub';
alter table public.competition_teams drop constraint if exists competition_teams_team_type_check;
alter table public.competition_teams add constraint competition_teams_team_type_check
  check (team_type in ('klub', 'kombinalt'));

alter table public.startlist_entries add column if not exists is_exhibition boolean not null default false;

select 'KÉSZ' as allapot,
       (select count(*) from information_schema.columns where table_name = 'competition_teams' and column_name = 'team_type') as team_type_oszlop,
       (select count(*) from information_schema.columns where table_name = 'startlist_entries' and column_name = 'is_exhibition') as bemutato_oszlop;
