// ═══════════════════════════════════════════════════════════════════
// Pontregiszter v0.9 — Edzésnapló modul
// ═══════════════════════════════════════════════════════════════════
// Funkciók v0.9.0 (MVP):
//   - Napi nézet: dátumválasztó + bejegyzés típusa + versenyzők pipálása
//   - Visszamenőleges bevitel támogatott
//   - Egy napon több bejegyzés lehet (pl. délelőtt edzés + délután egésznapos)
//   - Tábor: naponta külön bejegyzés
//   - Versenyzőnként összesen szám (éves)
//   - Szülői nézet: csak saját gyerek
//
// Hátralévő (későbbi v0.9.x):
//   - Havi naptár nézet
//   - Versenyző éves összegző (részletes)
//   - Klub áttekintő
//   - Excel/PDF export
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Save, Check, X,
  Loader, AlertCircle, BookOpen, CheckSquare, Square, ArrowLeft, Users,
  BarChart3, ClipboardList
} from 'lucide-react';
import { formatCompetitorName } from './names';

// ═══════════════════════════════════════════════════════════════════
// KONSTANSOK
// ═══════════════════════════════════════════════════════════════════

const SESSION_TYPES = [
  { value: 'edzes',      label: 'Edzés',            color: '#1D4ED8', bg: '#DBEAFE' },
  { value: 'egesznapos', label: 'Egésznapos edzés', color: '#15803D', bg: '#D1FAE5' },
  { value: 'tabor',      label: 'Tábor',            color: '#B45309', bg: '#FEF3C7' },
  // v0.9.54: balett — bármelyik fő edzésforma mellé járhat
  { value: 'balett',     label: 'Balett',           color: '#BE185D', bg: '#FCE7F3' }
];

function getSessionTypeMeta(value) {
  return SESSION_TYPES.find(t => t.value === value) || SESSION_TYPES[0];
}

