-- Pontregiszter: az Admin, Szülő-admin, Vezetőedző és Edző jogai azonosak (Sándor, 2026.11.02.)
-- A megnevezés egyelőre csak megkülönböztetés. Csak a szerepkör-listák bővülnek; a Segédedző jogai
-- nem változnak, adatot nem módosít. Többször is lefuttatható.

alter policy "staff manages competitors" on public.competitors
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
alter policy "staff see all competitors" on public.competitors
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo']));

alter policy "admin manages links" on public.parent_child_links
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
alter policy "staff see all links" on public.parent_child_links
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo']));

alter policy "admin manages profiles" on public.profiles
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
alter policy "admin updates profiles" on public.profiles
  using ((auth.uid() = id) or current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
alter policy "staff see all profiles" on public.profiles
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo']));

alter policy "staff manages venues" on public.venues
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

select tablename, policyname, qual from pg_policies
 where schemaname = 'public' and tablename in ('competitors','parent_child_links','profiles','venues')
   and policyname in ('staff manages competitors','staff see all competitors','admin manages links','staff see all links',
                      'admin manages profiles','admin updates profiles','staff see all profiles','staff manages venues')
 order by 1, 2;
