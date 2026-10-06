// ═══════════════════════════════════════════════════════════════════
// Kitűzők (v0.9.64) — Sándor 2026.10.06
//   - minden 50. edzés az évben (edzés + egész napos + tábor)
//   - havi dicséret: több mint 12 edzés egy hónapban (edzés + egész napos),
//     nagy dicséret: több mint 20
//   - új egyéni csúcs: egy szeren megdönti a saját legjobbját
//   - dobogó-sorozat: 3 versenyen egymás után dobogó
// Kitűzők, nem érmek: nincs köztük rangsor. Évente gyűjtik; a gyerek a
// kincsesládájában, a szülő és az edző a gyereknél látja. Nincs hozzá tábla:
// minden a meglévő edzés- és versenyadatokból számolódik.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import { ApparatusIcon } from './apparatusIcons';

const APP_KEYS = ['szabad', 'karika', 'labda', 'buzogany', 'szalag', 'kotel'];
const APP_NAMES = { szabad: 'Szabad', karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél' };
const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

const MILESTONE_TYPES = ['edzes', 'egesznapos', 'tabor'];
const MONTHLY_TYPES = ['edzes', 'egesznapos'];
const PRAISE_MIN = 12;      // ennél TÖBB → dicséret
const BIG_PRAISE_MIN = 20;  // ennél TÖBB → nagy dicséret
const STREAK = 3;

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const fmt = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(3));
const huDate = (d) => (d ? d.replace(/-/g, '.') + '.' : '');

// ─── Adatok: edzések, szer-pontok, versenyenkénti legjobb helyezés ─────
export async function loadBadgeData(supabase, competitorId) {
  const [att, res, aa, members, hist] = await Promise.all([
    supabase.from('training_attendance')
      .select('training_sessions!inner(date, session_type)')
      .eq('competitor_id', competitorId),
    supabase.from('results')
      .select(`placement, apparatus, score_total,
        startlist_entry:startlist_entries!inner(competitor_id, did_not_start,
          competition_category:competition_categories!inner(type,
            competition_day:competition_days!inner(
              competition:competitions!inner(id, name, start_date, is_finalized))))`)
      .eq('startlist_entry.competitor_id', competitorId),
    supabase.from('all_around_results')
      .select(`placement, competition_category:competition_categories!inner(
          competition_day:competition_days!inner(competition:competitions!inner(id, name, start_date, is_finalized)))`)
      .eq('competitor_id', competitorId),
    supabase.from('competition_team_members').select('team_id').eq('competitor_id', competitorId),
    supabase.from('historical_results').select('*').eq('competitor_id', competitorId)
  ]);
  for (const r of [att, res, aa, members, hist]) if (r.error) throw r.error;

  const sessions = (att.data || [])
    .map(a => a.training_sessions)
    .filter(s => s && s.date)
    .map(s => ({ date: s.date, type: s.session_type }));

  const perf = [];                 // egyéni szer-pontok (csúcshoz)
  const comps = new Map();         // versenyenként a legjobb helyezés (dobogóhoz)
  const notePlacement = (key, name, date, placement) => {
    if (!date) return;
    const c = comps.get(key) || { name, date, best: null };
    const p = parseInt(placement, 10);
    if (p > 0 && (c.best === null || p < c.best)) c.best = p;
    comps.set(key, c);
  };

  (res.data || []).forEach(r => {
    const se = r.startlist_entry;
    const comp = se?.competition_category?.competition_day?.competition;
    if (!comp || !comp.is_finalized || se.did_not_start) return;
    const key = 'live_' + comp.id;
    notePlacement(key, comp.name, comp.start_date, r.placement);
    if (se.competition_category.type !== 'csapat' && APP_KEYS.includes(r.apparatus) && num(r.score_total) !== null) {
      perf.push({ date: comp.start_date, apparatus: r.apparatus, score: num(r.score_total), comp: comp.name });
    }
  });
  (aa.data || []).forEach(a => {
    const comp = a.competition_category?.competition_day?.competition;
    if (comp && comp.is_finalized) notePlacement('live_' + comp.id, comp.name, comp.start_date, a.placement);
  });
  const teamIds = (members.data || []).map(m => m.team_id).filter(Boolean);
  if (teamIds.length > 0) {
    const { data: teams, error } = await supabase.from('competition_teams')
      .select('placement, competition:competition_id(id, name, start_date, is_finalized)').in('id', teamIds);
    if (error) throw error;
    (teams || []).forEach(t => {
      if (t.competition?.is_finalized) notePlacement('live_' + t.competition.id, t.competition.name, t.competition.start_date, t.placement);
    });
  }
  (hist.data || []).forEach(h => {
    const date = h.competition_date || (h.year ? `${h.year}-01-01` : null);
    const r = h.results || {};
    Object.keys(r).forEach(k => {
      notePlacement('hist_' + h.id, h.competition_name, date, r[k]?.placement);
      if (APP_KEYS.includes(k) && num(r[k]?.score) !== null) {
        perf.push({ date, apparatus: k, score: num(r[k].score), comp: h.competition_name });
      }
    });
  });

  return { sessions, perf, comps: Array.from(comps.values()) };
}

