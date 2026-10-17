-- Pontregiszter v1.1.1: több pontozó egyszerre (Magyar Kupa, 2026.10.17.)
-- Egy startlista-sorhoz CSAK EGY eredmény-sor lehessen — így két egyszerre mentő pontozó nem
-- hoz létre dupla sort (a második mentés hibát kap, a program frissít és rákérdez).
-- BIZTONSÁGOS: semmit nem töröl és nem módosít. Ha már van dupla sor, a védelmet NEM teszi fel,
-- hanem kilistázza őket (alul az eredményben) — azokat egyeztetjük, mielőtt bármit törlünk.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható.

do $$
begin
  if not exists (
    select 1 from public.results group by startlist_entry_id having count(*) > 1
  ) then
    create unique index if not exists results_one_per_startlist_entry
      on public.results (startlist_entry_id);
    raise notice 'Védelem bekapcsolva: soronként egy eredmény.';
  else
    raise notice 'Van dupla eredmény-sor — a védelem NINCS bekapcsolva, lásd a listát.';
  end if;
end $$;

-- Ellenőrzés: üres lista = nincs dupla sor; a második sor jelzi, hogy él-e a védelem
select 'DUPLA SOR' as allapot, r.startlist_entry_id, count(*) as darab,
       string_agg(coalesce(r.score_total::text, '—') || ' @ ' || coalesce(r.modified_at::text, r.created_at::text), '  |  ') as ertekek
from public.results r
group by r.startlist_entry_id having count(*) > 1
union all
select case when exists (select 1 from pg_indexes where indexname = 'results_one_per_startlist_entry')
            then 'VÉDELEM BEKAPCSOLVA' else 'VÉDELEM NINCS' end, null, null, null;
