// ═══════════════════════════════════════════════════════════════════
// Szezon végi összefoglaló (v0.9.66) — gyerekenként egy szép, nyomtatható
// oldal: érmek, versenyek, egyéni csúcsok, fejlődés, edzések, kitűzők,
// kedvencek és célok. „Nyomtatás / mentés PDF-be” gomb: a böngésző
// nyomtatási ablakában „Mentés PDF-ként” választható. Évzáróra, emléknek.
// A versenyző, a szülője és az edzők nyitják meg (pontok is vannak benne).
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Printer, X, FileText } from 'lucide-react';
import { loadBadgeData, computeBadges, BadgePin } from './badges';
import { loadStatsData } from './stats';
import { STORY_KINDS } from './stories';
import { ApparatusIcon } from './apparatusIcons';
import { formatCompetitorName } from './names';
import { CSEPEL_RG_LOGO } from './logos';
import { loadEvaluation } from './evaluation';

const APP_KEYS = ['szabad', 'karika', 'labda', 'buzogany', 'szalag', 'kotel'];
const APP_NAMES = { szabad: 'Szabad', karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél' };
const HU_MONTHS_SHORT = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const f3 = (v) => (v === null || v === undefined ? '—' : v.toFixed(3));
const huDate = (d) => (d ? d.replace(/-/g, '.') + '.' : '');

const PRINT_CSS = `
@media print {
  body > *:not(.season-print-root) { display: none !important; }
  .season-print-root { position: static !important; overflow: visible !important; background: white !important; }
  .season-no-print { display: none !important; }
  .season-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
  .season-block { break-inside: avoid; }
  @page { size: A4; margin: 12mm; }
}`;

function Block({ title, children }) {
  return (
    <div className="season-block mt-5">
      <div className="text-sm font-bold uppercase tracking-wide mb-2 pb-1 border-b-2" style={{ color: '#9D174D', borderColor: '#FBCFE8' }}>{title}</div>
      {children}
    </div>
  );
}

function SeasonSheet({ supabase, competitor, year, variant }) {
  const isParent = variant === 'parent';
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [badgeData, statsData, stories, evaluation] = await Promise.all([
          loadBadgeData(supabase, competitor.id),
          loadStatsData(supabase, competitor.id),
          supabase.from('competitor_stories').select('kind, body, year, achieved').eq('competitor_id', competitor.id),
          loadEvaluation(supabase, competitor.id, year).catch(() => null)
        ]);
        if (active) setState({ badgeData, statsData, stories: stories.error ? [] : (stories.data || []), evaluation });
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, [supabase, competitor.id, year]);

  if (error) return <div className="text-sm text-red-600">Hiba: {error}</div>;
  if (!state) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader className="w-4 h-4 animate-spin" /> Összefoglaló készül…</div>;

  const y = String(year);
  const { badges } = computeBadges(state.badgeData, year);
  const comps = state.badgeData.comps.filter(c => c.date && c.date.startsWith(y)).sort((a, b) => a.date.localeCompare(b.date));
  const medals = { 1: 0, 2: 0, 3: 0 };
  comps.forEach(c => (c.medals || []).forEach(p => { medals[p] += 1; }));
  const perf = state.statsData.perf;
  const apps = APP_KEYS.filter(k => perf.some(p => p.apparatus === k && p.date.startsWith(y)));
  const appRows = apps.map(k => {
    const all = perf.filter(p => p.apparatus === k);
    const cur = all.filter(p => p.date.startsWith(y)).map(p => p.total);
    const prev = all.filter(p => p.date.startsWith(String(year - 1))).map(p => p.total);
    const bestYear = all.filter(p => p.date.startsWith(y)).reduce((b, p) => (!b || p.total > b.total ? p : b), null);
    const bestEver = all.reduce((b, p) => (!b || p.total > b.total ? p : b), null);
    return { k, aCur: avg(cur), aPrev: avg(prev), bestYear, isRecord: bestYear && bestEver && bestYear === bestEver };
  });
  const sessions = state.statsData.sessions.filter(s => s.date.startsWith(y));
  const byMonth = Array.from({ length: 12 }, (_, i) => sessions.filter(s => s.date.slice(5, 7) === String(i + 1).padStart(2, '0')).length);
  const maxMonth = Math.max(1, ...byMonth);
  const stories = state.stories;

  return (
    <div>
      {/* Fejléc */}
      <div className="flex items-center gap-4 pb-3 border-b-4" style={{ borderColor: '#BE123C' }}>
        <img src={CSEPEL_RG_LOGO} alt="" className="w-16 h-16 object-contain" />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-gray-500">Csepeli RG Klub · {isParent ? 'Verseny összesítő' : 'Évösszefoglaló'}</div>
          <div className="text-2xl font-extrabold" style={{ color: '#831843' }}>{formatCompetitorName(competitor)}</div>
          <div className="text-sm text-gray-600">{competitor.kategoria || ''}{competitor.korosztaly ? ` · ${competitor.korosztaly}` : ''}</div>
          {isParent && <div className="text-xs text-gray-500 mt-0.5">A(z) {year}. év eddig rögzített versenyei</div>}
        </div>
        <div className="text-5xl font-black" style={{ color: '#FBCFE8' }}>{year}</div>
      </div>

      {/* Számok */}
      <div className="season-block grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-center">
        {[
          ['🥇', medals[1], 'arany'], ['🥈', medals[2], 'ezüst'], ['🥉', medals[3], 'bronz'],
          ['🏟️', comps.length, 'verseny'], ['💪', sessions.length, 'edzés'], ['📌', badges.length, 'kitűző']
        ].map(([icon, val, label]) => (
          <div key={label} className="rounded-lg border py-2" style={{ borderColor: '#F3F4F6' }}>
            <div className="text-xl">{icon}</div>
            <div className="text-xl font-bold">{val}</div>
            <div className="text-[11px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {comps.length > 0 && (
        <Block title="Versenyeim">
          <div className="space-y-1.5">
            {comps.map((c, i) => (
              <div key={i} className="border-t pt-1.5" style={{ borderColor: '#F3F4F6' }}>
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-500 whitespace-nowrap tabular-nums">{huDate(c.date)}</span>
                  <span className="font-medium flex-1">{c.name}</span>
                </div>
                {(c.items || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1 ml-0 sm:ml-24">
                    {[...c.items].sort((a, b) => a.placement - b.placement).map((it, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap"
                            style={{ borderColor: it.placement <= 3 ? '#FCD34D' : '#E5E7EB', backgroundColor: it.placement <= 3 ? '#FFFBEB' : 'white' }}>
                        {it.placement <= 3 ? ['', '🥇', '🥈', '🥉'][it.placement] + ' ' : ''}
                        <b>{it.placement}. hely</b> · {it.label} · <span className="text-gray-500">{it.group === 'csapat' ? 'csapat' : 'egyéni'}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 mt-0.5 sm:ml-24">nincs rögzített helyezés</div>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {appRows.length > 0 && (
        <Block title="Szereim">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left font-medium py-1">Szer</th>
                <th className="text-right font-medium">{year - 1} átlag</th>
                <th className="text-right font-medium">{year} átlag</th>
                <th className="text-right font-medium">Legjobb {year}-ben</th>
              </tr>
            </thead>
            <tbody>
              {appRows.map(r => (
                <tr key={r.k} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                  <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><ApparatusIcon kind={r.k} size={20} />{APP_NAMES[r.k]}</span></td>
                  <td className="text-right tabular-nums text-gray-500">{f3(r.aPrev)}</td>
                  <td className="text-right tabular-nums font-medium">
                    {f3(r.aCur)}
                    {r.aCur !== null && r.aPrev !== null && (
                      <span className="text-xs ml-1" style={{ color: r.aCur >= r.aPrev ? '#15803D' : '#BE123C' }}>
                        {r.aCur >= r.aPrev ? '▲' : '▼'}
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.bestYear ? <b>{f3(r.bestYear.total)}</b> : '—'}
                    {r.isRecord && <span className="text-xs ml-1" style={{ color: '#D97706' }}>🏆 egyéni csúcs</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      )}

      <Block title="Edzéseim">
        <div className="flex items-end gap-1.5 h-24">
          {byMonth.map((n, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-[10px] font-semibold text-gray-600">{n || ''}</div>
              <div className="w-full rounded-t" style={{ height: `${(n / maxMonth) * 70}%`, backgroundColor: n > 20 ? '#7C3AED' : (n > 12 ? '#15803D' : '#93C5FD'), minHeight: n ? 3 : 0 }} />
              <div className="text-[10px] text-gray-500 mt-0.5">{HU_MONTHS_SHORT[i]}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">Összesen {sessions.length} edzés (edzés, egész napos, tábor).</div>
      </Block>

      {badges.length > 0 && (
        <Block title="Kitűzőim">
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {badges.map(b => <BadgePin key={b.key} badge={b} size={54} />)}
          </div>
        </Block>
      )}

      {stories.length > 0 && (
        <Block title="Rólam">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {STORY_KINDS.map(k => {
              const list = stories.filter(s => s.kind === k.kind && (k.kind !== 'cel' || s.year === year || s.year === year + 1));
              if (list.length === 0) return null;
              return (
                <div key={k.kind}>
                  <div className="text-xs font-semibold text-gray-600">{k.icon} {k.label}</div>
                  {list.map((s, i) => (
                    <div key={i} className={s.achieved ? 'text-gray-500' : ''}>
                      {k.kind === 'cel' && (s.achieved ? '✓ ' : '○ ')}{s.body}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {!isParent && state.evaluation && (
        <Block title="Edzői értékelés">
          <div className="text-sm whitespace-pre-wrap rounded-lg p-3" style={{ backgroundColor: '#EEF2FF', color: '#1E1B4B' }}>{state.evaluation.body}</div>
        </Block>
      )}

      <div className="mt-8 pt-2 border-t text-[10px] text-gray-400 flex justify-between" style={{ borderColor: '#F3F4F6' }}>
        <span>Csepeli RG Klub · Pontregiszter</span>
        <span>Készült: {new Date().toLocaleDateString('hu-HU')}</span>
      </div>
    </div>
  );
}

// variant: 'coach' (évösszefoglaló az edzői értékeléssel) | 'parent' (verseny összesítő, értékelés nélkül)
export function SeasonSummaryButton({ supabase, competitor, defaultYear, variant = 'coach' }) {
  const title = variant === 'parent' ? 'Verseny összesítő' : 'Évösszefoglaló';
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear || currentYear);
  useEffect(() => { if (defaultYear) setYear(defaultYear); }, [defaultYear]);

  // v0.9.68 (Sándor): a mentett PDF neve = a versenyző neve + a választott év
  // (a böngésző a lap címéből adja a fájlnevet); bezáráskor visszaáll
  useEffect(() => {
    if (!open || !competitor?.full_name) return undefined;
    const prev = document.title;
    document.title = `${competitor.full_name} ${year}`;
    return () => { document.title = prev; };
  }, [open, year, competitor?.full_name]);
  if (!competitor?.id) return null;

  return (
    <>
      <button onClick={() => setOpen(true)}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.99]"
              style={{ backgroundColor: '#BE185D' }}>
        <FileText className="w-5 h-5" /> {title} — PDF készítése
      </button>
      {open && createPortal(
        <div className="season-print-root fixed inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
          <style>{PRINT_CSS}</style>
          <div className="season-no-print sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shadow-sm" style={{ borderColor: '#E5E7EB' }}>
            <span className="font-semibold text-sm flex-1">{title}</span>
            <label className="text-sm font-medium" style={{ color: '#9D174D' }}>Válassz évszámot:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))} className="text-sm px-2 py-1 border border-gray-300 rounded bg-white">
              {[0, 1, 2, 3, 4].map(d => currentYear - d).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5" style={{ backgroundColor: '#BE185D' }}>
              <Printer className="w-4 h-4" /> Nyomtatás / mentés PDF-be
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-gray-100" title="Bezárás"><X className="w-5 h-5" /></button>
          </div>
          <div className="season-sheet bg-white max-w-3xl mx-auto my-4 p-6 shadow-lg rounded">
            <SeasonSheet key={year} supabase={supabase} competitor={competitor} year={year} variant={variant} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