// ─── Kitűzők számítása egy évre ────────────────────────────────────────
export function computeBadges(data, year) {
  const badges = [];
  const inYear = (d) => d && d.slice(0, 4) === String(year);

  // 1) minden 50. edzés az évben
  const yearSessions = data.sessions
    .filter(s => inYear(s.date) && MILESTONE_TYPES.includes(s.type))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let n = 50; n <= yearSessions.length; n += 50) {
    badges.push({ key: `m${n}`, kind: 'milestone', n, date: yearSessions[n - 1].date,
      title: `${n}. edzés`, detail: `${year}-ben` });
  }
  const nextMilestone = (Math.floor(yearSessions.length / 50) + 1) * 50;

  // 2) havi dicséret / nagy dicséret
  const byMonth = {};
  data.sessions.filter(s => inYear(s.date) && MONTHLY_TYPES.includes(s.type)).forEach(s => {
    const m = parseInt(s.date.slice(5, 7), 10);
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  Object.keys(byMonth).map(Number).sort((a, b) => a - b).forEach(m => {
    const c = byMonth[m];
    if (c > BIG_PRAISE_MIN) {
      badges.push({ key: `p${m}`, kind: 'bigpraise', month: m, date: `${year}-${String(m).padStart(2, '0')}-28`,
        title: 'Nagy dicséret', detail: `${HU_MONTHS[m - 1]}: ${c} edzés` });
    } else if (c > PRAISE_MIN) {
      badges.push({ key: `p${m}`, kind: 'praise', month: m, date: `${year}-${String(m).padStart(2, '0')}-28`,
        title: 'Dicséret', detail: `${HU_MONTHS[m - 1]}: ${c} edzés` });
    }
  });

  // 3) új egyéni csúcs (a valaha volt legjobbhoz képest, szerenként)
  const best = {};
  [...data.perf].sort((a, b) => a.date.localeCompare(b.date)).forEach((p, i) => {
    const prev = best[p.apparatus];
    if (prev !== undefined && p.score > prev + 0.0005 && inYear(p.date)) {
      badges.push({ key: `c${i}`, kind: 'record', apparatus: p.apparatus, date: p.date,
        title: `Új csúcs — ${APP_NAMES[p.apparatus]}`, detail: `${fmt(p.score)} (eddig ${fmt(prev)}) · ${p.comp}` });
    }
    if (prev === undefined || p.score > prev) best[p.apparatus] = p.score;
  });

  // 4) dobogó-sorozat: 3 versenyen egymás után dobogó
  let streak = 0;
  [...data.comps].sort((a, b) => a.date.localeCompare(b.date)).forEach((c, i) => {
    if (c.best !== null && c.best <= 3) {
      streak += 1;
      if (streak === STREAK) {
        if (inYear(c.date)) {
          badges.push({ key: `s${i}`, kind: 'streak', date: c.date,
            title: 'Dobogó-sorozat', detail: `3 versenyen egymás után dobogón · utolsó: ${c.name}` });
        }
        streak = 0;
      }
    } else if (c.best !== null) {
      streak = 0;
    }
  });

  badges.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { badges, yearCount: yearSessions.length, nextMilestone };
}

// ─── Egy kitűző képe (kerek kitűző, színes peremmel) ──────────────────
const PIN_STYLE = {
  milestone: { ring: '#1D4ED8', bg: '#EFF6FF' },
  praise:    { ring: '#15803D', bg: '#F0FDF4' },
  bigpraise: { ring: '#7C3AED', bg: '#F5F3FF' },
  record:    { ring: '#D97706', bg: '#FFFBEB' },
  streak:    { ring: '#BE123C', bg: '#FFF1F2' }
};

function PinFace({ badge }) {
  switch (badge.kind) {
    case 'milestone':
      return <span className="font-extrabold leading-none" style={{ color: PIN_STYLE.milestone.ring, fontSize: badge.n >= 100 ? 17 : 20 }}>{badge.n}</span>;
    case 'praise':
      return <span style={{ fontSize: 24, lineHeight: 1 }}>⭐</span>;
    case 'bigpraise':
      return <span style={{ fontSize: 20, lineHeight: 1 }}>🌟🌟</span>;
    case 'record':
      return (
        <span className="relative inline-block">
          <ApparatusIcon kind={badge.apparatus} size={26} />
          <span className="absolute -top-2 -right-2 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center text-white"
                style={{ backgroundColor: PIN_STYLE.record.ring }}>↑</span>
        </span>
      );
    case 'streak':
      return (
        <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
          <rect x="10" y="2" width="8" height="18" rx="1" fill={PIN_STYLE.streak.ring} />
          <rect x="1" y="8" width="8" height="12" rx="1" fill={PIN_STYLE.streak.ring} opacity="0.75" />
          <rect x="19" y="12" width="8" height="8" rx="1" fill={PIN_STYLE.streak.ring} opacity="0.55" />
        </svg>
      );
    default:
      return null;
  }
}

export function BadgePin({ badge, size = 64 }) {
  const st = PIN_STYLE[badge.kind] || PIN_STYLE.milestone;
  return (
    <div className="flex flex-col items-center text-center" style={{ width: size + 28 }} title={`${badge.title} — ${badge.detail}`}>
      <div className="rounded-full flex items-center justify-center shadow-md"
           style={{
             width: size, height: size, backgroundColor: st.bg,
             border: `4px solid ${st.ring}`,
             boxShadow: `0 0 0 3px white, 0 0 0 4px ${st.ring}33, 0 3px 6px rgba(0,0,0,0.18)`
           }}>
        <PinFace badge={badge} />
      </div>
      <div className="text-[11px] font-semibold mt-1.5 leading-tight" style={{ color: st.ring }}>{badge.title}</div>
      <div className="text-[10px] text-gray-500 leading-tight">{badge.kind === 'praise' || badge.kind === 'bigpraise' ? badge.detail : huDate(badge.date)}</div>
    </div>
  );
}

// ─── Panel: a versenyző kitűzői évre ──────────────────────────────────
export function BadgesPanel({ supabase, competitorId, title = 'Kitűzők', reloadKey = 0 }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!competitorId) return undefined;
    let active = true;
    setData(null);
    loadBadgeData(supabase, competitorId)
      .then(d => { if (active) setData(d); })
      .catch(err => { if (active) { setError(err.message); setData({ sessions: [], perf: [], comps: [] }); } });
    return () => { active = false; };
  }, [supabase, competitorId, reloadKey]);

  const years = useMemo(() => {
    if (!data) return [currentYear];
    const s = new Set([currentYear]);
    data.sessions.forEach(x => s.add(parseInt(x.date.slice(0, 4), 10)));
    data.comps.forEach(x => x.date && s.add(parseInt(x.date.slice(0, 4), 10)));
    return Array.from(s).filter(Boolean).sort((a, b) => b - a);
  }, [data, currentYear]);

  if (!data) {
    return (
      <div className="rounded-lg p-3 border flex items-center gap-2 text-sm text-gray-500" style={{ borderColor: '#E5E7EB' }}>
        <Loader className="w-4 h-4 animate-spin" /> Kitűzők betöltése…
      </div>
    );
  }

  const { badges, yearCount, nextMilestone } = computeBadges(data, year);
  const remaining = nextMilestone - yearCount;

  return (
    <div className="rounded-lg p-3 border space-y-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#fafafa' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-sm">📌 {title} ({badges.length})</span>
        <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))}
                className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {error && <div className="text-xs text-red-600">Hiba a betöltéskor: {error}</div>}

      {badges.length === 0 ? (
        <div className="text-xs text-gray-500 italic">Ebben az évben még nincs kitűző — az első már nincs messze! 💪</div>
      ) : (
        <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center sm:justify-start">
          {badges.map(b => <BadgePin key={b.key} badge={b} />)}
        </div>
      )}

      {year === currentYear && (
        <div className="text-xs text-gray-600 bg-white rounded border px-2 py-1.5" style={{ borderColor: '#E5E7EB' }}>
          Idén eddig <b>{yearCount}</b> edzés (edzés, egész napos, tábor) — még <b>{remaining}</b> a következő kitűzőig ({nextMilestone}.).
          {' '}Egy hónapban 12-nél több edzés: dicséret, 20-nál több: nagy dicséret.
        </div>
      )}
    </div>
  );
}
