-- Pontregiszter v0.9.53: a versenyző (és a szülő a saját gyerekének) maga rögzíti az edzését
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.
-- Meglévő edzés-adatot nem módosít.

-- 1) Jelölés: ki rögzítette (az edzői lista mutatja, és az edző törölheti)
alter table public.training_attendance add column if not exists self_reported boolean not null default false;
alter table public.training_attendance add column if not exists reported_by uuid default auth.uid();

-- 2) A régi, túl tág versenyzői szabályok le: ezekkel bármelyik versenyző bárki
--    edzését beírhatta / törölhette. (Az edzői "staff writes" szabály marad.)
drop policy if exists training_attendance_versenyzo_insert on public.training_attendance;
drop policy if exists training_attendance_versenyzo_update on public.training_attendance;
drop policy if exists training_attendance_versenyzo_delete on public.training_attendance;

-- 3) Rögzítheti-e a belépett felhasználó ennek a versenyzőnek az edzését?
--    (saját maga, vagy a szülője)
create or replace function public.can_report_training_for(p_competitor uuid) returns boolean
language sql stable security definer set search_path = public as $f$
  select p_competitor = public.my_competitor_id()
      or exists (select 1 from parent_child_links
                 where parent_user_id = auth.uid() and competitor_id = p_competitor)
$f$;

-- 4) Saját rögzítés: csak a mai nap és az elmúlt 7 nap (budapesti idő szerint),
--    csak edzés / egész napos edzés (tábort az edző rögzít). Ha arra a napra még
--    nincs edzés, létrehozza. Visszavonni csak a saját rögzítést lehet, az edzőét nem.
create or replace function public.self_report_training(
  p_competitor uuid, p_date date, p_type text, p_present boolean
) returns void
language plpgsql security definer set search_path = public as $f$
declare
  v_today date := (now() at time zone 'Europe/Budapest')::date;
  v_session uuid;
begin
  if auth.uid() is null or not public.can_report_training_for(p_competitor) then
    raise exception 'Csak a saját (vagy a saját gyereked) edzését rögzítheted';
  end if;
  if p_date > v_today or p_date < v_today - 7 then
    raise exception 'Csak a mai napra és az elmúlt 7 napra rögzíthetsz';
  end if;
  if p_type not in ('edzes', 'egesznapos') then
    raise exception 'Csak edzést vagy egész napos edzést rögzíthetsz';
  end if;

  select id into v_session from training_sessions
   where date = p_date and session_type = p_type
   order by created_at limit 1;

  if p_present then
    if v_session is null then
      insert into training_sessions (date, session_type, created_by)
      values (p_date, p_type, auth.uid()) returning id into v_session;
    end if;
    insert into training_attendance (session_id, competitor_id, self_reported, reported_by)
    values (v_session, p_competitor, true, auth.uid())
    on conflict (session_id, competitor_id) do nothing;
  elsif v_session is not null then
    delete from training_attendance
     where session_id = v_session and competitor_id = p_competitor and self_reported;
  end if;
end
$f$;

revoke all on function public.self_report_training(uuid, date, text, boolean) from public, anon;
grant execute on function public.self_report_training(uuid, date, text, boolean) to authenticated;
revoke all on function public.can_report_training_for(uuid) from public, anon;
grant execute on function public.can_report_training_for(uuid) to authenticated;
