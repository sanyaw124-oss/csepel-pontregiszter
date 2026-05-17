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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Save, Check, X,
  Loader, AlertCircle, BookOpen, CheckSquare, Square, ArrowLeft, Users
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

export function TrainingView({ supabase, userRole, dataReloadKey, profile }) {
  // VERSENYZŐ → saját nézet (csak olvasás)
  if (userRole === 'versenyzo') {
    return <MyTrainingsView supabase={supabase} profile={profile} />;
  }
  
  return <CoachTrainingView supabase={supabase} userRole={userRole} dataReloadKey={dataReloadKey} />;
}

// ═══════════════════════════════════════════════════════════════════
// VERSENYZŐI saját edzések nézet (csak olvasás + "Hamarosan" jelzés)
// ═══════════════════════════════════════════════════════════════════
function MyTrainingsView({ supabase, profile }) {
  const [trainings, setTrainings] = useState([]);
  const [stats, setStats] = useState({ edzes: 0, egesznapos: 0, tabor: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());

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
          const counts = { edzes: 0, egesznapos: 0, tabor: 0 };
          data.forEach(t => {
            const type = t.training_sessions?.session_type;
            if (type && counts[type] !== undefined) counts[type]++;
          });
          setStats({ ...counts, total: data.length });
        }
      } catch (err) {
        console.error('MyTrainings load:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name, year]);

  if (loading) return <div className="py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h1 className="text-lg font-semibold">Edzéseim ({year})</h1>
        </div>
      </div>

      {/* Statisztika */}
      <div className="grid grid-cols-3 gap-2">
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
                                session.session_type === 'egesznapos' ? '☀️ Egész napos' : '🏕️ Tábor';
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

      {/* "Hamarosan" jelzés */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-center">
        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
          ⏳ Hamarosan: <strong>saját edzés rögzítés</strong> — ha az edző jóváhagyja!
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZŐI/ADMIN edzésnapló (eredeti TrainingView)
// ═══════════════════════════════════════════════════════════════════
function CoachTrainingView({ supabase, userRole, dataReloadKey }) {
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
