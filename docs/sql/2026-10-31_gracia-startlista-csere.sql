-- Grácia Kupa 2026 (2026.10.31.): a KÉTSZER importált startlista kitakarítása a javított import előtt.
-- Törli a verseny startlista-sorait és az importból létrejött (startlistához kötött) csapatokat a tagjaikkal.
-- A versenyt, a napokat és a kategóriákat MEGHAGYJA (a javított import ezekbe tölt vissza).
-- BIZTONSÁG: ha a versenyhez már van akár egyetlen eredmény (pont), SEMMIT nem töröl, hibát ad.

do $$
declare
  cid uuid := 'adbd57f7-ca48-41f0-8816-b2900b6787b5';  -- Gracia Kupa
  n int;
  teams uuid[];
begin
  select count(*) into n
  from public.results r
  join public.startlist_entries e on e.id = r.startlist_entry_id
  join public.competition_categories c on c.id = e.competition_category_id
  join public.competition_days d on d.id = c.competition_day_id
  where d.competition_id = cid;
  if n > 0 then
    raise exception 'A versenyhez már van % eredmény — nem törlök semmit.', n;
  end if;

  select array_agg(distinct e.team_id) into teams
  from public.startlist_entries e
  join public.competition_categories c on c.id = e.competition_category_id
  join public.competition_days d on d.id = c.competition_day_id
  where d.competition_id = cid and e.team_id is not null;

  delete from public.startlist_entries e
  using public.competition_categories c, public.competition_days d
  where c.id = e.competition_category_id and d.id = c.competition_day_id and d.competition_id = cid;

  if teams is not null then
    delete from public.competition_team_members where team_id = any (teams);
    delete from public.competition_teams where id = any (teams);
  end if;
end $$;

select 'KÉSZ' as allapot,
       (select count(*) from public.startlist_entries e
          join public.competition_categories c on c.id = e.competition_category_id
          join public.competition_days d on d.id = c.competition_day_id
         where d.competition_id = 'adbd57f7-ca48-41f0-8816-b2900b6787b5') as maradt_startlista_sor,
       (select count(*) from public.competition_teams
         where competition_id = 'adbd57f7-ca48-41f0-8816-b2900b6787b5') as maradt_csapat;