const COLORS = {
  primary: '#1F2937',
  secondary: '#6B7280',
  red: '#BE123C',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray50: '#F9FAFB'
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FÜGGVÉNYEK
// ═══════════════════════════════════════════════════════════════════

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateHU(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${days[d.getDay()]})`;
}


// v0.9.49: formatCompetitorName a names.js-ből (becenév elöl)

// ═══════════════════════════════════════════════════════════════════
// FŐ KOMPONENS — Edző/Admin nézet
// ═══════════════════════════════════════════════════════════════════

export function TrainingView({ supabase, userRole, dataReloadKey, profile }) {
  // VERSENYZŐ → saját nézet (csak olvasás)
  if (userRole === 'versenyzo') {
    return <MyTrainingsView supabase={supabase} profile={profile} />;
  }
  
  return <CoachTrainingView supabase={supabase} userRole={userRole} dataReloadKey={dataReloadKey} />;
}

// ═══════════════════════════════════════════════════════════════════
// VERSENYZŐI saját edzések nézet (v0.9.53: saját rögzítéssel)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// SAJÁT EDZÉS-RÖGZÍTÉS (v0.9.53) — Sándor 2026.10.04: „Katának nem lesz rá ideje”
// A versenyző (és a szülő a saját gyerekének) maga jelöli: mai nap + elmúlt 7 nap,
// edzés / egész napos. Azonnal számít; „saját rögzítés” jelöléssel, az edző törölheti.
// Az írás az adatbázis self_report_training függvényén megy át (ellenőrzi, kinek
// és melyik napra szabad) — docs/sql/2026-10-04_v0.9.53_edzes-onrogzites.sql
// ═══════════════════════════════════════════════════════════════════

// v0.9.54: naponta EGY fő edzésforma (edzés / egész napos / tábor), mellé bármikor balett
const MAIN_TYPES = [
  { value: 'edzes', label: '💪 Edzés' },
  { value: 'egesznapos', label: '☀️ Egész napos' },
  { value: 'tabor', label: '🏕️ Tábor' }
];
const BALETT = { value: 'balett', label: '🩰 Balett' };

function budapestTodayISO() {
  // 'sv-SE' → ÉÉÉÉ-HH-NN; a budapesti naptári nap (az adatbázis is ezt nézi)
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
}

function shiftISO(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SelfTrainingReport({ supabase, competitorId, title = 'Edzéseim rögzítése', onChanged }) {
  const today = budapestTodayISO();
  const days = Array.from({ length: 8 }, (_, i) => shiftISO(today, -i)); // ma + 7 nap
  const [marks, setMarks] = useState({}); // 'nap|típus' → { self: bool }
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!competitorId) return;
    const { data, error: err } = await supabase
      .from('training_attendance')
      .select('self_reported, training_sessions!inner(date, session_type)')
      .eq('competitor_id', competitorId)
      .gte('training_sessions.date', days[days.length - 1])
      .lte('training_sessions.date', today);
    if (err) { setError(err.message); return; }
    const m = {};
    (data || []).forEach(a => {
      const s = a.training_sessions;
      if (s) m[`${s.date}|${s.session_type}`] = { self: !!a.self_reported };
    });
    setMarks(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, competitorId, today]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (date, type) => {
    const key = `${date}|${type}`;
    const cur = marks[key];
    if (cur && !cur.self) return; // az edző rögzítette — nem vehető vissza
    setBusyKey(key);
    setError(null);
    try {
      // fő formánál a másik (saját) jelölést az adatbázis-függvény magától leveszi
      const { error: err } = await supabase.rpc('self_report_training', {
        p_competitor: competitorId, p_date: date, p_type: type, p_present: !cur
      });
      if (err) throw err;
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Nem sikerült menteni');
    } finally {
      setBusyKey(null);
    }
  };

  const dayLabel = (iso) => {
    if (iso === today) return 'Ma';
    if (iso === shiftISO(today, -1)) return 'Tegnap';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const chip = (date, type, label, locked) => {
    const key = `${date}|${type}`;
    const m = marks[key];
    const coachMarked = m && !m.self;
    return (
      <button
        key={type}
        onClick={() => toggle(date, type)}
        disabled={busyKey === key || coachMarked || (locked && !m)}
        title={coachMarked ? 'Az edző rögzítette' : (locked && !m ? 'Erre a napra az edző már másik formát rögzített' : (m ? 'Visszavonás' : 'Ott voltam'))}
        className="px-3 py-1.5 rounded-full text-xs font-medium border transition disabled:cursor-default"
        style={m
          ? { backgroundColor: coachMarked ? '#DBEAFE' : '#D1FAE5', borderColor: coachMarked ? '#93C5FD' : '#6EE7B7', color: coachMarked ? '#1D4ED8' : '#047857' }
          : { backgroundColor: 'white', borderColor: '#E5E7EB', color: '#6B7280', opacity: locked ? 0.4 : 1 }}
      >
        {busyKey === key ? '…' : (m ? '✓ ' : '')}{label}{coachMarked ? ' (edző)' : ''}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          Naponta egyet választhatsz: edzés, egész napos vagy tábor — mellé jelölheted a balettet is.
          A mai napot és az elmúlt 7 napot rögzítheted.
        </div>
      </div>
      {error && <div className="mx-3 mt-2 text-xs text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100">
        {days.map(date => {
          // ha az edző már rögzített egy fő formát, a másik kettő nem választható
          const coachMain = MAIN_TYPES.find(t => marks[`${date}|${t.value}`] && !marks[`${date}|${t.value}`].self);
          return (
            <div key={date} className="px-3 py-2 flex items-center gap-2 flex-wrap">
              <div className="w-20 text-sm text-gray-700 flex-shrink-0">{dayLabel(date)}</div>
              <div className="flex gap-1.5 flex-wrap flex-1">
                {MAIN_TYPES.map(t => chip(date, t.value, t.label, !!coachMain && coachMain.value !== t.value))}
                <span className="w-px bg-gray-200 mx-1" />
                {chip(date, BALETT.value, BALETT.label, false)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyTrainingsView({ supabase, profile }) {
  const [trainings, setTrainings] = useState([]);
  const [stats, setStats] = useState({ edzes: 0, egesznapos: 0, tabor: 0, balett: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());
  const [myCompetitorId, setMyCompetitorId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let competitorId = profile?.competitor_id;
        if (!competitorId && profile?.full_name) {
          const fb = await supabase.from('competitors').select('id').eq('full_name', profile.full_name).limit(1).maybeSingle();
          if (fb.data?.id) competitorId = fb.data.id;
        }
        if (!competitorId) { if (mounted) setLoading(false); return; }
        if (mounted) setMyCompetitorId(competitorId);

        const { data } = await supabase
          .from('training_attendance')
          .select(`
            id,
            training_sessions!inner(id, date, session_type, notes)
          `)
          .eq('competitor_id', competitorId)
          .gte('training_sessions.date', `${year}-01-01`)
          .order('training_sessions(date)', { ascending: false });

        if (data && mounted) {
          setTrainings(data);
          const counts = { edzes: 0, egesznapos: 0, tabor: 0, balett: 0 };
          data.forEach(t => {
            const type = t.training_sessions?.session_type;
            if (type && counts[type] !== undefined) counts[type]++;
          });
          // az „összesen” a fő edzésformák napjai (a balett mellettük jár)
          setStats({ ...counts, total: data.length - counts.balett });
        }
      } catch (err) {
        console.error('MyTrainings load:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name, year, reloadKey]);

  if (loading) return <div className="py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h1 className="text-lg font-semibold">Edzéseim ({year})</h1>
        </div>
      </div>

      {/* v0.9.53: saját rögzítés */}
      {myCompetitorId && (
        <SelfTrainingReport supabase={supabase} competitorId={myCompetitorId}
                            onChanged={() => setReloadKey(k => k + 1)} />
      )}

      {/* Statisztika */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.edzes}</div>
          <div className="text-xs text-gray-500">edzés</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.egesznapos}</div>
          <div className="text-xs text-gray-500">egész napos</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{stats.tabor}</div>
          <div className="text-xs text-gray-500">tábor</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold" style={{ color: '#BE185D' }}>{stats.balett}</div>
          <div className="text-xs text-gray-500">balett</div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-3 border-b border-gray-200 text-sm font-medium text-gray-700">
          Részvételeim ({stats.total})
        </div>
        {trainings.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Még nincs rögzített edzésed idén.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {trainings.map(t => {
              const session = t.training_sessions;
              if (!session) return null;
              const typeLabel = session.session_type === 'edzes' ? '💪 Edzés' :
                                session.session_type === 'egesznapos' ? '☀️ Egész napos' :
                                session.session_type === 'balett' ? '🩰 Balett' : '🏕️ Tábor';
              return (
                <div key={t.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{typeLabel}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(session.date).toLocaleDateString('hu-HU', { 
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div className="text-green-600">✓</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZŐI/ADMIN edzésnapló WRAPPER — tab választó (rögzítés ↔ összesítő)
// v0.9.42: Klub összesítő visszahozva (eltűnt korábbi iterációban)
// ═══════════════════════════════════════════════════════════════════
function CoachTrainingView({ supabase, userRole, dataReloadKey }) {
  const [tab, setTab] = useState('log'); // 'log' | 'summary'

  return (
    <div className="space-y-3">
      {/* Tab választó */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex gap-1">
        <button
          onClick={() => setTab('log')}
          className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2 ${
            tab === 'log'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Edzés rögzítés
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2 ${
            tab === 'summary'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Klub összesítő
        </button>
      </div>

      {tab === 'log' && <CoachLogView supabase={supabase} userRole={userRole} dataReloadKey={dataReloadKey} />}
      {tab === 'summary' && <ClubTrainingSummary supabase={supabase} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZÉS RÖGZÍTÉS — a régi CoachTrainingView (átnevezve)
// ═══════════════════════════════════════════════════════════════════
function CoachLogView({ supabase, userRole, dataReloadKey }) {
  const [date, setDate] = useState(todayISO());
  const [sessionType, setSessionType] = useState('edzes');
  const [competitors, setCompetitors] = useState([]);
  const [yearlyStats, setYearlyStats] = useState({});
  const [existingSession, setExistingSession] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [originalSelectedIds, setOriginalSelectedIds] = useState(new Set());
  const [selfReportedIds, setSelfReportedIds] = useState(new Set()); // v0.9.53: a gyerek / szülő jelölte
  const [otherMain, setOtherMain] = useState({}); // v0.9.54: competitor_id → aznapi MÁSIK fő forma címkéje
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const year = parseInt(date.slice(0, 4), 10);

  // ─── Adatok betöltése ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // 1. Aktív versenyzők
      const { data: comps, error: cErr } = await supabase
        .from('competitors')
        .select('id, full_name, nickname, kategoria, korosztaly, birth_year, is_active')
        .eq('is_active', true);
      if (cErr) throw cErr;

      // v0.9.42: becenév-elsődleges magyar abc rendezés (PG byte-alap helyett JS-ben)
      const sortedComps = (comps || []).sort((a, b) => {
        const aKey = (a.nickname || a.full_name || '').trim();
        const bKey = (b.nickname || b.full_name || '').trim();
        return aKey.localeCompare(bKey, 'hu', { sensitivity: 'base', numeric: true });
      });

      // 2. Éves összesítés (view)
      const { data: stats, error: sErr } = await supabase
        .from('v_training_yearly_summary')
        .select('competitor_id, year, edzes_count, egesznapos_count, tabor_count, balett_count')
        .eq('year', year);
      if (sErr) throw sErr;

      const statsMap = {};
      (stats || []).forEach(s => { statsMap[s.competitor_id] = s; });

      // 3. Létezik-e már ehhez a naphoz + típushoz session?
      const { data: sess, error: sErr2 } = await supabase
        .from('training_sessions')
        .select('id, date, session_type, notes')
        .eq('date', date)
        .eq('session_type', sessionType)
        .maybeSingle();
      if (sErr2) throw sErr2;

      let attendIds = new Set();
      const selfIds = new Set();
      if (sess) {
        const { data: atts, error: aErr } = await supabase
          .from('training_attendance')
          .select('competitor_id, self_reported')
          .eq('session_id', sess.id);
        if (aErr) throw aErr;
        (atts || []).forEach(a => {
          attendIds.add(a.competitor_id);
          if (a.self_reported) selfIds.add(a.competitor_id);
        });
      }
      setSelfReportedIds(selfIds);

      // v0.9.54: naponta egy fő forma — ki szerepel már aznap másik fő formában?
      const others = {};
      if (sessionType !== 'balett') {
        const { data: otherAtts, error: oErr } = await supabase
          .from('training_attendance')
          .select('competitor_id, training_sessions!inner(date, session_type)')
          .eq('training_sessions.date', date)
          .in('training_sessions.session_type', ['edzes', 'egesznapos', 'tabor'].filter(x => x !== sessionType));
        if (oErr) throw oErr;
        (otherAtts || []).forEach(a => {
          others[a.competitor_id] = getSessionTypeMeta(a.training_sessions.session_type).label;
        });
      }
      setOtherMain(others);

      setCompetitors(sortedComps);
      setYearlyStats(statsMap);
      setExistingSession(sess);
      setNotes(sess?.notes || '');
      setSelectedIds(new Set(attendIds));
      setOriginalSelectedIds(new Set(attendIds));
    } catch (err) {
      console.error('TrainingView load error:', err);
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [supabase, date, sessionType, year]);

  useEffect(() => {
    loadData();
  }, [loadData, dataReloadKey]);

  // ─── Mentés ───────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const ids = Array.from(selectedIds);

      // Ha 0 a jelölt és nincs is még session → ne csináljunk semmit
      if (ids.length === 0 && !existingSession) {
        setSuccessMsg('Nincs jelölt versenyző — semmi sem rögzült.');
        setSaving(false);
        return;
      }

      // Ha 0 a jelölt és van session → töröljük a sessiont (cascade törli az attendance-t)
      if (ids.length === 0 && existingSession) {
        const { error: delErr } = await supabase
          .from('training_sessions')
          .delete()
          .eq('id', existingSession.id);
        if (delErr) throw delErr;
        setSuccessMsg('Bejegyzés törölve (nincs jelölt versenyző).');
        await loadData();
        setSaving(false);
        return;
      }

      let sessionId = existingSession?.id;

      // 1. Session létrehozása vagy frissítése
      if (!sessionId) {
        const { data: newSess, error: insErr } = await supabase
          .from('training_sessions')
          .insert({ date, session_type: sessionType, notes: notes || null })
          .select('id')
          .single();
        if (insErr) throw insErr;
        sessionId = newSess.id;
      } else {
        const { error: updErr } = await supabase
          .from('training_sessions')
          .update({ notes: notes || null, modified_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (updErr) throw updErr;
      }

      // 2. Attendance diff: töröljük amit lekattintott, hozzáadjuk amit pipálta
      const toRemove = Array.from(originalSelectedIds).filter(id => !selectedIds.has(id));
      const toAdd = Array.from(selectedIds).filter(id => !originalSelectedIds.has(id));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('training_attendance')
          .delete()
          .eq('session_id', sessionId)
          .in('competitor_id', toRemove);
        if (delErr) throw delErr;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(cid => ({ session_id: sessionId, competitor_id: cid }));
        const { error: insErr } = await supabase
          .from('training_attendance')
          .insert(rows);
        if (insErr) throw insErr;
      }

      setSuccessMsg(`Sikeresen mentve (${ids.length} versenyző).`);
      await loadData();
    } catch (err) {
      console.error('TrainingView save error:', err);
      setError(err.message || 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  };

  // ─── UI eseménykezelők ────────────────────────────────────────
  const toggleCompetitor = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(competitors.filter(c => !otherMain[c.id]).map(c => c.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const hasChanges = () => {
    if (selectedIds.size !== originalSelectedIds.size) return true;
    for (const id of selectedIds) {
      if (!originalSelectedIds.has(id)) return true;
    }
    if ((notes || '') !== (existingSession?.notes || '')) return true;
    return false;
  };

  const meta = getSessionTypeMeta(sessionType);

  // ─── RENDER ───────────────────────────────────────────────────
  if (loading && competitors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h1 className="text-lg font-semibold">Edzésnapló</h1>
        </div>

        {/* Dátum választó */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
            className="px-3 py-1.5 text-sm rounded border border-gray-300"
          />
          <button
            onClick={() => setDate(todayISO())}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
            disabled={date === todayISO()}
          >
            Ma
          </button>
        </div>

        <div className="mt-2 text-sm text-gray-600">{formatDateHU(date)}</div>
      </div>

      {/* Bejegyzés típusa */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm text-gray-600 mb-2">Bejegyzés típusa:</div>
        <div className="flex gap-2 flex-wrap">
          {SESSION_TYPES.map(t => {
            const active = sessionType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setSessionType(t.value)}
                className="px-3 py-2 text-sm rounded font-medium border transition-all"
                style={active ? {
                  backgroundColor: t.bg,
                  borderColor: t.color,
                  color: t.color
                } : {
                  backgroundColor: 'white',
                  borderColor: COLORS.gray200,
                  color: COLORS.primary
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {existingSession && (
          <div className="mt-2 text-xs text-gray-500">
            Ehhez a naphoz és típushoz már létezik bejegyzés — szerkesztheted.
          </div>
        )}
      </div>

      {/* Hibák / sikerüzenetek */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Versenyzők lista */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm font-medium">Versenyzők ({competitors.length})</div>
            <div className="text-xs text-gray-500">Pipáld ki aki ott volt</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-semibold" style={{ color: meta.color }}>
                {selectedIds.size}
              </span>
              <span className="text-gray-500"> / {competitors.length} jelen</span>
            </div>
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
              disabled={selectedIds.size === competitors.length}
            >
              Mind
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
              disabled={selectedIds.size === 0}
            >
              Egyik se
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {competitors.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Nincs aktív versenyző.
            </div>
          ) : competitors.map(c => {
            const checked = selectedIds.has(c.id);
            const blockedBy = !checked ? otherMain[c.id] : null; // aznap már másik fő formában
            const stats = yearlyStats[c.id];
            const age = c.birth_year ? (year - c.birth_year) : null;

            return (
              <label
                key={c.id}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                style={checked ? { backgroundColor: meta.bg, borderLeft: `3px solid ${meta.color}` } : {}}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!!blockedBy}
                  onChange={() => toggleCompetitor(c.id)}
                  className="w-4 h-4 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={checked ? { color: meta.color } : {}}>
                    {formatCompetitorName(c)}
                    {blockedBy && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium align-middle bg-gray-100 text-gray-600"
                            title="Naponta csak egy fő edzésforma lehet (a balett mellé járhat)">
                        aznap: {blockedBy}
                      </span>
                    )}
                    {checked && selfReportedIds.has(c.id) && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium align-middle"
                            style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
                            title="A versenyző vagy a szülője jelölte">
                        saját
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.kategoria} · {c.korosztaly}
                    {age !== null && ` · ${age} éves`}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 hidden sm:block">
                  {stats ? (
                    <>
                      {year}: {stats.edzes_count} edzés · {stats.egesznapos_count} egésznap · {stats.tabor_count} tábor{stats.balett_count ? ` · ${stats.balett_count} balett` : ''}
                    </>
                  ) : (
                    `${year}: 0 alkalom`
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Megjegyzés (opcionális) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Megjegyzés (opcionális)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='pl. "Nyári kupa felkészítés"'
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Mentés gomb */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: meta.color }}
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Mentés...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Mentés ({selectedIds.size} versenyző)
              </>
            )}
          </button>
          {hasChanges() && (
            <span className="text-xs text-gray-500">Nem mentett változtatások</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SZÜLŐI NÉZET — saját gyerek edzései
// ═══════════════════════════════════════════════════════════════════

export function ParentTrainingView({ supabase, competitorId, year }) {
  const [yearStats, setYearStats] = useState(null);
  const [monthStats, setMonthStats] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const targetYear = year || new Date().getFullYear();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Éves összesítés
        const { data: yStats } = await supabase
          .from('v_training_yearly_summary')
          .select('edzes_count, egesznapos_count, tabor_count, total_count, balett_count')
          .eq('competitor_id', competitorId)
          .eq('year', targetYear)
          .maybeSingle();

        // Havi bontás
        const { data: mStats } = await supabase
          .from('v_training_monthly_summary')
          .select('month, edzes_count, egesznapos_count, tabor_count, balett_count')
          .eq('competitor_id', competitorId)
          .eq('year', targetYear)
          .order('month');

        // Utolsó 5 alkalom
        const { data: recentSess } = await supabase
          .from('training_attendance')
          .select('id, training_sessions!inner(date, session_type)')
          .eq('competitor_id', competitorId)
          .gte('training_sessions.date', `${targetYear}-01-01`)
          .lte('training_sessions.date', `${targetYear}-12-31`)
          .order('training_sessions(date)', { ascending: false })
          .limit(5);

        if (!active) return;
        setYearStats(yStats || { edzes_count: 0, egesznapos_count: 0, tabor_count: 0, total_count: 0, balett_count: 0 });
        setMonthStats(mStats || []);
        setRecent(recentSess || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase, competitorId, targetYear]);

  if (loading) {
    return <div className="text-sm text-gray-500 italic">Edzések betöltése...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-center gap-2">
        <AlertCircle className="w-3 h-3" />
        {error}
      </div>
    );
  }

  const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
                  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
  const currentMonth = new Date().getMonth() + 1;
  const isCurrentYear = targetYear === new Date().getFullYear();

  return (
    <div className="space-y-3">
      {/* 4 stat kártya (v0.9.54: + balett) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-50 rounded p-3 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Edzés</div>
          <div className="text-2xl font-semibold">{yearStats.edzes_count}</div>
        </div>
        <div className="bg-gray-50 rounded p-3 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Egésznapos</div>
          <div className="text-2xl font-semibold">{yearStats.egesznapos_count}</div>
        </div>
        <div className="bg-gray-50 rounded p-3 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Tábor</div>
          <div className="text-2xl font-semibold">{yearStats.tabor_count}</div>
        </div>
        <div className="bg-gray-50 rounded p-3 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Balett</div>
          <div className="text-2xl font-semibold">{yearStats.balett_count || 0}</div>
        </div>
      </div>

      {/* Utolsó 5 alkalom */}
      {recent.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Utolsó alkalmak</div>
          <div className="space-y-1">
            {recent.map(r => {
              const meta = getSessionTypeMeta(r.training_sessions.session_type);
              return (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 min-w-[90px]">
                    {r.training_sessions.date}
                  </span>
                  <span style={{ color: meta.color }} className="font-medium">
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          {targetYear}-ben még nincs rögzített edzés.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KLUB ÖSSZESÍTŐ — minden versenyző edzés-statisztikája
// v0.9.42: visszahozva (eltűnt korábbi iterációban)
// ═══════════════════════════════════════════════════════════════════
// Nézet választó:
//   - Éves: minden versenyző évre összesítve (edzés/egésznapos/tábor)
//   - Havi: minden versenyző adott hónapra (alap: aktuális hónap)
// Adatforrás: v_training_yearly_summary / v_training_monthly_summary view
// ═══════════════════════════════════════════════════════════════════
function ClubTrainingSummary({ supabase }) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  const [viewMode, setViewMode] = useState('yearly'); // 'yearly' | 'monthly'
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [competitors, setCompetitors] = useState([]);
  const [stats, setStats] = useState({}); // competitor_id -> {edzes_count, egesznapos_count, tabor_count, total_count}
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MONTHS = [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
  ];

  // Adatok betöltése (PÁRHUZAMOSAN)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queries = [];

      // 1. Aktív versenyzők
      queries.push(
        supabase
          .from('competitors')
          .select('id, full_name, nickname, kategoria, korosztaly, birth_year')
          .eq('is_active', true)
      );

      // 2. Statisztika a választott nézet szerint
      if (viewMode === 'yearly') {
        queries.push(
          supabase
            .from('v_training_yearly_summary')
            .select('competitor_id, edzes_count, egesznapos_count, tabor_count, balett_count')
            .eq('year', year)
        );
      } else {
        queries.push(
          supabase
            .from('v_training_monthly_summary')
            .select('competitor_id, edzes_count, egesznapos_count, tabor_count, total_count, balett_count')
            .eq('year', year)
            .eq('month', month)
        );
      }

      // 3. Évek listája (választóhoz) — egyszerűen az utolsó pár évet vesszük
      // jelenleg az adatbázisban ami létezik (yearly summary alapján)
      queries.push(
        supabase
          .from('v_training_yearly_summary')
          .select('year')
      );

      const [compsRes, statsRes, yearsRes] = await Promise.all(queries);

      if (compsRes.error) throw compsRes.error;
      if (statsRes.error) throw statsRes.error;

      // Versenyzők becenév-rendezett
      const sortedComps = (compsRes.data || []).sort((a, b) => {
        const aKey = (a.nickname || a.full_name || '').trim();
        const bKey = (b.nickname || b.full_name || '').trim();
        return aKey.localeCompare(bKey, 'hu', { sensitivity: 'base', numeric: true });
      });

      // Statisztika map
      const statsMap = {};
      (statsRes.data || []).forEach(s => {
        statsMap[s.competitor_id] = s;
      });

      // Évek listája
      const yearSet = new Set([currentYear]);
      (yearsRes?.data || []).forEach(y => { if (y.year) yearSet.add(y.year); });
      const years = Array.from(yearSet).sort((a, b) => b - a);

      setCompetitors(sortedComps);
      setStats(statsMap);
      setAvailableYears(years);
    } catch (err) {
      console.error('ClubTrainingSummary load:', err);
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [supabase, viewMode, year, month, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // Klub-szintű összesítés a fejléchez
  const clubTotal = useMemo(() => {
    let edzes = 0, egesznapos = 0, tabor = 0, balett = 0;
    Object.values(stats).forEach(s => {
      edzes += s.edzes_count || 0;
      egesznapos += s.egesznapos_count || 0;
      tabor += s.tabor_count || 0;
      balett += s.balett_count || 0;
    });
    return { edzes, egesznapos, tabor, balett };
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const periodLabel = viewMode === 'yearly'
    ? `${year}. év`
    : `${year}. ${MONTHS[month - 1]}`;

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-5 h-5 text-gray-700" />
          <h1 className="text-lg font-semibold">Klub edzés-összesítő</h1>
        </div>

        {/* Nézet választó */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="inline-flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Éves
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Havi
            </button>
          </div>

          {/* Év választó */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Hónap választó (csak havi nézetben) */}
          {viewMode === 'monthly' && (
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-sm text-gray-600">{periodLabel}</div>
      </div>

      {/* Hibák */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Klub-szintű 4 stat kártya (v0.9.54: + balett) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{clubTotal.edzes}</div>
          <div className="text-xs text-gray-500">edzés (klub össz.)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{clubTotal.egesznapos}</div>
          <div className="text-xs text-gray-500">egész napos</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{clubTotal.tabor}</div>
          <div className="text-xs text-gray-500">tábor</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold" style={{ color: '#BE185D' }}>{clubTotal.balett}</div>
          <div className="text-xs text-gray-500">balett</div>
        </div>
      </div>

      {/* Versenyzők lista */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="text-sm font-medium">Versenyzők ({competitors.length})</div>
          <div className="text-xs text-gray-500 mt-0.5">Becenév szerint rendezve</div>
        </div>

        {competitors.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Nincs aktív versenyző.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {competitors.map(c => {
              const s = stats[c.id];
              const edzes = s?.edzes_count || 0;
              const egesznapos = s?.egesznapos_count || 0;
              const tabor = s?.tabor_count || 0;
              const balett = s?.balett_count || 0;
              const total = edzes + egesznapos + tabor; // a balett a fő edzés mellett jár, nem duplázza a napot
              const age = c.birth_year ? (year - c.birth_year) : null;

              return (
                <div key={c.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  {/* Név + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {formatCompetitorName(c)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.kategoria} · {c.korosztaly}
                      {age !== null && ` · ${age} éves`}
                    </div>
                  </div>

                  {/* 4 számláló badge - nagyobb betűkkel az olvashatóságért */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Edzés (kék) */}
                    <div className="text-center min-w-[48px] px-2 py-1.5 rounded bg-blue-50">
                      <div className="text-xl font-bold text-blue-700 leading-none">{edzes}</div>
                      <div className="text-[11px] text-blue-600 mt-0.5">edz.</div>
                    </div>
                    {/* Egésznapos (zöld) */}
                    <div className="text-center min-w-[48px] px-2 py-1.5 rounded bg-green-50">
                      <div className="text-xl font-bold text-green-700 leading-none">{egesznapos}</div>
                      <div className="text-[11px] text-green-600 mt-0.5">eg.n.</div>
                    </div>
                    {/* Tábor (sárga) */}
                    <div className="text-center min-w-[48px] px-2 py-1.5 rounded bg-amber-50">
                      <div className="text-xl font-bold text-amber-700 leading-none">{tabor}</div>
                      <div className="text-[11px] text-amber-600 mt-0.5">tábor</div>
                    </div>
                    {/* Balett (rózsaszín) */}
                    <div className="text-center min-w-[48px] px-2 py-1.5 rounded bg-pink-50">
                      <div className="text-xl font-bold leading-none" style={{ color: '#BE185D' }}>{balett}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: '#DB2777' }}>balett</div>
                    </div>
                    {/* Összesen (szürke) */}
                    <div className="text-center min-w-[48px] px-2 py-1.5 rounded bg-gray-100 ml-1">
                      <div className="text-xl font-bold text-gray-700 leading-none">{total}</div>
                      <div className="text-[11px] text-gray-600 mt-0.5">össz.</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lábléc info */}
      <div className="text-xs text-gray-500 italic px-1">
        💡 Az "egész napos" külön számít az "edzés"-en kívül. Tábor: minden nap külön bejegyzés.
      </div>
    </div>
  );
}
