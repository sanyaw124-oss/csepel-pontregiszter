-- Pontregiszter v1.9.0: egy napon belül ugyanaz a kategória + korosztály csak akkor nem ismétlődhet, ha az
-- évszám-csoport (és a típus) is azonos. Így a „CAT 1 · serdülő · 2013” és „· 2014” megfér egymás mellett,
-- és az „Évszám szerinti bontás” is működik. (A régi szabály az évszámot nem nézte → az import elakadt.)
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; adatot nem módosít.

alter table public.competition_categories
  drop constraint if exists competition_categories_competition_day_id_kategoria_koroszt_key;
create unique index if not exists competition_categories_egyedi
  on public.competition_categories (competition_day_id, kategoria, korosztaly, type, coalesce(age_group, ''));

select 'KÉSZ' as allapot,
       (select count(*) from pg_indexes where indexname = 'competition_categories_egyedi') as uj_szabaly,
       (select count(*) from pg_constraint
         where conname = 'competition_categories_competition_day_id_kategoria_koroszt_key') as regi_szabaly_maradt;
