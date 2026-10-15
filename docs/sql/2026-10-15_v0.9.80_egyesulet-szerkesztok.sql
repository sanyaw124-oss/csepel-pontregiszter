-- Pontregiszter v0.9.80: az Egyesület fület az szerkesztheti, akinek admin joga van (Sándor 2026.10.15):
-- Admin, Szülő-admin, Vezetőedző, Edző. (Segédedző, szülő, versenyző csak olvas.)
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; adatot nem módosít.

drop policy if exists club_info_write on public.club_info;
create policy club_info_write on public.club_info for update to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

drop policy if exists club_people_write on public.club_people;
create policy club_people_write on public.club_people for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
