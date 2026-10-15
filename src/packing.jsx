// ═══════════════════════════════════════════════════════════════════
// Versenyre készülés (v1.1.0) — Sándor 2026.10.15: a gyerek következő
// versenye (ahol a startlistán szerepel, egyéniben vagy csapatban):
// visszaszámláló, gyülekező, helyszín, rajtidők, és pipálható pakolólista
// (alap tételek + a versenyen használt szerek + saját tételek).
// A listát a gyerek és a szülője közösen pipálja (packing_lists tábla); a saját
// tételek a gyerekhez mentődnek (competitor_packing_items), minden versenyre.
// A gyereknél csak a verseny előtti 5 napban jelenik meg (Sándor).
// Adatbázis: docs/sql/2026-10-15_v1.1.0_pakolo-lista.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Luggage, Check, Plus, X, MapPin, Clock, CalendarDays, AlertTriangle } from 'lucide-react';
import { ApparatusIcon } from './apparatusIcons';

const PINK = '#BE185D';
const KID_DAYS_BEFORE = 5;   // a gyereknél ennyi nappal a verseny előtt jelenik meg
const BASE_ITEMS = [
  { key: 'dressz', label: 'Versenydressz' },
  { key: 'melegito', label: 'Klubmelegítő' },
  { key: 'cipo', label: 'Fél-spicc / tornacipő' },
  { key: 'haj', label: 'Hajháló, hajtű, hajgumi, hajlakk' },
  { key: 'smink', label: 'Smink (ha kell)' },
  { key: 'engedely', label: 'Versenyengedély' },
  { key: 'kulacs', label: 'Kulacs vízzel' },
  { key: 'uzsonna', label: 'Uzsonna, gyümölcs' },
  { key: 'tape', label: 'Tapasz, sportszalag' },
  { key: 'torolkozo', label: 'Törölköző' },
  { key: 'zene', label: 'A zenéim a telefonon (tartalék)' }
];
const APP_ITEMS = {
  karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány (2 db)',
  szalag: 'Szalag + pálca (és tartalék szalag)', kotel: 'Kötél'
};
const NEST = `apparatus, start_time, did_not_start,
  competition_category:competition_categories!inner(
    competition_day:competition_days!inner(date,
      competition:competitions!inner(id, name, start_date, end_date, arrival_info, arrival_time, venue:venues(name, city))))`;

