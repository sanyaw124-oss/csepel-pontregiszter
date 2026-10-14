-- Pontregiszter v0.9.75: MRGSZ versenyengedély száma + a 2026-os engedélylista betöltése
-- 1) új mező: competitors.license_number
-- 2) a listán szereplő, a programban MÁR MEGLÉVŐ versenyzőknél beírja az engedély számát
--    (párosítás: pontos név, vagy azonos születési dátum + vezetéknév)
-- 3) a programból HIÁNYZÓKAT ideiglenes profilként felveszi (név, születési dátum, engedély);
--    a kategóriát / korosztályt az edző egészíti ki és véglegesíti (Áttekintés → Ideiglenes profilok)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható (nem vesz fel kétszer senkit).
-- Meglévő adatot (név, születési dátum, kategória) NEM módosít, csak az üres engedélyszámot tölti.

alter table public.competitors add column if not exists license_number text;

-- 2) meglévők: engedélyszám (csak ahol még üres)
with lista(nev, szul, eng) as (values
    ('Bednanics Dóra', date '2008-02-19', 'MRGSZ011541A26'),
    ('Bencsik Csenge', date '2011-07-24', 'MRGSZ024146A26'),
    ('Bíró Boglárka', date '2011-09-03', 'MRGSZ019026A26'),
    ('Boncz Nóra', date '2010-07-11', 'MRGSZ016683A26'),
    ('Boros Borka', date '2018-08-13', 'MRGSZ054359A26'),
    ('Copek Dorina', date '2016-12-02', 'MRGSZ025978A26'),
    ('Dudok Nóra', date '2012-04-19', 'MRGSZ018002A26'),
    ('Gasparics Mónika Regina', date '2012-01-18', 'MRGSZ024147A26'),
    ('Ihász Mandola Panna', date '2012-07-23', 'MRGSZ018004A26'),
    ('Illés Kiara', date '2009-07-23', 'MRGSZ019740A26'),
    ('Karaba Nóra Katalin', date '2011-08-05', 'MRGSZ018005A26'),
    ('Karl-Király Lia Nilla', date '2017-05-09', 'MRGSZ054256A26'),
    ('Kenéz Zselyke', date '2014-07-03', 'MRGSZ054371A26'),
    ('Kéri Milla Lili', date '2017-06-20', 'MRGSZ026933A26'),
    ('Kovács Dorka', date '2015-04-22', 'MRGSZ020610A26'),
    ('Kovács Zora', date '2018-11-07', 'MRGSZ054128A26'),
    ('Kővári Vivien', date '2010-10-11', 'MRGSZ018006A26'),
    ('Majszin Nikolett Mercédesz', date '2008-07-20', 'MRGSZ017033A26'),
    ('Mihályfalvy Dóra', date '2013-04-24', 'MRGSZ019224A26'),
    ('Munkácsi Lívia', date '2008-11-29', 'MRGSZ015268A26'),
    ('Nagy Enikő', date '2013-11-16', 'MRGSZ018361A26'),
    ('Nagy Liliána', date '2012-08-29', 'MRGSZ025431A26'),
    ('Örvendi Rebeka', date '2008-09-17', 'MRGSZ012247A26'),
    ('Örvendi Regina', date '2010-09-24', 'MRGSZ014460A26'),
    ('Péter Vivien', date '2011-11-24', 'MRGSZ016069A26'),
    ('Piller Liza Noa', date '2011-06-01', 'MRGSZ025036A26'),
    ('Piller Szofi Lea', date '2018-02-27', 'MRGSZ054340A26'),
    ('Pintér-Csillag Bora', date '2012-12-27', 'MRGSZ025415A26'),
    ('Plausin Katalin', date '2013-10-01', 'MRGSZ025414A26'),
    ('Szarka Zoé', date '2014-07-27', 'MRGSZ026639A26'),
    ('Szávin Szonja', date '2018-03-28', 'MRGSZ054357A26'),
    ('Szemán Zoé Jázmin', date '2011-06-07', 'MRGSZ015931A26'),
    ('Szilágyi Dóra', date '2013-04-06', 'MRGSZ019608A26'),
    ('Szilvási Kátya', date '2013-10-28', 'MRGSZ023196A26'),
    ('Tandory Nikolett', date '2016-02-10', 'MRGSZ024894A26'),
    ('Topánka Maja', date '2018-04-16', 'MRGSZ054343A26'),
    ('Tóth Anna', date '2007-05-02', 'MRGSZ011380A26'),
    ('Tóth Petra', date '2005-02-20', 'MRGSZ015933A26'),
    ('Varga Emese Ágnes', date '2016-08-23', 'MRGSZ025039A26'),
    ('Vigh Panna', date '2008-04-01', 'MRGSZ012044A26'),
    ('Vlasits Emma', date '2016-11-23', 'MRGSZ054358A26'),
    ('Völgyesi Noémi', date '2014-07-27', 'MRGSZ019788A26'),
    ('Völgyesi Petra', date '2010-10-13', 'MRGSZ017753A26')
  )
