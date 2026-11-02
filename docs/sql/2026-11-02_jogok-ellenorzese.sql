-- Pontregiszter: csak olvas, semmit nem módosít (2026.11.02.)
-- Azokat az adatbázis-szabályokat és függvényeket listázza, amelyek a négy egyenrangú szerepkör
-- (admin, szulo_admin, vezetoedzo, edzo) közül csak némelyiket engedik.
-- Futtatás: Supabase → SQL Editor → Run. Az eredményt küldd el képként.

with szabalyok as (
  select 'szabály' as fajta, schemaname || '.' || tablename || ' · ' || policyname || ' · ' || cmd as nev,
         coalesce(qual, '') || ' ' || coalesce(with_check, '') as szoveg
    from pg_policies where schemaname in ('public', 'storage')
  union all
  select 'függvény', n.nspname || '.' || p.proname, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
)
select fajta, nev,
       concat_ws(', ',
         case when szoveg !~ '''admin''' then 'admin' end,
         case when szoveg !~ '''szulo_admin''' then 'szulo_admin' end,
         case when szoveg !~ '''vezetoedzo''' then 'vezetoedzo' end,
         case when szoveg !~ '''edzo''' then 'edzo' end) as nincs_benne
  from szabalyok
 where szoveg ~ '''(admin|szulo_admin|vezetoedzo|edzo)'''
   and not (szoveg ~ '''admin''' and szoveg ~ '''szulo_admin''' and szoveg ~ '''vezetoedzo''' and szoveg ~ '''edzo''')
 order by 1, 2;
