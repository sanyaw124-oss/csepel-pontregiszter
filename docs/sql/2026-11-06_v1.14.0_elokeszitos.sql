-- Pontregiszter v1.14.0: előkészítős gyerekek (Sándor, 2026.11.06.)
--   - competitors.status: 'versenyzo' (alap, minden meglévő gyerek ez marad) vagy 'elokeszitos'
--   - competitors.training_since: mióta jár edzésre (az előkészítősök adatlapján)
-- Az előkészítős gyerek és szülője a felületen kevesebbet lát; a „Versenyzővé teszem” gomb ezt a mezőt váltja.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

alter table public.competitors add column if not exists status text not null default 'versenyzo';
alter table public.competitors drop constraint if exists competitors_status_check;
alter table public.competitors add constraint competitors_status_check check (status in ('versenyzo', 'elokeszitos'));
alter table public.competitors add column if not exists training_since date;

select 'KÉSZ' as allapot,
       count(*) filter (where status = 'versenyzo') as versenyzok,
       count(*) filter (where status = 'elokeszitos') as elokeszitosok
  from public.competitors;
