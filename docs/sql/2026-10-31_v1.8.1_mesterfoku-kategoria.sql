-- Pontregiszter v1.8.1: új kategóriák a Kismester és a Mesterfokú Bajnoksághoz (Sándor, 2026.10.31.)
-- Ezeken a bajnokságokon nincs VSK-kategória — maga a bajnokság a kategória.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; adatot nem módosít.

alter table public.competition_categories drop constraint if exists competition_categories_kategoria_check;
alter table public.competition_categories add constraint competition_categories_kategoria_check
  check (kategoria in ('VSK I', 'VSK II', 'SZK', 'BNK', 'FIG', 'NON-FIG', 'CAT 0', 'CAT 1', 'CAT 2', 'CAT 3',
                       'Kismester', 'Mesterfokú'));

select 'KÉSZ' as allapot,
       (select pg_get_constraintdef(oid) from pg_constraint
         where conname = 'competition_categories_kategoria_check') as kategoria_szabaly;
