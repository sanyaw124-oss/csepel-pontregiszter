-- Pontregiszter v1.7.0: nemzetközi kategóriák + évszám-csoport (Grácia CUP, 2026.10.21.)
--   1) competition_categories.age_group: évszám-csoport, pl. '2013' vagy '2010–2011' (üres = nincs bontás).
--      A helyezés kategóriánként számolódik, így az évszám szerint bontott kategóriák külön rangsort kapnak.
--   2) A kategória (VSK I, VSK II, SZK, BNK) mellé: FIG, NON-FIG, CAT 0, CAT 1, CAT 2, CAT 3.
--      Ha az adatbázisban van ellenőrző szabály a kategóriára, kicseréljük a bővített listára.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

alter table public.competition_categories add column if not exists age_group text;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.competition_categories'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kategoria%'
  loop
    execute format('alter table public.competition_categories drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.competition_categories add constraint competition_categories_kategoria_check
  check (kategoria in ('VSK I', 'VSK II', 'SZK', 'BNK', 'FIG', 'NON-FIG', 'CAT 0', 'CAT 1', 'CAT 2', 'CAT 3'));

select 'KÉSZ' as allapot,
       (select count(*) from information_schema.columns
         where table_name = 'competition_categories' and column_name = 'age_group') as evszam_oszlop,
       (select pg_get_constraintdef(oid) from pg_constraint
         where conname = 'competition_categories_kategoria_check') as kategoria_szabaly;