update public.competitors c set license_number = l.eng
from lista l
where c.license_number is null
  and (lower(trim(c.full_name)) = lower(l.nev)
         or (c.birth_date = l.szul and split_part(lower(trim(c.full_name)), ' ', 1) = split_part(lower(l.nev), ' ', 1)));

-- 3) hiányzók felvétele ideiglenes profilként
do $$
begin
  with lista(nev, szul, eng) as (values
    ('Bednanics Dóra', date '2008-02-19', 'MRGSZ011541A26'),
    ('Bencsik Csenge', date '2011-07-24', 'MRGSZ024146A26'),
    ('Bíró Boglárka', date '2011-09-03', 'MRGSZ019026A26'),
    ('Boncz Nóra', date '2010-07-11', 'MRGSZ016683A26'),
    ('Boros Borka', date '2018-08-13', 'MRGSZ054359A26'),
    ('Copek Dorina', date '2016-12-02', 'MRGSZ025978A26'),
    ('Dudok Nóra', date '2012-04-19', 'MRGSZ018002A26'),
    ('Gasparics Mónika Regina', date '2012-01-18', 'MRGSZ024147A26'),
    ('Ihász Mandola Panna', date '2012-07-23', 'MRGSZ018004A26'),
    ('Illés Kiara', date '2009-07-23', 'MRGSZ019740A26'),
    ('Karaba Nóra Katalin', date '2011-08-05', 'MRGSZ018005A26'),
    ('Karl-Király Lia Nilla', date '2017-05-09', 'MRGSZ054256A26'),
    ('Kenéz Zselyke', date '2014-07-03', 'MRGSZ054371A26'),
    ('Kéri Milla Lili', date '2017-06-20', 'MRGSZ026933A26'),
    ('Kovács Dorka', date '2015-04-22', 'MRGSZ020610A26'),
    ('Kovács Zora', date '2018-11-07', 'MRGSZ054128A26'),
    ('Kővári Vivien', date '2010-10-11', 'MRGSZ018006A26'),
    ('Majszin Nikolett Mercédesz', date '2008-07-20', 'MRGSZ017033A26'),
    ('Mihályfalvy Dóra', date '2013-04-24', 'MRGSZ019224A26'),
    ('Munkácsi Lívia', date '2008-11-29', 'MRGSZ015268A26'),
    ('Nagy Enikő', date '2013-11-16', 'MRGSZ018361A26'),
    ('Nagy Liliána', date '2012-08-29', 'MRGSZ025431A26'),
    ('Örvendi Rebeka', date '2008-09-17', 'MRGSZ012247A26'),
    ('Örvendi Regina', date '2010-09-24', 'MRGSZ014460A26'),
    ('Péter Vivien', date '2011-11-24', 'MRGSZ016069A26'),
    ('Piller Liza Noa', date '2011-06-01', 'MRGSZ025036A26'),
    ('Piller Szofi Lea', date '2018-02-27', 'MRGSZ054340A26'),
    ('Pintér-Csillag Bora', date '2012-12-27', 'MRGSZ025415A26'),
    ('Plausin Katalin', date '2013-10-01', 'MRGSZ025414A26'),
    ('Szarka Zoé', date '2014-07-27', 'MRGSZ026639A26'),
    ('Szávin Szonja', date '2018-03-28', 'MRGSZ054357A26'),
    ('Szemán Zoé Jázmin', date '2011-06-07', 'MRGSZ015931A26'),
    ('Szilágyi Dóra', date '2013-04-06', 'MRGSZ019608A26'),
    ('Szilvási Kátya', date '2013-10-28', 'MRGSZ023196A26'),
    ('Tandory Nikolett', date '2016-02-10', 'MRGSZ024894A26'),
    ('Topánka Maja', date '2018-04-16', 'MRGSZ054343A26'),
    ('Tóth Anna', date '2007-05-02', 'MRGSZ011380A26'),
    ('Tóth Petra', date '2005-02-20', 'MRGSZ015933A26'),
    ('Varga Emese Ágnes', date '2016-08-23', 'MRGSZ025039A26'),
    ('Vigh Panna', date '2008-04-01', 'MRGSZ012044A26'),
    ('Vlasits Emma', date '2016-11-23', 'MRGSZ054358A26'),
    ('Völgyesi Noémi', date '2014-07-27', 'MRGSZ019788A26'),
    ('Völgyesi Petra', date '2010-10-13', 'MRGSZ017753A26')
  )
  insert into public.competitors (full_name, birth_date, birth_year, license_number, is_provisional, is_active, is_club_member)
  select l.nev, l.szul, extract(year from l.szul)::int, l.eng, true, true, true
  from lista l
  where not exists (select 1 from public.competitors c where lower(trim(c.full_name)) = lower(l.nev)
         or (c.birth_date = l.szul and split_part(lower(trim(c.full_name)), ' ', 1) = split_part(lower(l.nev), ' ', 1)));
