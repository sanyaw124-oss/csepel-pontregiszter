// ═══════════════════════════════════════════════════════════════════
// Pontregiszter v0.9.1 — Pontozási modul
// ═══════════════════════════════════════════════════════════════════
// Funkciók:
//   - Egyéni pontozás kategóriánként, mindenki ugyanazokat a mezőket kapja
//   - DB, DA, D, A, E, P opcionális mezők (csak Total kötelező)
//   - Total: kézzel beírható VAGY auto-számolt (D+A+E-P)
//   - Helyezés számítás tie-break-kel (Total → E → D → A)
//   - Ideiglenes / véglegesített állapot
//   - Édző+admin módosíthatja a véglegesített pontokat is (audit nyommal)
//   - Csepeli kiemelés: piros háttér + csillag (de pontmezők ugyanazok)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Save, Loader, AlertCircle, CheckCircle2, Lock, Unlock,
  Trophy, Star, Edit2, X, Check, RefreshCw, Award
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// KONSTANSOK
// ═══════════════════════════════════════════════════════════════════

const APPARATUS_LABELS = {
  szabad: 'Szabad',
  karika: 'Karika',
  labda: 'Labda',
  buzogany: 'Buzogány',
  szalag: 'Szalag',
  kotel: 'Kötél'
};

// v0.9.50: vegyes szer címkézése csapatgyakorlatnál.
// A szer lehet egyszeres ('karika') vagy '+'-szal kombinált ('karika+labda').
// Az egyes kódokat felcímkézi a szótárból; ismeretlen kódot változatlanul hagy.
function formatApparatus(value) {
  if (!value) return null;
  return String(value)
    .split('+')
    .map(part => APPARATUS_LABELS[part.trim()] || part.trim())
    .join(' + ');
}

const COLORS = {
  primary: '#1F2937',
  secondary: '#6B7280',
  red: '#BE123C',
  redLight: '#FEE2E2',
  redPink: '#FCE7F3',
  amber: '#B45309',
  amberLight: '#FEF3C7',
  green: '#15803D',
  greenLight: '#D1FAE5',
  blue: '#1D4ED8',
  blueLight: '#DBEAFE',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB'
};

const CSEPEL_CLUB_NAMES = ['csepeli rg club', 'csepel sc', 'csepel sc rg', 'csepeli', 'csepel'];

// ═══════════════════════════════════════════════════════════════════
// HELPER FÜGGVÉNYEK
// ═══════════════════════════════════════════════════════════════════

function isCsepeliEntry(entry) {
  // Ha competitor_id van, akkor csepeli
  if (entry.competitor_id) return true;
  // Külsős — ellenőrizzük az external_club nevét
  const club = (entry.external_club || '').toLowerCase().trim();
  return CSEPEL_CLUB_NAMES.some(c => club.includes(c));
}

function calculateTotal(scoreDb, scoreDa, scoreD, scoreA, scoreE, scoreP) {
  // Csepelinél: D = DB + DA
  // Külsősnél: D direkt
  // Total = D + A + E - P
  const db = parseFloat(scoreDb) || 0;
  const da = parseFloat(scoreDa) || 0;
  const d = (scoreD !== null && scoreD !== undefined && scoreD !== '') 
    ? parseFloat(scoreD) 
    : (db + da);
  const a = parseFloat(scoreA) || 0;
  const e = parseFloat(scoreE) || 0;
  const p = parseFloat(scoreP) || 0;
  
  return Math.round((d + a + e - p) * 1000) / 1000;
}

function compareForRanking(a, b) {
  // Tie-break: Total → E → D → A
  const aTotal = parseFloat(a.score_total) || 0;
  const bTotal = parseFloat(b.score_total) || 0;
  if (Math.abs(aTotal - bTotal) > 0.001) return bTotal - aTotal;
  
  const aE = parseFloat(a.score_e) || 0;
  const bE = parseFloat(b.score_e) || 0;
  if (Math.abs(aE - bE) > 0.001) return bE - aE;
  
  const aD = parseFloat(a.score_d) || 0;
  const bD = parseFloat(b.score_d) || 0;
  if (Math.abs(aD - bD) > 0.001) return bD - aD;
  
  const aA = parseFloat(a.score_a) || 0;
  const bA = parseFloat(b.score_a) || 0;
  return bA - aA;
}

