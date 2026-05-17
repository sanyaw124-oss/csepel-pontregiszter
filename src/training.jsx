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
  Calendar, ChevronLeft, ChevronRight, Save, Check, X,
  Loader, AlertCircle, BookOpen, CheckSquare, Square, ArrowLeft, Users,
  BarChart3, TrendingDown
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// KONSTANSOK
// ═══════════════════════════════════════════════════════════════════

const SESSION_TYPES = [
  { value: 'edzes',      label: 'Edzés',            color: '#1D4ED8', bg: '#DBEAFE' },
  { value: 'egesznapos', label: 'Egésznapos edzés', color: '#15803D', bg: '#D1FAE5' },
  { value: 'tabor',      label: 'Tábor',            color: '#B45309', bg: '#FEF3C7' }
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

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatCompetitorName(c) {
  if (!c) return '';
  if (c.nickname) {
    // "Völgyesi Noémi" + nickname "Ori" → "Völgyesi 'Ori' Noémi"
    const parts = (c.full_name || '').split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} "${c.nickname}" ${parts.slice(1).join(' ')}`;
    }
  }
  return c.full_name || '';
}

// ═══════════════════════════════════════════════════════════════════
// FŐ KOMPONENS — Edző/Admin nézet
// ═══════════════════════════════════════════════════════════════════

export function TrainingView({ supabase, userRole, dataReloadKey }) {
  // v0.9.25: tab kapcsoló (napi / klub-összesítő)
  const [tab, setTab] = useState('daily'); // 'daily' | 'summary'

  const [date, setDate] = useState(todayISO());
  const [sessionType, setSessionType] = useState('edzes');
  const [competitors, setCompetitors] = useState([]);
  const [yearlyStats, setYearlyStats] = useState({});
  const [existingSession, setExistingSession] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [originalSelectedIds, setOriginalSelectedIds] = useState(new Set());
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
        .eq('is_active', true)
        .order('full_name');
      if (cErr) throw cErr;

      // 2. Éves összesítés (view)
      const { data: stats, error: sErr } = await supabase
        .from('v_training_yearly_summary')
        .select('competitor_id, year, edzes_count, egesznapos_count, tabor_count')
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
      if (sess) {
        const { data: atts, error: aErr } = await supabase
          .from('training_attendance')
          .select('competitor_id')
          .eq('session_id', sess.id);
        if (aErr) throw aErr;
        (atts || []).forEach(a => attendIds.add(a.competitor_id));
      }

      setCompetitors(comps || []);
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
    setSelectedIds(new Set(competitors.map(c => c.id)));
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
      {/* v0.9.25: Tab kapcsoló (napi / klub-összesítő) */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
        <button
          onClick={() => setTab('daily')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors flex items-center gap-2 ${
            tab === 'daily' ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
          style={tab === 'daily' ? { backgroundColor: COLORS.red } : {}}
        >
          <Calendar className="w-4 h-4" />
          Napi bejegyzés
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors flex items-center gap-2 ${
            tab === 'summary' ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
          style={tab === 'summary' ? { backgroundColor: COLORS.red } : {}}
        >
          <BarChart3 className="w-4 h-4" />
          Klub-összesítő
        </button>
      </div>

      {/* Klub-összesítő nézet */}
      {tab === 'summary' && (
        <ClubTrainingSummary supabase={supabase} dataReloadKey={dataReloadKey} />
      )}

      {/* Napi bejegyzés nézet (eredeti) */}
      {tab === 'daily' && (
      <>
      {/* Fejléc */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h1 className="text-lg font-semibold">Edzésnapló</h1>
        </div>

        {/* Dátum választó */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Tegnap
          </button>
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
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
            disabled={date >= todayISO()}
          >
            Holnap <ChevronRight className="w-4 h-4" />
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
                  onChange={() => toggleCompetitor(c.id)}
                  className="w-4 h-4 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={checked ? { color: meta.color } : {}}>
                    {formatCompetitorName(c)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.kategoria} · {c.korosztaly}
                    {age !== null && ` · ${age} éves`}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 hidden sm:block">
                  {stats ? (
                    <>
                      {year}: {stats.edzes_count} edzés · {stats.egesznapos_count} egésznap · {stats.tabor_count} tábor
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
      </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLUB TRAINING SUMMARY — v0.9.25 ÚJ
// Klub-szintű edzés-összesítő edzőknek/adminoknak
// Szűrők: év + hónap + nap (vegyíthetőek)
// Kiemelés: heti < 3 edzés aktív versenyzőknél
// ═══════════════════════════════════════════════════════════════════

function ClubTrainingSummary({ supabase, dataReloadKey }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);
  const [dayFrom, setDayFrom] = useState('');
  const [dayTo, setDayTo] = useState('');
  const [availableYears, setAvailableYears] = useState([currentYear]);

  const [sessions, setSessions] = useState(null);
  const [competitors, setCompetitors] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState(null);

  // Adatok betöltése
  const load = useCallback(async () => {
    setError(null);
    try {
      // 1) Évek listája
      const { data: yearData } = await supabase
        .from('training_sessions')
        .select('date')
        .order('date', { ascending: false });
      
      const years = [...new Set((yearData || []).map(s => new Date(s.date).getFullYear()))];
      if (years.length === 0) years.push(currentYear);
      setAvailableYears(years);

      // 2) Versenyzők
      const { data: compData } = await supabase
        .from('competitors')
        .select('id, full_name, nickname, is_active, kategoria, korosztaly')
        .order('full_name');
      setCompetitors(compData || []);

      // 3) Összes edzés
      const { data: sessData } = await supabase
        .from('training_sessions')
        .select('id, date, session_type, notes')
        .order('date', { ascending: false });
      setSessions(sessData || []);

      // 4) Összes részvétel
      const { data: attData } = await supabase
        .from('training_attendance')
        .select('session_id, competitor_id');
      setAttendance(attData || []);
    } catch (err) {
      setError(err.message);
      setSessions([]);
      setCompetitors([]);
      setAttendance([]);
    }
  }, [supabase, currentYear]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  // Szűrt adatok kiszámítása
  const summary = useMemo(() => {
    if (!sessions || !competitors || !attendance) return null;

    // Időszak meghatározása
    let startDate, endDate;
    if (dayFrom && dayTo) {
      startDate = dayFrom;
      endDate = dayTo;
    } else {
      const lastDay = new Date(year, monthTo, 0).getDate();
      startDate = `${year}-${String(monthFrom).padStart(2, '0')}-01`;
      endDate = `${year}-${String(monthTo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Szűrt edzések
    const filteredSessions = sessions.filter(s => {
      const d = s.date;
      return d >= startDate && d <= endDate;
    });

    const sessionIdsInRange = new Set(filteredSessions.map(s => s.id));

    // Szűrt részvételek
    const filteredAttendance = attendance.filter(a => sessionIdsInRange.has(a.session_id));

    // Versenyzőnkénti összesítés
    const perCompetitor = competitors.map(c => {
      const myAttendance = filteredAttendance.filter(a => a.competitor_id === c.id);
      const mySessions = myAttendance.map(a => 
        filteredSessions.find(s => s.id === a.session_id)
      ).filter(Boolean);

      const edzes = mySessions.filter(s => s.session_type === 'edzes').length;
      const egesznapos = mySessions.filter(s => s.session_type === 'egesznapos').length;
      const tabor = mySessions.filter(s => s.session_type === 'tabor').length;
      const total = mySessions.length;

      return { ...c, edzes, egesznapos, tabor, total };
    });

    // Időszak hossza hetekben (kerekítve)
    const daysDiff = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24) + 1;
    const weeks = daysDiff / 7;
    const minExpected = Math.floor(weeks * 3); // heti 3 = elvárt minimum

    // Aktív versenyzők, akik elmaradnak a heti 3-tól (csak edzés + egésznapos számít)
    const underperforming = perCompetitor
      .filter(c => c.is_active)
      .filter(c => (c.edzes + c.egesznapos) < minExpected)
      .sort((a, b) => (a.edzes + a.egesznapos) - (b.edzes + b.egesznapos));

    // A többiek
    const ok = perCompetitor
      .filter(c => c.is_active)
      .filter(c => (c.edzes + c.egesznapos) >= minExpected)
      .sort((a, b) => (b.edzes + b.egesznapos) - (a.edzes + a.egesznapos));

    const inactive = perCompetitor
      .filter(c => !c.is_active && c.total > 0)
      .sort((a, b) => b.total - a.total);

    return {
      startDate, endDate, weeks: Math.round(weeks * 10) / 10,
      minExpected,
      totalSessions: filteredSessions.length,
      underperforming, ok, inactive
    };
  }, [sessions, competitors, attendance, year, monthFrom, monthTo, dayFrom, dayTo]);

  const HONAPOK = [
    'január', 'február', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
  ];

  return (
    <div className="space-y-4">
      {/* Szűrők */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold">Klub edzés-összesítő</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Év</label>
            <select
              value={year}
              onChange={(e) => { setYear(parseInt(e.target.value)); setDayFrom(''); setDayTo(''); }}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Hónaptól</label>
            <select
              value={monthFrom}
              onChange={(e) => { setMonthFrom(parseInt(e.target.value)); setDayFrom(''); setDayTo(''); }}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300"
            >
              {HONAPOK.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1}. {m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Hónapig</label>
            <select
              value={monthTo}
              onChange={(e) => { setMonthTo(parseInt(e.target.value)); setDayFrom(''); setDayTo(''); }}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300"
            >
              {HONAPOK.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1}. {m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Naptól (opcionális)</label>
            <input
              type="date"
              value={dayFrom}
              onChange={(e) => setDayFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Napig (opcionális)</label>
            <input
              type="date"
              value={dayTo}
              onChange={(e) => setDayTo(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300"
            />
          </div>
        </div>

        {(dayFrom || dayTo) && (
          <button
            onClick={() => { setDayFrom(''); setDayTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Konkrét napok törlése (visszatérés hónap-szűréshez)
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary === null ? (
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : (
        <>
          {/* Összesített statisztika */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-2">
              Időszak: <strong>{summary.startDate}</strong> → <strong>{summary.endDate}</strong> ({summary.weeks} hét)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Összes edzésnap</div>
                <div className="text-2xl font-bold" style={{ color: COLORS.primary }}>{summary.totalSessions}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-700">Elvárt min/fő</div>
                <div className="text-2xl font-bold text-blue-700">{summary.minExpected}</div>
                <div className="text-xs text-blue-600">heti 3 alapján</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-700">✓ Rendben</div>
                <div className="text-2xl font-bold text-green-700">{summary.ok.length}</div>
                <div className="text-xs text-green-600">aktív versenyző</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-700">⚠ Elmaradás</div>
                <div className="text-2xl font-bold text-red-700">{summary.underperforming.length}</div>
                <div className="text-xs text-red-600">heti 3 alatt</div>
              </div>
            </div>
          </div>

          {/* Elmaradók — kiemelt pirossal */}
          {summary.underperforming.length > 0 && (
            <div className="bg-white rounded-lg border-2 border-red-300 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-700" />
                <h3 className="font-semibold text-red-800">
                  Elmaradás — heti 3 edzés alatt ({summary.underperforming.length})
                </h3>
              </div>
              <div className="divide-y divide-red-100">
                {summary.underperforming.map(c => (
                  <CompetitorTrainingRow key={c.id} competitor={c} expected={summary.minExpected} warning />
                ))}
              </div>
            </div>
          )}

          {/* Rendben edzők */}
          {summary.ok.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-700" />
                <h3 className="font-semibold text-green-800">
                  Rendben ({summary.ok.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {summary.ok.map(c => (
                  <CompetitorTrainingRow key={c.id} competitor={c} expected={summary.minExpected} />
                ))}
              </div>
            </div>
          )}

          {/* Inaktív, de részt vett */}
          {summary.inactive.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-700">
                  Inaktív (volt edzésen az időszakban): {summary.inactive.length}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {summary.inactive.map(c => (
                  <CompetitorTrainingRow key={c.id} competitor={c} expected={summary.minExpected} inactive />
                ))}
              </div>
            </div>
          )}

          {summary.ok.length === 0 && summary.underperforming.length === 0 && summary.inactive.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              Nincs adat ebben az időszakban.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Egy versenyző sor a klub-összesítőben
function CompetitorTrainingRow({ competitor, expected, warning, inactive }) {
  const c = competitor;
  const activeCount = c.edzes + c.egesznapos;
  const missing = Math.max(0, expected - activeCount);
  
  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${warning ? 'bg-red-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: warning ? '#991b1b' : '#1e3a8a' }}>
          {formatCompetitorName(c)}
          {inactive && <span className="ml-2 text-xs text-gray-500 font-normal">(inaktív)</span>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {c.kategoria} · {c.korosztaly}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-center min-w-[50px]">
          <div className="font-bold text-blue-700">{c.edzes}</div>
          <div className="text-xs text-gray-500">edzés</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className="font-bold text-green-700">{c.egesznapos}</div>
          <div className="text-xs text-gray-500">egészn.</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className="font-bold text-amber-700">{c.tabor}</div>
          <div className="text-xs text-gray-500">tábor</div>
        </div>
        <div className="text-center min-w-[60px] pl-2 border-l">
          <div className="font-bold text-lg">{c.total}</div>
          <div className="text-xs text-gray-500">össz.</div>
        </div>
        {warning && (
          <div className="text-center min-w-[55px] pl-2 border-l">
            <div className="font-bold text-lg text-red-700">-{missing}</div>
            <div className="text-xs text-red-600">elmarad</div>
          </div>
        )}
      </div>
    </div>
  );
}

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
          .select('edzes_count, egesznapos_count, tabor_count, total_count')
          .eq('competitor_id', competitorId)
          .eq('year', targetYear)
          .maybeSingle();

        // Havi bontás
        const { data: mStats } = await supabase
          .from('v_training_monthly_summary')
          .select('month, edzes_count, egesznapos_count, tabor_count')
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
        setYearStats(yStats || { edzes_count: 0, egesznapos_count: 0, tabor_count: 0, total_count: 0 });
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
      {/* 3 stat kártya */}
      <div className="grid grid-cols-3 gap-2">
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
