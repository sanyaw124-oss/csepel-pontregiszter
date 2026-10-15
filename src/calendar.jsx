// ═══════════════════════════════════════════════════════════════════
// Versenynaptár (v0.9.81) — Kata + Sándor 2026.10.15:
//   - saját oldal (havi naptár + a hónap versenyei), jelentkezés nélkül;
//   - a Versenyek fülön felvett verseny magától megjelenik (ugyanaz a tábla);
//   - az Áttekintésen csak a következő 30 nap versenyei, kattintásra a naptár.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock, X, Loader } from 'lucide-react';

const IMP = {
  fig: { bg: '#fef3c7', text: '#92400e', label: 'FIG nemzetközi' },
  nemzetkozi: { bg: '#ffedd5', text: '#9a3412', label: 'Nemzetközi' },
  mrgsz_mb: { bg: '#dbeafe', text: '#1e40af', label: 'Magyar Bajnokság' },
  mrgsz_kupa: { bg: '#e0f2fe', text: '#075985', label: 'Magyar Kupa' },
  mrgsz_reg: { bg: '#e0e7ff', text: '#3730a3', label: 'Regionális' },
  diakolimpia: { bg: '#fce7f3', text: '#9d174d', label: 'Diákolimpia' },
  klub: { bg: '#d1fae5', text: '#065f46', label: 'Klubverseny' },
  egyeb: { bg: '#f3f4f6', text: '#374151', label: 'Egyéb' }
};
// v0.9.81 (Sándor): a naptárban erőteljes, telt bejegyzés
const SOLID = { fig: '#B45309', nemzetkozi: '#C2410C', mrgsz_mb: '#1D4ED8', mrgsz_kupa: '#0369A1', mrgsz_reg: '#4338CA',
                diakolimpia: '#BE185D', klub: '#047857', egyeb: '#4B5563' };
const solid = (v) => SOLID[{ mrgsz_regional: 'mrgsz_reg', club: 'klub' }[v] || v] || SOLID.egyeb;
const imp = (v) => IMP[{ mrgsz_regional: 'mrgsz_reg', club: 'klub' }[v] || v] || IMP.egyeb;
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const BLUE = '#1e3a8a';
const SELECT = 'id, name, importance, start_date, end_date, arrival_info, arrival_time, venue:venues(name, city)';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const huDate = (s) => (s ? s.replace(/-/g, '.') + '.' : '');
const dateRange = (c) => (c.end_date && c.end_date !== c.start_date ? `${huDate(c.start_date)} – ${huDate(c.end_date).slice(5)}` : huDate(c.start_date));
const venueText = (c) => [c.venue?.name, c.venue?.city].filter(Boolean).join(', ');

function ImpChip({ value }) {
  const i = imp(value);
  return <span className="text-[11px] px-2 py-0.5 rounded font-semibold whitespace-nowrap text-white" style={{ backgroundColor: solid(value) }}>{i.label}</span>;
}