function formatNum(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(3);
}

function formatCompetitorName(c) {
  if (!c) return '';
  if (c.nickname) {
    const parts = (c.full_name || '').split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} "${c.nickname}" ${parts.slice(1).join(' ')}`;
    }
  }
  return c.full_name || '';
}

// ═══════════════════════════════════════════════════════════════════
// FŐ KOMPONENS — Kategória pontozása
// ═══════════════════════════════════════════════════════════════════

export function ScoringView({ supabase, userRole, category, onBack, onChange }) {
  const isTeam = category.type === 'csapat'; // v0.9.50: csapatnál a helyezés külön fülön, nem a pontozóban
  const [entries, setEntries] = useState([]);
  const [results, setResults] = useState({});  // entryId → results obj
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);  // melyik sor szerkesztés alatt
  const [editForm, setEditForm] = useState({});
  const [showRankings, setShowRankings] = useState(false);

  const canFinalizeOrEdit = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(userRole);
  // v0.9.37: szülő pontozhat AKTÍV versenyen is (verseny közben segítségként).
  // Verseny lezárása után már csak edző írhat. Sándor 2026.05.17 #6.
  const canInputProvisional = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo', 'szulo'].includes(userRole);

  // ─── Adatok betöltése ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // 1. Startlista
      const { data: entriesData, error: eErr } = await supabase
        .from('startlist_entries')
        .select(`
          id, start_order, competitor_id, external_name, external_club,
          apparatus, performance_number, snapshot_kategoria, snapshot_korosztaly, snapshot_birth_year,
          competitors:competitor_id (id, full_name, nickname, kategoria, korosztaly, birth_year)
        `)
        .eq('competition_category_id', category.id)
        .order('start_order');
      if (eErr) throw eErr;

      // 2. Eredmények
      const entryIds = (entriesData || []).map(e => e.id);
      let resultsMap = {};
      if (entryIds.length > 0) {
        const { data: resData, error: rErr } = await supabase
          .from('results')
          .select('*')
          .in('startlist_entry_id', entryIds);
        if (rErr) throw rErr;
        (resData || []).forEach(r => {
          // Egy entry-hez több apparatus is lehet (több szer), de itt egyszerűsítünk:
          // a startlista soron eleve van apparatus → 1 sor = 1 pont
          resultsMap[r.startlist_entry_id] = r;
        });
      }

      setEntries(entriesData || []);
      setResults(resultsMap);
    } catch (err) {
      console.error('ScoringView load error:', err);
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [supabase, category.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Helyezések kiszámítása (csak megjelenítéshez) ────────────
  // v0.9.50: a kézi placement MINDIG felülírja a pontból számolt helyezést.
  const calculatedRankings = (() => {
    const withResults = entries.filter(e => {
      const r = results[e.id];
      return r && r.score_total !== null && r.score_total !== undefined;
    });
    const sorted = [...withResults].sort((a, b) => compareForRanking(results[a.id], results[b.id]));
    const rankMap = {};
    sorted.forEach((e, idx) => {
      rankMap[e.id] = idx + 1;
    });
    // Kézi helyezés felülírja a számoltat
    entries.forEach(e => {
      const r = results[e.id];
      if (r && r.placement !== null && r.placement !== undefined) {
        rankMap[e.id] = r.placement;
      }
    });
    return rankMap;
  })();

  // ─── Szerkesztés indítása ─────────────────────────────────────
  const startEdit = (entry) => {
    const r = results[entry.id];
    const isCsepeli = isCsepeliEntry(entry);
    setEditForm({
      score_db: r?.score_db ?? '',
      score_da: r?.score_da ?? '',
      score_d: r?.score_d ?? '',
      score_a: r?.score_a ?? '',
      score_e: r?.score_e ?? '',
      score_p: r?.score_p ?? '',
      score_total_manual: r?.score_total ?? '',
      placement_manual: r?.placement ?? '',
      apparatus: entry.apparatus || '',
      _isCsepeli: isCsepeli
    });
    setEditingId(entry.id);
    setError(null);
    setSuccessMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // ─── Mentés ───────────────────────────────────────────────────
  const handleSave = async (entry) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const f = editForm;
      const isCsepeli = f._isCsepeli;

      // Validáció
      const apparatusToSave = f.apparatus || entry.apparatus;
      const placementOnly = (f.placement_manual !== '' && f.placement_manual !== null)
        && f.score_total_manual === '' && f.score_d === '' && f.score_a === '' && f.score_e === '';
      if (!apparatusToSave && !placementOnly) {
        throw new Error('Szer kötelező! Válassz a legördülőből.');
      }

      // Pontok validálása
      const validateScore = (val, name, max) => {
        if (val === '' || val === null) return null;
        const n = parseFloat(val);
        if (isNaN(n)) throw new Error(`${name}: szám kell`);
        if (n < 0) throw new Error(`${name}: nem lehet negatív`);
        if (max && n > max) throw new Error(`${name}: max ${max}`);
        return n;
      };

      // DB+DA: mindenkinél opcionális (csepelinél tipikusan használt)
      const scoreDb = validateScore(f.score_db, 'DB', null);
      const scoreDa = validateScore(f.score_da, 'DA', null);
      let scoreD = validateScore(f.score_d, 'D', null);
      // Ha DB+DA van megadva és D nincs → D = DB + DA
      if (scoreD === null && (scoreDb !== null || scoreDa !== null)) {
        scoreD = (scoreDb || 0) + (scoreDa || 0);
      }
      const scoreA = validateScore(f.score_a, 'A', 10);
      const scoreE = validateScore(f.score_e, 'E', 10);
      const scoreP = validateScore(f.score_p, 'P', null);
      const totalManual = validateScore(f.score_total_manual, 'Total', null);
      const placementManual = f.placement_manual === '' || f.placement_manual === null
        ? null
        : parseInt(f.placement_manual, 10);
      if (placementManual !== null && (isNaN(placementManual) || placementManual < 1)) {
        throw new Error('Helyezés: pozitív egész szám kell');
      }

      // Total számítása: ha kézzel beírt → az; különben D+A+E-P
      let total;
      if (totalManual !== null) {
        total = totalManual;
      } else if (scoreD !== null || scoreA !== null || scoreE !== null) {
        total = calculateTotal(scoreDb, scoreDa, scoreD, scoreA, scoreE, scoreP);
      } else if (placementManual !== null) {
        // v0.9.50: pont nélkül is menthető, ha van kézi helyezés (sokszor csak helyezést hirdetnek)
        total = null;
      } else {
        throw new Error('Adj meg Total-t, D/A/E/P-t, vagy legalább egy kézi helyezést!');
      }

      // Konfirmáció ha extrém érték
      if (total !== null && total > 60) {
        throw new Error(`Total (${total}) túl magas (>60). Ellenőrizd a beírt értékeket.`);
      }
      if (total !== null && total > 40) {
        const ok = window.confirm(`Total = ${total.toFixed(3)}. Ez magasabb a szokásosnál (>40). Biztos jó?`);
        if (!ok) { setSaving(false); return; }
      }

      const existing = results[entry.id];

      // Audit nyom készítése ha módosítás
      let scoreHistory = existing?.score_history || [];
      if (existing) {
        const changes = [];
        if (existing.score_db !== scoreDb) changes.push({ field: 'DB', old: existing.score_db, new: scoreDb });
        if (existing.score_da !== scoreDa) changes.push({ field: 'DA', old: existing.score_da, new: scoreDa });
        if (existing.score_d !== scoreD) changes.push({ field: 'D', old: existing.score_d, new: scoreD });
        if (existing.score_a !== scoreA) changes.push({ field: 'A', old: existing.score_a, new: scoreA });
        if (existing.score_e !== scoreE) changes.push({ field: 'E', old: existing.score_e, new: scoreE });
        if (existing.score_p !== scoreP) changes.push({ field: 'P', old: existing.score_p, new: scoreP });
        if (changes.length > 0) {
          scoreHistory = [...scoreHistory, {
            date: new Date().toISOString(),
            changes,
            was_finalized: !existing.is_provisional
          }];
        }
      }

      const payload = {
        startlist_entry_id: entry.id,
        apparatus: apparatusToSave,
        score_db: scoreDb,
        score_da: scoreDa,
        score_d: scoreD,
        score_a: scoreA,
        score_e: scoreE,
        score_p: scoreP,
        score_total: total,
        placement: placementManual,
        modified_at: new Date().toISOString(),
        score_history: scoreHistory
      };

      if (existing) {
        const { error: updErr } = await supabase
          .from('results')
          .update(payload)
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        payload.is_provisional = true;
        const { error: insErr } = await supabase
          .from('results')
          .insert(payload);
        if (insErr) throw insErr;
      }

      // Apparatus mentés ha változott
      if (apparatusToSave !== entry.apparatus) {
        await supabase
          .from('startlist_entries')
          .update({ apparatus: apparatusToSave })
          .eq('id', entry.id);
      }

      setSuccessMsg('Pontok mentve!');
      setEditingId(null);
      await loadData();
      if (onChange) onChange();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  };

  // ─── Egyedi sor pont törlése ──────────────────────────────────
  const handleDelete = async (entry) => {
    const r = results[entry.id];
    if (!r) return;
    if (!window.confirm('Biztos törölni szeretnéd ennek a versenyzőnek a pontjait?')) return;
    setSaving(true);
    try {
      const { error: delErr } = await supabase.from('results').delete().eq('id', r.id);
      if (delErr) throw delErr;
      setSuccessMsg('Pontok törölve');
      await loadData();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Kategória véglegesítése ──────────────────────────────────
  const handleFinalize = async () => {
    if (!canFinalizeOrEdit) return;
    
    const pontozott = Object.values(results).filter(r => r.score_total !== null);
    if (pontozott.length === 0) {
      setError('Még nincs egyetlen pontozás sem.');
      return;
    }
    const nemPontozott = entries.length - pontozott.length;
    
    let msg = `${pontozott.length} versenyző pontozva.\n`;
    if (nemPontozott > 0) {
      msg += `${nemPontozott} versenyzőnek még nincs pontja.\n`;
    }
    msg += '\nVéglegesítés után csak edző és admin módosíthat. Folytatod?';
    
    if (!window.confirm(msg)) return;
    
    setSaving(true);
    try {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data?.user?.id;

      // Eredmények véglegesítése
      const resultIds = Object.values(results).map(r => r.id);
      if (resultIds.length > 0) {
        const { error: updErr } = await supabase
          .from('results')
          .update({
            is_provisional: false,
            finalized_by: userId,
            finalized_at: new Date().toISOString()
          })
          .in('id', resultIds);
        if (updErr) throw updErr;
      }

      // Kategória véglegesítése
      const { error: catErr } = await supabase
        .from('competition_categories')
        .update({
          is_finalized: true,
          finalized_by: userId,
          finalized_at: new Date().toISOString()
        })
        .eq('id', category.id);
      if (catErr) throw catErr;

      setSuccessMsg('Kategória véglegesítve!');
      await loadData();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Kategória újranyitása (édző/admin) ───────────────────────
  const handleReopen = async () => {
    if (!canFinalizeOrEdit) return;
    if (!window.confirm('Visszanyitod a kategóriát? A pontok ismét "Ideiglenes" állapotba kerülnek.')) return;
    
    setSaving(true);
    try {
      const resultIds = Object.values(results).map(r => r.id);
      if (resultIds.length > 0) {
        const { error: updErr } = await supabase
          .from('results')
          .update({ is_provisional: true, finalized_by: null, finalized_at: null })
          .in('id', resultIds);
        if (updErr) throw updErr;
      }
      const { error: catErr } = await supabase
        .from('competition_categories')
        .update({ is_finalized: false, finalized_by: null, finalized_at: null })
        .eq('id', category.id);
      if (catErr) throw catErr;
      setSuccessMsg('Kategória újranyitva');
      await loadData();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const isFinalized = category.is_finalized;
  const pontozottCount = Object.values(results).filter(r => r.score_total !== null).length;
  // canEdit: csak admin/edző/szülő-admin szerkeszthet, versenyző és szülő SOHA
  const canEdit = canInputProvisional && (!isFinalized || canFinalizeOrEdit);
  // Csak nézés mód jelzése
  const isReadOnly = !canInputProvisional;

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> Vissza
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" />
              {category.kategoria} · {category.korosztaly}
              {category.time_range && (
                <span className="text-sm font-normal text-gray-500">({category.time_range})</span>
              )}
            </h1>
            <div className="text-sm text-gray-600 mt-1">
              Pontozás · {pontozottCount} / {entries.length} versenyző
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isFinalized ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: COLORS.greenLight, color: COLORS.green }}>
                  <Lock className="w-3 h-3 inline mr-1" />
                  Véglegesítve
                </span>
                {canFinalizeOrEdit && (
                  <button onClick={handleReopen} disabled={saving} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                    Újranyitás
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: COLORS.amberLight, color: COLORS.amber }}>
                  <Unlock className="w-3 h-3 inline mr-1" />
                  Ideiglenes
                </span>
                <button onClick={() => setShowRankings(!showRankings)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1">
                  <Award className="w-3 h-3" /> {showRankings ? 'Startlista nézet' : 'Helyezések'}
                </button>
                {canFinalizeOrEdit && (
                  <button onClick={handleFinalize} disabled={saving || pontozottCount === 0} className="text-xs px-3 py-1.5 rounded text-white font-medium disabled:opacity-50" style={{ backgroundColor: COLORS.green }}>
                    <Lock className="w-3 h-3 inline mr-1" />
                    Véglegesítés
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Üzenetek */}
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {showRankings ? (
          <RankingsView entries={entries} results={results} calculatedRankings={calculatedRankings} userRole={userRole} />
        ) : (
          <StartlistScoringView 
            entries={entries} 
            results={results} 
            calculatedRankings={calculatedRankings}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            startEdit={startEdit}
            cancelEdit={cancelEdit}
            handleSave={handleSave}
            handleDelete={handleDelete}
            saving={saving}
            canEdit={canEdit}
            isFinalized={isFinalized}
            userRole={userRole}
            isTeam={isTeam}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Startlista pontozó nézet
// ═══════════════════════════════════════════════════════════════════

function StartlistScoringView({ 
  entries, results, calculatedRankings,
  editingId, editForm, setEditForm,
  startEdit, cancelEdit, handleSave, handleDelete, saving,
  canEdit, isFinalized, userRole, isTeam
}) {
  if (entries.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-500">Nincs startlista bejegyzés.</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {entries.map(entry => {
        const r = results[entry.id];
        const isCsepeli = isCsepeliEntry(entry);
        const displayName = entry.competitors 
          ? formatCompetitorName(entry.competitors)
          : entry.external_name;
        const displayClub = entry.competitors 
          ? 'Csepeli RG Club'
          : entry.external_club;
        const apparatusLabel = entry.apparatus 
          ? formatApparatus(entry.apparatus) 
          : 'Választott';
        const rank = calculatedRankings[entry.id];
        const isEditing = editingId === entry.id;

        return (
          <div 
            key={entry.id} 
            className="p-3"
            style={isCsepeli ? { backgroundColor: COLORS.redPink, borderLeft: `3px solid ${COLORS.red}` } : {}}
          >
            {/* Fejléc sor */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 text-center font-medium text-gray-500">{entry.start_order}.</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1">
                  {isCsepeli && <Star className="w-3 h-3" style={{ color: COLORS.red, fill: COLORS.red }} />}
                  <span style={isCsepeli ? { color: COLORS.red } : {}}>{displayName}</span>
                  {entry.performance_number && (
                    <span className="text-xs font-normal text-gray-500">· {entry.performance_number}. bem.</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {displayClub} · {apparatusLabel}
                </div>
              </div>
              {rank && (
                <div className="text-sm font-semibold" style={{ color: rank === 1 ? COLORS.amber : (rank === 2 ? COLORS.secondary : (rank === 3 ? '#92400E' : COLORS.primary)) }}>
                  {rank}. hely
                </div>
              )}
              {!isEditing && r && r.score_total !== null && (
                <div className="text-sm font-semibold">{formatNum(r.score_total)}</div>
              )}
              {!isEditing && canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-white" title={r ? 'Módosítás' : 'Pontozás'}>
                    {r ? <Edit2 className="w-4 h-4 text-gray-600" /> : <Save className="w-4 h-4 text-gray-600" />}
                  </button>
                  {r && (
                    <button onClick={() => handleDelete(entry)} className="p-1.5 rounded hover:bg-white" title="Pontok törlése">
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Szerkesztő űrlap */}
            {isEditing && (
              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                {/* Apparatus választó ha Választott */}
                {!entry.apparatus && (
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 block mb-1">Szer * (kötelező megadni)</label>
                    <select
                      value={editForm.apparatus || ''}
                      onChange={(e) => setEditForm({ ...editForm, apparatus: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="">— válassz —</option>
                      {Object.entries(APPARATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Pont mezők — mindenki ugyanazt látja */}
                <div className="text-xs text-gray-600 mb-2">
                  💡 Csak Total kötelező. DB/DA/D/A/E/P opcionális. Ha kitöltöd, abból számolódik a Total.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ScoreInput label="DB" value={editForm.score_db} onChange={v => setEditForm({...editForm, score_db: v})} />
                  <ScoreInput label="DA" value={editForm.score_da} onChange={v => setEditForm({...editForm, score_da: v})} />
                  <ScoreInput 
                    label="D" 
                    value={editForm.score_d} 
                    onChange={v => setEditForm({...editForm, score_d: v})}
                    placeholder={
                      ((parseFloat(editForm.score_db) || 0) + (parseFloat(editForm.score_da) || 0) > 0)
                        ? ((parseFloat(editForm.score_db) || 0) + (parseFloat(editForm.score_da) || 0)).toFixed(2)
                        : ''
                    }
                  />
                  <ScoreInput label="A (max 10)" value={editForm.score_a} onChange={v => setEditForm({...editForm, score_a: v})} max="10" />
                  <ScoreInput label="E (max 10)" value={editForm.score_e} onChange={v => setEditForm({...editForm, score_e: v})} max="10" />
                  <ScoreInput label="P" value={editForm.score_p} onChange={v => setEditForm({...editForm, score_p: v})} />
                </div>
                
                {/* Total mező - mindenkinél elérhető (manuális beírás VAGY auto) */}
                <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                  <label className="text-xs text-gray-700 block mb-1 font-medium">
                    Total * (kötelező — vagy add meg D/A/E mezőket fent és magától számolódik)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={editForm.score_total_manual}
                      onChange={(e) => setEditForm({...editForm, score_total_manual: e.target.value})}
                      placeholder={
                        (editForm.score_d || editForm.score_a || editForm.score_e)
                          ? `auto: ${calculateTotal(editForm.score_db, editForm.score_da, editForm.score_d, editForm.score_a, editForm.score_e, editForm.score_p).toFixed(3)}`
                          : 'pl. 21.500'
                      }
                      className="flex-1 px-2 py-1.5 text-base font-semibold border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm({...editForm, score_total_manual: ''})}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      title="Auto-számolásra állít"
                    >
                      auto
                    </button>
                  </div>
                </div>
                
                {/* v0.9.50: Kézi helyezés — egyéninél a pontozóban; csapatnál külön fülön (itt rejtve) */}
                {!isTeam && (
                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                  <label className="text-xs text-gray-700 block mb-1 font-medium">
                    Helyezés (kézi) — felülírja a pontból számoltat, pont nélkül is megadható
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editForm.placement_manual}
                      onChange={(e) => setEditForm({...editForm, placement_manual: e.target.value})}
                      placeholder="pl. 1"
                      className="flex-1 px-2 py-1.5 text-base font-semibold border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm({...editForm, placement_manual: ''})}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      title="Kézi helyezés törlése (vissza a számolthoz)"
                    >
                      törlés
                    </button>
                  </div>
                </div>
                )}
                
                {/* Gombok */}
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => handleSave(entry)} 
                    disabled={saving}
                    className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
                    style={{ backgroundColor: COLORS.green }}
                  >
                    {saving ? <Loader className="w-4 h-4 animate-spin inline" /> : <Save className="w-4 h-4 inline mr-1" />}
                    Mentés
                  </button>
                  <button onClick={cancelEdit} className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50">
                    Mégse
                  </button>
                </div>

                {/* Audit nyom (ha van) */}
                {r?.score_history?.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Korábbi módosítások ({r.score_history.length})</summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {r.score_history.slice(-5).reverse().map((h, i) => (
                        <div key={i} className="p-2 bg-gray-50 rounded">
                          <div className="text-gray-500">{new Date(h.date).toLocaleString('hu-HU')}</div>
                          {h.changes?.map((c, j) => (
                            <div key={j}>{c.field}: {c.old ?? '—'} → {c.new ?? '—'}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Részletes pont megjelenítés - mindenkinél */}
            {!isEditing && r && (
              <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-2 ml-11">
                {r.score_db !== null && r.score_db !== undefined && <span>DB: {formatNum(r.score_db)}</span>}
                {r.score_da !== null && r.score_da !== undefined && <span>DA: {formatNum(r.score_da)}</span>}
                {r.score_d !== null && r.score_d !== undefined && <span>D: {formatNum(r.score_d)}</span>}
                {r.score_a !== null && r.score_a !== undefined && <span>A: {formatNum(r.score_a)}</span>}
                {r.score_e !== null && r.score_e !== undefined && <span>E: {formatNum(r.score_e)}</span>}
                {r.score_p !== null && r.score_p !== undefined && r.score_p > 0 && <span>P: {formatNum(r.score_p)}</span>}
                {r.is_provisional ? (
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: COLORS.amberLight, color: COLORS.amber }}>ideiglenes</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: COLORS.greenLight, color: COLORS.green }}>végleges</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Helyezések nézet
// ═══════════════════════════════════════════════════════════════════

function RankingsView({ entries, results, calculatedRankings, userRole }) {
  const sortedEntries = [...entries]
    .filter(e => {
      const r = results[e.id];
      // v0.9.50: pontozott VAGY kézi helyezéssel rendelkező sorok
      return r && (
        (r.score_total !== null && r.score_total !== undefined) ||
        (r.placement !== null && r.placement !== undefined)
      );
    })
    .sort((a, b) => (calculatedRankings[a.id] ?? 999) - (calculatedRankings[b.id] ?? 999));

  if (sortedEntries.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-500">Még nincs pontozott versenyző.</div>;
  }

  return (
    <div>
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
        <Award className="w-4 h-4 inline mr-1" />
        Helyezések (Tie-break: Total → E → D → A)
      </div>
      <div className="divide-y divide-gray-100">
        {sortedEntries.map(entry => {
          const r = results[entry.id];
          const isCsepeli = isCsepeliEntry(entry);
          const rank = calculatedRankings[entry.id];
          const displayName = entry.competitors 
            ? formatCompetitorName(entry.competitors)
            : entry.external_name;
          const displayClub = entry.competitors 
            ? 'Csepeli RG Club'
            : entry.external_club;
          const apparatusLabel = entry.apparatus 
            ? formatApparatus(entry.apparatus) 
            : '—';

          return (
            <div 
              key={entry.id} 
              className="p-3 flex items-center gap-3 flex-wrap"
              style={isCsepeli ? { backgroundColor: COLORS.redPink, borderLeft: `3px solid ${COLORS.red}` } : {}}
            >
              <div className="w-10 text-center">
                <div className="font-bold text-lg" style={{ color: rank === 1 ? COLORS.amber : (rank === 2 ? COLORS.secondary : (rank === 3 ? '#92400E' : COLORS.primary)) }}>
                  {rank}.
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1">
                  {isCsepeli && <Star className="w-3 h-3" style={{ color: COLORS.red, fill: COLORS.red }} />}
                  <span style={isCsepeli ? { color: COLORS.red } : {}}>{displayName}</span>
                  {entry.performance_number && (
                    <span className="text-xs font-normal text-gray-500">· {entry.performance_number}. bem.</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{displayClub} · {apparatusLabel}</div>
                <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                  {r.score_d !== null && r.score_d !== undefined && <span>D: {formatNum(r.score_d)}</span>}
                  {r.score_a !== null && r.score_a !== undefined && <span>A: {formatNum(r.score_a)}</span>}
                  {r.score_e !== null && r.score_e !== undefined && <span>E: {formatNum(r.score_e)}</span>}
                  {r.score_p !== null && r.score_p !== undefined && r.score_p > 0 && <span>P: {formatNum(r.score_p)}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{formatNum(r.score_total)}</div>
                {r.is_provisional && (
                  <div className="text-xs" style={{ color: COLORS.amber }}>ideiglenes</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Pont input mező (helper)
// ═══════════════════════════════════════════════════════════════════

function ScoreInput({ label, value, onChange, placeholder, max }) {
  return (
    <div>
      <label className="text-xs text-gray-600 block mb-0.5">{label}</label>
      <input
        type="number"
        step="0.001"
        min="0"
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
