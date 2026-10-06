// ═══════════════════════════════════════════════════════════════════
// Klubstatisztika az edzőknek (v0.9.65) — az Áttekintésen, csak az
// edzői szerepköröknek (admin, szülő-admin, vezetőedző, edző, segédedző):
//   - edzéslátogatás a választott hónapban (ki jár sokat, ki marad el)
//   - éremtáblázat korosztályonként a választott évben
//   - a legtöbbet fejlődő versenyzők (szerenkénti átlag: tavaly → idén)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Loader, BarChart3 } from 'lucide-react';
import { formatCompetitorName, huSortByNickname } from './names';

const APP_KEYS = ['szabad', 'karika', 'labda', 'buzogany', 'szalag', 'kotel'];
const TRAINING_TYPES = ['edzes', 'egesznapos', 'tabor'];
const MONTHLY_TYPES = ['edzes', 'egesznapos'];
const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const AGE_ORDER = ['kisgyermek', 'gyermek', 'serdülő', 'junior', 'felnőtt', 'master'];

const ageRank = (k) => { const i = AGE_ORDER.indexOf(k); return i < 0 ? 99 : i; };
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const pad = (n) => String(n).padStart(2, '0');

export function ClubStatsWidget({ supabase }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('training');

  useEffect(() => {
    let active = true;
    setData(null);
    (async () => {
      try {
        const from = `${year - 1}-01-01`, to = `${year}-12-31`;
        const [comps, att, res, aa, hist] = await Promise.all([
          supabase.from('competitors').select('id, full_name, nickname, korosztaly, kategoria')
            .eq('is_active', true).eq('is_club_member', true),
          supabase.from('training_attendance')
            .select('competitor_id, training_sessions!inner(date, session_type)')
            .gte('training_sessions.date', `${year}-01-01`).lte('training_sessions.date', `${year}-12-31`),
          supabase.from('results')
            .select(`apparatus, placement, score_total,
              startlist_entry:startlist_entries!inner(competitor_id, did_not_start,
                competition_category:competition_categories!inner(type,
                  competition_day:competition_days!inner(
                    competition:competitions!inner(start_date, is_finalized))))`)
            .not('startlist_entry.competitor_id', 'is', null)
            .gte('startlist_entry.competition_category.competition_day.competition.start_date', from)
            .lte('startlist_entry.competition_category.competition_day.competition.start_date', to),
          supabase.from('all_around_results')
            .select(`competitor_id, placement, competition_category:competition_categories!inner(
              competition_day:competition_days!inner(competition:competitions!inner(start_date, is_finalized)))`)
            .gte('competition_category.competition_day.competition.start_date', `${year}-01-01`)
            .lte('competition_category.competition_day.competition.start_date', to),
          supabase.from('historical_results').select('competitor_id, year, competition_date, results')
            .gte('year', year - 1).lte('year', year)
        ]);
        for (const r of [comps, att, res, aa, hist]) if (r.error) throw r.error;
        if (active) setData({ comps: comps.data || [], att: att.data || [], res: res.data || [], aa: aa.data || [], hist: hist.data || [] });
      } catch (err) {
        if (active) { setError(err.message); setData({ comps: [], att: [], res: [], aa: [], hist: [] }); }
      }
    })();
    return () => { active = false; };
  }, [supabase, year]);

  const header = (
    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
      <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1e3a8a' }}>
        <BarChart3 className="w-5 h-5" /> Klubstatisztika
      </h3>
      <div className="flex gap-1.5">
        {tab === 'training' && (
          <select value={month} onChange={e => setMonth(parseInt(e.target.value, 10))} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
            {HU_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}
        <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
          {[0, 1, 2, 3].map(d => now.getFullYear() - d).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );

  const tabs = (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-3 w-fit flex-wrap">
      {[['training', 'Edzéslátogatás'], ['medals', 'Érmek korosztályonként'], ['progress', 'Legtöbbet fejlődők']].map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded text-xs font-medium"
                style={{ backgroundColor: tab === id ? 'white' : 'transparent', color: tab === id ? '#1D4ED8' : '#374151',
                         boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {label}
        </button>
      ))}
    </div>
  );

  if (!data) {
    return (
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E5E7EB' }}>
        {header}
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader className="w-4 h-4 animate-spin" /> Betöltés…</div>
      </div>
    );
  }

  const byId = Object.fromEntries(data.comps.map(c => [c.id, c]));
  const nameOf = (id) => (byId[id] ? formatCompetitorName(byId[id]) : '—');

  // ── Edzéslátogatás a hónapban
  const prefix = `${year}-${pad(month)}`;
  const counts = {};
  data.att.forEach(a => {
    const s = a.training_sessions;
    if (!s || !s.date.startsWith(prefix) || !byId[a.competitor_id]) return;
    const c = counts[a.competitor_id] || (counts[a.competitor_id] = { all: 0, monthly: 0 });
    if (TRAINING_TYPES.includes(s.session_type)) c.all += 1;
    if (MONTHLY_TYPES.includes(s.session_type)) c.monthly += 1;
  });
  const attendance = huSortByNickname(data.comps)
    .map(c => ({ c, n: counts[c.id]?.all || 0, m: counts[c.id]?.monthly || 0 }))
    .sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...attendance.map(a => a.n));

  // ── Érmek korosztályonként (a választott év, egyéni szer + összetett)
  const medals = {};
  const addMedal = (cid, placement) => {
    const comp = byId[cid];
    const p = parseInt(placement, 10);
    if (!comp || !(p >= 1 && p <= 3)) return;
    const k = comp.korosztaly || 'egyéb';
    const m = medals[k] || (medals[k] = { 1: 0, 2: 0, 3: 0 });
    m[p] += 1;
  };
  data.res.forEach(r => {
    const se = r.startlist_entry;
    const comp = se?.competition_category?.competition_day?.competition;
    if (!comp || !comp.is_finalized || se.did_not_start || !comp.start_date.startsWith(String(year))) return;
    if (se.competition_category.type === 'csapat') return;
    addMedal(se.competitor_id, r.placement);
  });
  data.aa.forEach(a => {
    const comp = a.competition_category?.competition_day?.competition;
    if (comp && comp.is_finalized && comp.start_date.startsWith(String(year))) addMedal(a.competitor_id, a.placement);
  });
  data.hist.filter(h => h.year === year).forEach(h => {
    const r = h.results || {};
    [...APP_KEYS, 'osszetett'].forEach(k => addMedal(h.competitor_id, r[k]?.placement));
  });
  const medalRows = Object.keys(medals)
    .sort((a, b) => ageRank(a) - ageRank(b));

  // ── Legtöbbet fejlődők: szerenkénti átlag (tavaly → idén), a szerek változásának átlaga
  const scores = {}; // cid → app → year → [pont]
  const addScore = (cid, app, y, s) => {
    if (!byId[cid] || s === null) return;
    ((scores[cid] = scores[cid] || {})[app] = scores[cid][app] || {});
    (scores[cid][app][y] = scores[cid][app][y] || []).push(s);
  };
  data.res.forEach(r => {
    const se = r.startlist_entry;
    const comp = se?.competition_category?.competition_day?.competition;
    if (!comp || !comp.is_finalized || se.did_not_start || se.competition_category.type === 'csapat') return;
    if (!APP_KEYS.includes(r.apparatus)) return;
    addScore(se.competitor_id, r.apparatus, parseInt(comp.start_date.slice(0, 4), 10), num(r.score_total));
  });
  data.hist.forEach(h => {
    const r = h.results || {};
    APP_KEYS.forEach(k => addScore(h.competitor_id, k, h.year, num(r[k]?.score)));
  });
  const progress = Object.entries(scores).map(([cid, apps]) => {
    const deltas = Object.values(apps)
      .map(y => (y[year] && y[year - 1] ? avg(y[year]) - avg(y[year - 1]) : null))
      .filter(d => d !== null);
    return { cid, delta: avg(deltas), n: deltas.length };
  }).filter(p => p.delta !== null).sort((a, b) => b.delta - a.delta);

  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E5E7EB' }}>
      {header}
      {tabs}
      {error && <div className="text-xs text-red-600 mb-2">Hiba a betöltéskor: {error}</div>}

      {tab === 'training' && (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            {year}. {HU_MONTHS[month - 1]} — edzés + egész napos + tábor. ⭐ dicséret: több mint 12, 🌟 nagy dicséret: több mint 20 (edzés + egész napos).
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {attendance.map(({ c, n, m }) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <div className="w-40 truncate" title={formatCompetitorName(c)}>{formatCompetitorName(c)}</div>
                <div className="flex-1 h-3 rounded bg-gray-100 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(n / maxN) * 100}%`, backgroundColor: n === 0 ? 'transparent' : (m > 20 ? '#7C3AED' : (m > 12 ? '#15803D' : '#93C5FD')) }} />
                </div>
                <div className="w-14 text-right tabular-nums font-medium" style={{ color: n === 0 ? '#BE123C' : '#374151' }}>
                  {n}{m > 20 ? ' 🌟' : (m > 12 ? ' ⭐' : '')}
                </div>
              </div>
            ))}
          </div>
          {attendance.some(a => a.n === 0) && (
            <div className="text-[11px] mt-2" style={{ color: '#BE123C' }}>
              Ebben a hónapban nem volt edzésen: {attendance.filter(a => a.n === 0).length} versenyző.
            </div>
          )}
        </div>
      )}

      {tab === 'medals' && (
        medalRows.length === 0 ? (
          <div className="text-xs text-gray-500 italic">{year}-ben még nincs érem lezárt versenyről.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left font-medium py-1">Korosztály</th>
                <th className="text-center font-medium">🥇</th>
                <th className="text-center font-medium">🥈</th>
                <th className="text-center font-medium">🥉</th>
                <th className="text-center font-medium">Össz.</th>
              </tr>
            </thead>
            <tbody>
              {medalRows.map(k => (
                <tr key={k} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                  <td className="py-1.5 capitalize">{k}</td>
                  <td className="text-center tabular-nums">{medals[k][1]}</td>
                  <td className="text-center tabular-nums">{medals[k][2]}</td>
                  <td className="text-center tabular-nums">{medals[k][3]}</td>
                  <td className="text-center tabular-nums font-semibold">{medals[k][1] + medals[k][2] + medals[k][3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'progress' && (
        progress.length === 0 ? (
          <div className="text-xs text-gray-500 italic">Ehhez kell pont {year - 1}-ből és {year}-ből is ugyanazon a szeren.</div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-2">Szerenként az átlagpont változása {year - 1} → {year}, a szerek átlaga.</div>
            <div className="space-y-1">
              {progress.slice(0, 10).map((p, i) => (
                <div key={p.cid} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-right text-gray-400 tabular-nums">{i + 1}.</span>
                  <span className="flex-1 truncate">{nameOf(p.cid)}</span>
                  <span className="text-[10px] text-gray-400">{p.n} szer</span>
                  <span className="w-20 text-right font-semibold tabular-nums" style={{ color: p.delta >= 0 ? '#15803D' : '#BE123C' }}>
                    {p.delta >= 0 ? '▲ +' : '▼ '}{p.delta.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