const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const huDate = (s) => (s ? s.replace(/-/g, '.') + '.' : '');
const daysUntil = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 86400000);
};
const appKeysOf = (s) => Object.keys(APP_ITEMS).filter(k => (s || '').toLowerCase().includes(k));
const appLabel = (s) => (s || '').split('+').map(x => ({ szabad: 'Szabad', karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél' }[x.trim()] || x.trim())).join(' + ');

// A gyerek következő versenye a startlista alapján (egyéni + csapat)
async function loadNextCompetition(supabase, competitorId) {
  const [ind, mem] = await Promise.all([
    supabase.from('startlist_entries').select(NEST).eq('competitor_id', competitorId),
    supabase.from('competition_team_members').select('team_id').eq('competitor_id', competitorId)
  ]);
  let rows = (ind.data || []).map(r => ({ ...r, team: false }));
  const teamIds = (mem.data || []).map(m => m.team_id).filter(Boolean);
  if (teamIds.length) {
    const { data } = await supabase.from('startlist_entries').select(NEST).in('team_id', teamIds);
    rows = rows.concat((data || []).map(r => ({ ...r, team: true })));
  }
  const today = todayIso();
  rows = rows.filter(r => !r.did_not_start && (r.competition_category?.competition_day?.competition?.end_date || '') >= today);
  if (rows.length === 0) return null;
  const comp = (r) => r.competition_category.competition_day.competition;
  rows.sort((a, b) => comp(a).start_date.localeCompare(comp(b).start_date));
  const c = comp(rows[0]);
  const starts = rows.filter(r => comp(r).id === c.id).map(r => ({
    date: r.competition_category.competition_day.date, time: r.start_time, apparatus: r.apparatus, team: r.team
  })).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  const apps = [...new Set(starts.flatMap(s => appKeysOf(s.apparatus)))];
  return { competition: c, starts, apps };
}

export function PackingCard({ supabase, competitorId, forParent = false }) {
  const [next, setNext] = useState(undefined);
  const [list, setList] = useState({ checked: [], extra: [] });   // extra = a gyerek saját tételei
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    loadNextCompetition(supabase, competitorId)
      .then(n => { if (active) setNext(n); })
      .catch(() => { if (active) setNext(null); });
    return () => { active = false; };
  }, [supabase, competitorId]);

  const compId = next?.competition?.id;
  useEffect(() => {
    if (!compId) return;
    Promise.all([
      supabase.from('packing_lists').select('checked').eq('competitor_id', competitorId).eq('competition_id', compId).maybeSingle(),
      supabase.from('competitor_packing_items').select('items').eq('competitor_id', competitorId).maybeSingle()
    ]).then(([l, own]) => setList({ checked: l.data?.checked || [], extra: own.data?.items || [] }));
  }, [supabase, competitorId, compId]);

  const save = useCallback(async (nextList) => {
    setList(nextList);
    setError(null);
    const { error: err } = await supabase.from('packing_lists').upsert({
      competitor_id: competitorId, competition_id: compId, checked: nextList.checked, updated_at: new Date().toISOString()
    }, { onConflict: 'competitor_id,competition_id' });
    if (err) setError('Mentés nem sikerült: ' + err.message);
  }, [supabase, competitorId, compId]);
  // A saját tételek a gyerekhez mentődnek — minden versenyre megjelennek
  const saveOwn = useCallback(async (items, checked) => {
    setList({ checked, extra: items });
    setError(null);
    const { error: err } = await supabase.from('competitor_packing_items').upsert({
      competitor_id: competitorId, items, updated_at: new Date().toISOString()
    }, { onConflict: 'competitor_id' });
    if (err) setError('Mentés nem sikerült: ' + err.message);
  }, [supabase, competitorId]);

  if (!next) return null;
  const c = next.competition;
  const d = daysUntil(c.start_date);
  if (!forParent && d > KID_DAYS_BEFORE) return null;
  const items = [
    ...BASE_ITEMS,
    ...next.apps.map(k => ({ key: `app_${k}`, label: APP_ITEMS[k], app: k })),
    ...list.extra.map((label, i) => ({ key: `x_${label}`, label, extraIndex: i }))
  ];
  const done = items.filter(it => list.checked.includes(it.key)).length;
  const all = done === items.length;
  const toggle = (key) => save({ ...list, checked: list.checked.includes(key) ? list.checked.filter(k => k !== key) : [...list.checked, key] });
  const addItem = () => {
    const label = newItem.trim().slice(0, 60);
    if (!label || list.extra.includes(label) || list.extra.length >= 20) return;
    setNewItem('');
    saveOwn([...list.extra, label], list.checked);
  };
  const removeItem = async (label) => {
    if (!window.confirm(`Törlöd a saját listádról: „${label}”? (Minden versenynél eltűnik.)`)) return;
    const checked = list.checked.filter(k => k !== `x_${label}`);
    await saveOwn(list.extra.filter(x => x !== label), checked);
    if (checked.length !== list.checked.length) save({ checked, extra: list.extra.filter(x => x !== label) });
  };

  const countdown = d > 1 ? `még ${d} nap` : d === 1 ? 'HOLNAP!' : d === 0 ? 'MA!' : 'most zajlik';
  const venue = [c.venue?.name, c.venue?.city].filter(Boolean).join(', ');

  return (
    <div className="rounded-2xl border-2 p-4 bg-white shadow-sm" style={{ borderColor: '#F9A8D4' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: PINK }}>{forParent ? 'Versenyre készülés' : '🎒 Versenyre készülök'}</div>
          <div className="text-lg font-bold text-gray-900">{c.name}</div>
          <div className="text-sm text-gray-600 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {huDate(c.start_date)}{c.end_date && c.end_date !== c.start_date ? ` – ${huDate(c.end_date).slice(5)}` : ''}</div>
          {venue && <div className="text-sm text-gray-600 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {venue}</div>}
          {(c.arrival_time || c.arrival_info) && (
            <div className="text-sm text-gray-800 flex items-start gap-1.5 mt-0.5"><Clock className="w-4 h-4 mt-0.5" />
              <span><b>Gyülekező:</b> {c.arrival_time ? String(c.arrival_time).slice(0, 5) : ''}{c.arrival_time && c.arrival_info ? ' · ' : ''}{c.arrival_info || ''}</span>
            </div>
          )}
        </div>
        <div className="text-center px-4 py-2 rounded-xl text-white font-bold shadow-sm" style={{ backgroundColor: PINK }}>
          <div className="text-xl leading-tight">{countdown}</div>
        </div>
      </div>

      {next.starts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {next.starts.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-900 font-semibold">
              {appKeysOf(s.apparatus)[0] ? <ApparatusIcon kind={appKeysOf(s.apparatus)[0]} size={18} /> : null}
              {s.team ? 'Csapat' : ''}{s.team && s.apparatus ? ': ' : ''}{appLabel(s.apparatus)}
              {s.time && <span className="text-blue-700">· {String(s.time).slice(0, 5)}</span>}
              {c.end_date !== c.start_date && s.date && <span className="font-normal text-blue-700">({huDate(s.date).slice(5)})</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border-2 px-3 py-2.5 flex items-start gap-2 text-sm font-semibold"
           style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB', color: '#92400E' }}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>{forParent
          ? 'Ellenőrizzétek, hogy minden megvan-e a versenyre! Ha valami hiányzik, szerezzétek be időben!'
          : 'Ellenőrizd, hogy mindened megvan-e a versenyre! Ha valami hiányzik, szerezd be időben!'}</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2" style={{ color: PINK }}><Luggage className="w-5 h-5" /> Pakolólista</div>
        <div className="text-sm font-semibold" style={{ color: all ? '#047857' : '#6B7280' }}>{all ? '✓ Minden bepakolva!' : `${done} / ${items.length}`}</div>
      </div>
      <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(done / items.length * 100)}%`, backgroundColor: all ? '#10B981' : PINK }} />
      </div>
      <div className="mt-2 grid sm:grid-cols-2 gap-1.5">
        {items.map(it => {
          const on = list.checked.includes(it.key);
          return (
            <div key={it.key} className="flex items-center gap-1">
              <button onClick={() => toggle(it.key)}
                      className="flex-1 flex items-center gap-2 text-left text-sm px-2.5 py-2 rounded-lg border-2 transition"
                      style={{ borderColor: on ? '#10B981' : '#E5E7EB', backgroundColor: on ? '#ECFDF5' : 'white' }}>
                <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: on ? '#10B981' : '#D1D5DB', backgroundColor: on ? '#10B981' : 'white' }}>
                  {on && <Check className="w-3.5 h-3.5 text-white" />}
                </span>
                {it.app && <ApparatusIcon kind={it.app} size={18} />}
                <span className={on ? 'line-through text-gray-500' : 'text-gray-900'}>{it.label}</span>
              </button>
              {it.extraIndex !== undefined && (
                <button onClick={() => removeItem(it.label)} className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-red-50" title="Tétel törlése">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
               placeholder="Saját tétel (megmarad a többi versenyre is)" maxLength={60}
               className="flex-1 text-sm px-2.5 py-2 border border-gray-300 rounded-lg" />
        <button onClick={addItem} disabled={!newItem.trim()} className="px-3 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1 shadow-sm disabled:opacity-40" style={{ backgroundColor: PINK }}>
          <Plus className="w-4 h-4" /> Hozzáad
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-2">{forParent ? 'A gyermekeddel közös lista — amit ő kipipál, itt is látszik. A saját tételek a többi versenyre is megmaradnak.' : 'A szüleiddel közös lista — amit ők kipipálnak, nálad is látszik. A saját tételeid a többi versenyre is megmaradnak.'}</div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