exception when not_null_violation or check_violation then
  -- ha a kategória / korosztály nem lehet üres: alapértékkel (az edző úgyis átírja)
  with lista(nev, szul, eng) as (values
    ('Bednanics Dóra', date '2008-02-19', 'MRGSZ011541A26'),
    ('Bencsik Csenge', date '2011-07-24', 'MRGSZ024146A26'),
    ('Bíró Boglárka', date '2011-09-03', 'MRGSZ019026A26'),
    ('Boncz Nóra', date '2010-07-11', 'MRGSZ016683A26'),
    ('Boros Borka', date '2018-08-13', 'MRGSZ054359A26'),
    ('Copek Dorina', date '2016-12-02', 'MRGSZ025978A26'),
    ('Dudok Nóra', date '2012-04-19', 'MRGSZ018002A26'),
    ('Gasparics Mónika Regina', date '2012-01-18', 'MRGSZ024147A26'),
    ('Ihász Mandola Panna', date '2012-07-23', 'MRGSZ018004A26'),
    ('Illés Kiara', date '2009-07-23', 'MRGSZ019740A26'),
    ('Karaba Nóra Katalin', date '2011-08-05', 'MRGSZ018005A26'),
    ('Karl-Király Lia Nilla', date '2017-05-09', 'MRGSZ054256A26'),
    ('Kenéz Zselyke', date '2014-07-03', 'MRGSZ054371A26'),
    ('Kéri Milla Lili', date '2017-06-20', 'MRGSZ026933A26'),
    ('Kovács Dorka', date '2015-04-22', 'MRGSZ020610A26'),
    ('Kovács Zora', date '2018-11-07', 'MRGSZ054128A26'),
    ('Kővári Vivien', date '2010-10-11', 'MRGSZ018006A26'),
    ('Majszin Nikolett Mercédesz', date '2008-07-20', 'MRGSZ017033A26'),
    ('Mihályfalvy Dóra', date '2013-04-24', 'MRGSZ019224A26'),
    ('Munkácsi Lívia', date '2008-11-29', 'MRGSZ015268A26'),
    ('Nagy Enikő', date '2013-11-16', 'MRGSZ018361A26'),
    ('Nagy Liliána', date '2012-08-29', 'MRGSZ025431A26'),
    ('Örvendi Rebeka', date '2008-09-17', 'MRGSZ012247A26'),
    ('Örvendi Regina', date '2010-09-24', 'MRGSZ014460A26'),
    ('Péter Vivien', date '2011-11-24', 'MRGSZ016069A26'),
    ('Piller Liza Noa', date '2011-06-01', 'MRGSZ025036A26'),
    ('Piller Szofi Lea', date '2018-02-27', 'MRGSZ054340A26'),
    ('Pintér-Csillag Bora', date '2012-12-27', 'MRGSZ025415A26'),
    ('Plausin Katalin', date '2013-10-01', 'MRGSZ025414A26'),
    ('Szarka Zoé', date '2014-07-27', 'MRGSZ026639A26'),
    ('Szávin Szonja', date '2018-03-28', 'MRGSZ054357A26'),
    ('Szemán Zoé Jázmin', date '2011-06-07', 'MRGSZ015931A26'),
    ('Szilágyi Dóra', date '2013-04-06', 'MRGSZ019608A26'),
    ('Szilvási Kátya', date '2013-10-28', 'MRGSZ023196A26'),
    ('Tandory Nikolett', date '2016-02-10', 'MRGSZ024894A26'),
    ('Topánka Maja', date '2018-04-16', 'MRGSZ054343A26'),
    ('Tóth Anna', date '2007-05-02', 'MRGSZ011380A26'),
    ('Tóth Petra', date '2005-02-20', 'MRGSZ015933A26'),
    ('Varga Emese Ágnes', date '2016-08-23', 'MRGSZ025039A26'),
    ('Vigh Panna', date '2008-04-01', 'MRGSZ012044A26'),
    ('Vlasits Emma', date '2016-11-23', 'MRGSZ054358A26'),
    ('Völgyesi Noémi', date '2014-07-27', 'MRGSZ019788A26'),
    ('Völgyesi Petra', date '2010-10-13', 'MRGSZ017753A26')
  )
  insert into public.competitors (full_name, birth_date, birth_year, license_number, kategoria, korosztaly, is_provisional, is_active, is_club_member)
  select l.nev, l.szul, extract(year from l.szul)::int, l.eng, 'VSK II', 'serdülő', true, true, true
  from lista l
  where not exists (select 1 from public.competitors c where lower(trim(c.full_name)) = lower(l.nev)
         or (c.birth_date = l.szul and split_part(lower(trim(c.full_name)), ' ', 1) = split_part(lower(l.nev), ' ', 1)));
end $$;
