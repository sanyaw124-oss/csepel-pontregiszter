-- Pontregiszter v0.9.75b: Biró Boglárka kétszer szerepel — a listáról leolvasott „Bíró” (í) névvel
-- új ideiglenes profil jött létre, holott „Biró” (i) néven már megvolt.
-- 1) a MEGLÉVŐ (nem ideiglenes) profilra beírja az engedélyszámot
-- 2) a most létrejött ideiglenes másolatot törli — csak ha a meglévő tényleg megvan, és a másolathoz
--    semmi nem kapcsolódik (eredmény, startlista, edzés, szülő, belépés)
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható.

update public.competitors set license_number = 'MRGSZ019026A26'
where license_number is null
  and coalesce(is_provisional, false) = false
  and translate(lower(trim(full_name)), 'íóöőúüűéá', 'iooouuuea') = 'biro boglarka';

delete from public.competitors c
where c.full_name = 'Bíró Boglárka'
  and c.is_provisional = true
  and c.license_number = 'MRGSZ019026A26'
  and exists (select 1 from public.competitors o
              where o.id <> c.id and coalesce(o.is_provisional, false) = false
                and translate(lower(trim(o.full_name)), 'íóöőúüűéá', 'iooouuuea') = 'biro boglarka')
  and not exists (select 1 from public.startlist_entries s where s.competitor_id = c.id)
  and not exists (select 1 from public.historical_results h where h.competitor_id = c.id)
  and not exists (select 1 from public.training_attendance t where t.competitor_id = c.id)
  and not exists (select 1 from public.parent_child_links p where p.competitor_id = c.id)
  and not exists (select 1 from public.profiles p where p.competitor_id = c.id);

-- ellenőrzés: egy sor maradjon, kitöltött engedélyszámmal
select id, full_name, birth_date, is_provisional, license_number from public.competitors
where translate(lower(trim(full_name)), 'íóöőúüűéá', 'iooouuuea') = 'biro boglarka';
