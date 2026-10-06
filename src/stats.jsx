// ═══════════════════════════════════════════════════════════════════
// Statisztikák a versenyzőnél (v0.9.65) — Sándor 2026.10.06: „mind mehet”
//   1) szerenkénti fejlődés: tavalyi és idei átlag, változás nyíllal
//   2) D / A / E bontás: szerenként az átlagok, hol a legnagyobb tartalék
//   3) egyéni csúcsok: szerenként a legjobb pont dátummal
//   4) edzés és eredmény együtt: havi edzésszám + az abban a hónapban elért
//      versenypontok átlaga egy grafikonon
// Csak lezárt versenyek pontjai (+ a korábbi eredmények pontjai); a D/A/E
// csak a programban pontozott versenyekből van. A versenyző, a szülője és az
// edzők látják (a pontokat a klubtársak nem).
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { Loader, BarChart3 } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ApparatusIcon } from './apparatusIcons';

const APP_KEYS = ['szabad', 'karika', 'labda', 'buzogany', 'szalag', 'kotel'];
const APP_NAMES = { szabad: 'Szabad', karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél' };
const HU_MONTHS_SHORT = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
const TRAINING_TYPES = ['edzes', 'egesznapos', 'tabor'];

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const f3 = (v) => (v === null || v === undefined ? '—' : v.toFixed(3));
const f2 = (v) => (v === null || v === undefined ? '—' : v.toFixed(2));
const huDate = (d) => (d ? d.replace(/-/g, '.') + '.' : '');

async function loadStatsData(supabase, competitorId) {
  const [res, hist, att] = await Promise.all([
    supabase.from('results')
      .select(`apparatus, score_total, score_d, score_a, score_e, score_p,
        startlist_entry:startlist_entries!inner(competitor_id, did_not_start,
          competition_category:competition_categories!inner(type,
            competition_day:competition_days!inner(
              competition:competitions!inner(id, name, start_date, is_finalized))))`)
      .eq('startlist_entry.competitor_id', competitorId),
    supabase.from('historical_results').select('year, competition_date, competition_name, results').eq('competitor_id', competitorId),
    supabase.from('training_attendance')
      .select('training_sessions!inner(date, session_type)')
      .eq('competitor_id', competitorId)
  ]);
  for (const r of [res, hist, att]) if (r.error) throw r.error;

  const perf = [];
  (res.data || []).forEach(r => {
    const se = r.startlist_entry;
    const comp = se?.competition_category?.competition_day?.competition;
    if (!comp || !comp.is_finalized || se.did_not_start) return;
    if (se.competition_category.type === 'csapat' || !APP_KEYS.includes(r.apparatus)) return;
    const total = num(r.score_total);
    if (total === null) return;
    perf.push({
      date: comp.start_date, comp: comp.name, apparatus: r.apparatus, total,
      d: num(r.score_d), a: num(r.score_a), e: num(r.score_e), p: num(r.score_p), live: true
    });
  });
  (hist.data || []).forEach(h => {
    const date = h.competition_date || (h.year ? `${h.year}-01-01` : null);
    if (!date) return;
    const r = h.results || {};
    APP_KEYS.forEach(k => {
      const total = num(r[k]?.score);
      if (total !== null) perf.push({ date, comp: h.competition_name, apparatus: k, total, live: false });
    });
  });
  perf.sort((a, b) => a.date.localeCompare(b.date));

  const sessions = (att.data || []).map(a => a.training_sessions).filter(s => s && s.date && TRAINING_TYPES.includes(s.session_type));
  return { perf, sessions };
}

function Section({ title, children, hint }) {
  return (
    <div className="bg-white rounded border p-2.5" style={{ borderColor: '#E5E7EB' }}>
      <div className="text-xs font-semibold text-gray-700 mb-1.5">{title}</div>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-1.5">{hint}</div>}
    </div>
  );
}

function Delta({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  const up = value > 0.0005, down = value < -0.0005;
  const color = up ? '#15803D' : (down ? '#BE123C' : '#6B7280');
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {up ? '▲ +' : (down ? '▼ ' : '')}{value.toFixed(3)}
    </span>
  );
}

export function CompetitorStatsPanel({ supabase, competitorId }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!competitorId) return undefined;
    let active = true;
    setData(null);
    loadStatsData(supabase, competitorId)
      .then(d => { if (active) setData(d); })
      .catch(err => { if (active) { setError(err.message); setData({ perf: [], sessions: [] }); } });
    return () => { active = false; };
  }, [supabase, competitorId]);

  const years = useMemo(() => {
    const s = new Set([currentYear]);
    (data?.perf || []).forEach(p => s.add(parseInt(p.date.slice(0, 4), 10)));
    return Array.from(s).sort((a, b) => b - a);
  }, [data, currentYear]);

  if (!data) {
    return (
      <div className="rounded-lg p-3 border flex items-center gap-2 text-sm text-gray-500" style={{ borderColor: '#E5E7EB' }}>
        <Loader className="w-4 h-4 animate-spin" /> Statisztika betöltése…
      </div>
    );
  }

  const inYear = (p, y) => p.date.slice(0, 4) === String(y);
  const apps = APP_KEYS.filter(k => data.perf.some(p => p.apparatus === k));

  // 1) fejlődés + 3) csúcsok
  const rows = apps.map(k => {
    const all = data.perf.filter(p => p.apparatus === k);
    const cur = all.filter(p => inYear(p, year)).map(p => p.total);
    const prev = all.filter(p => inYear(p, year - 1)).map(p => p.total);
    const best = all.reduce((b, p) => (!b || p.total > b.total ? p : b), null);
    const aCur = avg(cur), aPrev = avg(prev);
    return { k, aCur, aPrev, delta: aCur !== null && aPrev !== null ? aCur - aPrev : null, nCur: cur.length, best };
  });

  // 2) D/A/E (a választott év, csak programban pontozott)
  const dae = apps.map(k => {
    const list = data.perf.filter(p => p.apparatus === k && p.live && inYear(p, year));
    const pick = (f) => avg(list.map(p => p[f]).filter(v => v !== null));
    return { k, n: list.length, d: pick('d'), a: pick('a'), e: pick('e'), p: pick('p') };
  }).filter(r => r.n > 0);
  const eAll = avg(dae.map(r => r.e).filter(v => v !== null));
  const aAll = avg(dae.map(r => r.a).filter(v => v !== null));
  let insight = null;
  if (eAll !== null || aAll !== null) {
    const eLoss = eAll !== null ? 10 - eAll : -1;
    const aLoss = aAll !== null ? 10 - aAll : -1;
    insight = eLoss >= aLoss
      ? `A legnagyobb tartalék a kivitelben (E) van: átlagosan ${eLoss.toFixed(2)} pont levonás a 10-ből.`
      : `A legnagyobb tartalék a művészi értékben (A) van: átlagosan ${aLoss.toFixed(2)} pont levonás a 10-ből.`;
  }

  // 4) edzés és eredmény havonta (a választott év)
  const lastMonth = year === currentYear ? new Date().getMonth() + 1 : 12;
  const chart = Array.from({ length: lastMonth }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const prefix = `${year}-${m}`;
    const trainings = data.sessions.filter(s => s.date.startsWith(prefix)).length;
    const scores = data.perf.filter(p => p.date.startsWith(prefix)).map(p => p.total);
    const a = avg(scores);
    return { name: HU_MONTHS_SHORT[i], edzes: trainings, pont: a !== null ? Number(a.toFixed(3)) : null };
  });
  const hasChartData = chart.some(c => c.edzes > 0 || c.pont !== null);

  return (
    <div className="rounded-lg p-3 border space-y-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#fafafa' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: '#1D4ED8' }} /> Statisztika
        </span>
        <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))}
                className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {error && <div className="text-xs text-red-600">Hiba a betöltéskor: {error}</div>}

      {apps.length === 0 ? (
        <div className="text-xs text-gray-500 italic">Még nincs lezárt versenyből egyéni pontszám.</div>
      ) : (
        <>
          <Section title={`Fejlődés szerenként — ${year - 1} → ${year} (átlag)`}
                   hint="Átlag = az adott évben az adott szeren elért pontok átlaga (lezárt versenyek + korábbi eredmények).">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-medium py-1">Szer</th>
                    <th className="text-right font-medium py-1">{year - 1}</th>
                    <th className="text-right font-medium py-1">{year}</th>
                    <th className="text-right font-medium py-1">Változás</th>
                    <th className="text-right font-medium py-1 pl-2">Egyéni csúcs</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.k} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                      <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><ApparatusIcon kind={r.k} size={20} />{APP_NAMES[r.k]}</span></td>
                      <td className="text-right tabular-nums text-gray-600">{f3(r.aPrev)}</td>
                      <td className="text-right tabular-nums font-medium">{f3(r.aCur)}{r.nCur > 0 && <span className="text-[10px] text-gray-400"> ({r.nCur}×)</span>}</td>
                      <td className="text-right"><Delta value={r.delta} /></td>
                      <td className="text-right pl-2">
                        {r.best && (
                          <span title={r.best.comp}>
                            <span className="font-semibold tabular-nums" style={{ color: '#D97706' }}>🏆 {f3(r.best.total)}</span>
                            <span className="text-[10px] text-gray-400 block">{huDate(r.best.date)}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Pontösszetevők (D / A / E) — ${year}`}
                   hint="Csak a programban pontozott versenyekből; A és E legfeljebb 10.">
            {dae.length === 0 ? (
              <div className="text-xs text-gray-500 italic">Ebben az évben nincs részletes (D/A/E) pontozás.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-medium py-1">Szer</th>
                        <th className="text-right font-medium py-1">D</th>
                        <th className="text-right font-medium py-1">A</th>
                        <th className="text-right font-medium py-1">E</th>
                        <th className="text-right font-medium py-1">P (−)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dae.map(r => (
                        <tr key={r.k} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                          <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><ApparatusIcon kind={r.k} size={20} />{APP_NAMES[r.k]}</span></td>
                          <td className="text-right tabular-nums">{f2(r.d)}</td>
                          <td className="text-right tabular-nums">{f2(r.a)}</td>
                          <td className="text-right tabular-nums">{f2(r.e)}</td>
                          <td className="text-right tabular-nums text-gray-500">{r.p ? f2(r.p) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {insight && <div className="text-xs mt-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>💡 {insight}</div>}
              </>
            )}
          </Section>
        </>
      )}

      <Section title={`Edzés és eredmény — ${year} havonta`}
               hint="Oszlop: edzések száma (edzés, egész napos, tábor). Vonal: az abban a hónapban versenyen elért pontok átlaga.">
        {hasChartData ? (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v, n) => (n === 'Átlagpont' ? Number(v).toFixed(3) : v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="edzes" name="Edzés" fill="#93C5FD" radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" dataKey="pont" name="Átlagpont" stroke="#BE123C" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic">Ebben az évben még nincs adat.</div>
        )}
      </Section>
    </div>
  );
}
