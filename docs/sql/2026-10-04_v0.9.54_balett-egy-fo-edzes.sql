-- Pontregiszter v0.9.54: balett + naponta egy fő edzésforma (edzés / egész napos / tábor)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.
-- Meglévő edzés-adatot nem módosít és nem töröl.

-- 1) Új edzéstípus: balett
alter table public.training_sessions drop constraint if exists training_sessions_session_type_check;
alter table public.training_sessions add constraint training_sessions_session_type_check
  check (session_type = any (array['edzes','egesznapos','tabor','balett']));

-- 2) Összesítő nézetek: külön balett-számláló; az "összesen" csak a fő edzésformákat
--    számolja (a balett bármelyik mellé járhat, nem duplázza a napot)
create or replace view public.v_training_yearly_summary with (security_invoker = on) as
select ta.competitor_id,
       extract(year from ts.date)::integer as year,
       count(*) filter (where ts.session_type = 'edzes') as edzes_count,
       count(*) filter (where ts.session_type = 'egesznapos') as egesznapos_count,
       count(*) filter (where ts.session_type = 'tabor') as tabor_count,
       count(*) filter (where ts.session_type <> 'balett') as total_count,
       count(*) filter (where ts.session_type = 'balett') as balett_count
from training_attendance ta
join training_sessions ts on ts.id = ta.session_id
group by ta.competitor_id, extract(year from ts.date);

create or replace view public.v_training_monthly_summary with (security_invoker = on) as
select ta.competitor_id,
       extract(year from ts.date)::integer as year,
       extract(month from ts.date)::integer as month,
       count(*) filter (where ts.session_type = 'edzes') as edzes_count,
       count(*) filter (where ts.session_type = 'egesznapos') as egesznapos_count,
       count(*) filter (where ts.session_type = 'tabor') as tabor_count,
       count(*) filter (where ts.session_type <> 'balett') as total_count,
       count(*) filter (where ts.session_type = 'balett') as balett_count
from training_attendance ta
join training_sessions ts on ts.id = ta.session_id
group by ta.competitor_id, extract(year from ts.date), extract(month from ts.date);

-- 3) Védelem: egy versenyzőnek egy napon csak EGY fő edzésformája lehet
--    (edzés / egész napos / tábor); a balett bármelyik mellé mehet.
--    Csak új bejegyzést ellenőriz, a meglévő adatot nem bántja.
create or replace function public.check_one_main_training() returns trigger
language plpgsql security definer set search_path = public as $f$
declare
  v_type text;
  v_date date;
  v_other text;
begin
  select session_type, date into v_type, v_date from training_sessions where id = new.session_id;
  if v_type = 'balett' then return new; end if;
  select s.session_type into v_other
    from training_attendance a join training_sessions s on s.id = a.session_id
   where a.competitor_id = new.competitor_id and s.date = v_date
     and s.session_type <> 'balett' and s.session_type <> v_type
   limit 1;
  if v_other is not null then
    raise exception 'Erre a napra ennél a versenyzőnél már másik edzésforma van rögzítve (%)', v_other;
  end if;
  return new;
end
$f$;
drop trigger if exists one_main_training on public.training_attendance;
create trigger one_main_training before insert on public.training_attendance
  for each row execute function public.check_one_main_training();

-- 4) Saját rögzítés: most már tábor és balett is. Fő forma váltásakor a gyerek
--    saját korábbi jelölése (aznapi másik fő forma) magától lekerül; ha azt az
--    edző rögzítette, nem váltható.
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
  if p_type not in ('edzes', 'egesznapos', 'tabor', 'balett') then
    raise exception 'Érvénytelen edzéstípus';
  end if;

  if p_present and p_type <> 'balett' then
    if exists (select 1 from training_attendance a join training_sessions s on s.id = a.session_id
                where a.competitor_id = p_competitor and s.date = p_date
                  and s.session_type not in ('balett', p_type) and not a.self_reported) then
      raise exception 'Erre a napra az edző már másik edzésformát rögzített';
    end if;
    delete from training_attendance a using training_sessions s
     where s.id = a.session_id and a.competitor_id = p_competitor and s.date = p_date
       and s.session_type not in ('balett', p_type) and a.self_reported;
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