function CompetitionDetail({ comp, onClose, onOpenCompetitions }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-lg font-bold" style={{ color: BLUE }}>{comp.name}</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <ImpChip value={comp.importance} />
        <div className="text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-gray-400" /> {dateRange(comp)}</div>
        {venueText(comp) && <div className="text-sm flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> {venueText(comp)}</div>}
        {(comp.arrival_time || comp.arrival_info) && (
          <div className="text-sm flex items-start gap-1.5"><Clock className="w-4 h-4 text-gray-400 mt-0.5" />
            <span>{comp.arrival_time ? `Érkezés: ${String(comp.arrival_time).slice(0, 5)}` : ''}{comp.arrival_time && comp.arrival_info ? ' · ' : ''}{comp.arrival_info || ''}</span>
          </div>
        )}
        {onOpenCompetitions && (
          <button onClick={onOpenCompetitions} className="mt-2 px-3 py-1.5 rounded text-white text-sm font-medium" style={{ backgroundColor: BLUE }}>
            Startlista és részletek a Versenyek fülön →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── A naptár oldal ───────────────────────────────────────────────────
export function CalendarView({ supabase, onOpenCompetitions }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [comps, setComps] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const first = new Date(ym.y, ym.m, 1);
  const last = new Date(ym.y, ym.m + 1, 0);
  const from = iso(first), to = iso(last);

  useEffect(() => {
    let active = true;
    setComps(null);
    supabase.from('competitions').select(SELECT)
      .lte('start_date', to).gte('end_date', from).order('start_date')
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) { setError(err.message); setComps([]); } else { setError(null); setComps(data || []); }
      });
    return () => { active = false; };
  }, [supabase, from, to]);

  // A rács: hétfővel kezdődő hetek
  const cells = useMemo(() => {
    const lead = (first.getDay() + 6) % 7;
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) out.push(iso(new Date(ym.y, ym.m, d)));
    while (out.length % 7) out.push(null);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.y, ym.m]);
  const onDay = (day) => (comps || []).filter(c => c.start_date <= day && (c.end_date || c.start_date) >= day);
  const today = iso(now);
  const shift = (d) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: BLUE }}><CalendarDays className="w-6 h-6" /> Versenynaptár</h2>
      <div className="bg-white rounded-xl border p-3 sm:p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shift(-1)} className="px-3 py-2 rounded-lg text-white font-medium flex items-center gap-1 shadow-sm hover:opacity-90" style={{ backgroundColor: BLUE }} aria-label="Előző hónap"><ChevronLeft className="w-5 h-5" /><span className="hidden sm:inline text-sm">Előző</span></button>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: BLUE }}>{ym.y}. {MONTHS[ym.m]}</div>
            {(ym.y !== now.getFullYear() || ym.m !== now.getMonth()) && (
              <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} className="mt-1 text-xs px-2 py-1 rounded border font-medium bg-white hover:bg-blue-50" style={{ borderColor: BLUE, color: BLUE }}>Vissza a mai hónapra</button>
            )}
          </div>
          <button onClick={() => shift(1)} className="px-3 py-2 rounded-lg text-white font-medium flex items-center gap-1 shadow-sm hover:opacity-90" style={{ backgroundColor: BLUE }} aria-label="Következő hónap"><span className="hidden sm:inline text-sm">Következő</span><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-1">
          {DAYS.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const list = onDay(day);
            const isToday = day === today;
            return (
              <div key={day} className="min-h-[64px] sm:min-h-[84px] rounded border p-1 text-left"
                   style={{ borderColor: isToday ? BLUE : '#E5E7EB', borderWidth: isToday ? 2 : 1, backgroundColor: list.length ? '#EFF6FF' : 'white' }}>
                <div className="text-[11px] font-semibold" style={{ color: isToday ? BLUE : '#6B7280' }}>{parseInt(day.slice(8), 10)}</div>
                <div className="space-y-0.5">
                  {list.map(c => (
                    <button key={c.id} onClick={() => setSelected(c)} title={c.name}
                            className="block w-full text-left text-[10px] sm:text-xs font-semibold leading-tight px-1.5 py-1 rounded truncate shadow-sm hover:brightness-110"
                            style={{ backgroundColor: solid(c.importance), color: 'white' }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="font-semibold mb-2" style={{ color: BLUE }}>A hónap versenyei · {ym.y}. {MONTHS[ym.m]}</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {comps === null ? <Loader className="w-5 h-5 animate-spin text-gray-400" /> : comps.length === 0 ? (
          <div className="text-sm text-gray-400 italic">Ebben a hónapban nincs verseny.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {comps.map(c => (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-gray-50 rounded px-1">
                <div className="text-sm font-semibold w-28 flex-shrink-0 text-gray-700">{dateRange(c)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  {venueText(c) && <div className="text-xs text-gray-500 truncate">{venueText(c)}</div>}
                </div>
                <ImpChip value={c.importance} />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <CompetitionDetail comp={selected} onClose={() => setSelected(null)}
                                      onOpenCompetitions={onOpenCompetitions ? () => { setSelected(null); onOpenCompetitions(); } : null} />}
    </div>
  );
}

// ─── Áttekintés: a következő 30 nap versenyei ─────────────────────────
export function UpcomingCompetitionsWidget({ supabase, onOpen }) {
  const [comps, setComps] = useState(null);
  useEffect(() => {
    let active = true;
    const t = new Date();
    const until = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30);
    supabase.from('competitions').select(SELECT)
      .gte('end_date', iso(t)).lte('start_date', iso(until)).order('start_date')
      .then(({ data }) => { if (active) setComps(data || []); });
    return () => { active = false; };
  }, [supabase]);
  if (!comps) return null;
  return (
    <div className="bg-white rounded-xl border p-4 mb-4 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
      <button onClick={onOpen} className="w-full flex items-center justify-between gap-2 mb-2 text-left">
        <div className="font-semibold flex items-center gap-2" style={{ color: BLUE }}><CalendarDays className="w-5 h-5" /> Versenynaptár · következő 30 nap</div>
        <span className="text-xs font-semibold flex items-center px-2.5 py-1.5 rounded-lg text-white shadow-sm" style={{ backgroundColor: BLUE }}>Teljes naptár <ChevronRight className="w-4 h-4" /></span>
      </button>
      {comps.length === 0 ? (
        <div className="text-sm text-gray-400 italic">A következő 30 napban nincs verseny.</div>
      ) : (
        <div className="space-y-1.5">
          {comps.map(c => (
            <button key={c.id} onClick={onOpen} className="w-full text-left flex items-center gap-3 hover:bg-gray-50 rounded px-1 py-1">
              <div className="text-sm font-semibold w-28 flex-shrink-0 text-gray-700">{dateRange(c)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                {venueText(c) && <div className="text-xs text-gray-500 truncate">{venueText(c)}</div>}
              </div>
              <ImpChip value={c.importance} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
