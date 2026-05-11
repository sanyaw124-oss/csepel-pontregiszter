// ═══════════════════════════════════════════════════════════════════
// Pontregiszter v0.9 — Klub-csapat modul (egyéni versenyhez)
// ═══════════════════════════════════════════════════════════════════
// Funkciók:
//   - Édző bármikor (verseny előtt/után) létrehozhat klub-csapatot
//   - Csapat: név, korosztály-leírás, helyezés, opcionális pont
//   - Tagok: csak csepeli (klubtag) versenyzők
//   - Több versenyző, több korosztály lehet egy csapatban
//   - Manuális helyezés-bevitel (nem auto-számolt)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Save, Loader, AlertCircle, Check, X, Edit2, 
  Users, Trophy, ArrowLeft, Trash2
} from 'lucide-react';

const COLORS = {
  primary: '#1F2937',
  secondary: '#6B7280',
  red: '#BE123C',
  redPink: '#FCE7F3',
  amber: '#B45309',
  amberLight: '#FEF3C7',
  green: '#15803D',
  greenLight: '#D1FAE5',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB'
};

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
// FŐ KOMPONENS — Klub-csapatok listája egy versenyhez
// ═══════════════════════════════════════════════════════════════════

export function CompetitionTeamsView({ supabase, userRole, competitionId, onChange }) {
  const [teams, setTeams] = useState([]);
  const [csepeliCompetitors, setCsepeliCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | team object
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const canEdit = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(userRole);

  // ─── Adatok betöltése ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Csapatok + tagjaik
      const { data: teamsData, error: tErr } = await supabase
        .from('competition_teams')
        .select(`
          *,
          competition_team_members (
            id, position,
            competitor:competitor_id (id, full_name, nickname, kategoria, korosztaly, birth_year)
          )
        `)
        .eq('competition_id', competitionId)
        .order('placement', { nullsFirst: false });
      if (tErr) throw tErr;

      // Csepeli versenyzők (csak klubtagok)
      const { data: compsData, error: cErr } = await supabase
        .from('competitors')
        .select('id, full_name, nickname, kategoria, korosztaly, birth_year, is_active, is_club_member')
        .eq('is_club_member', true)
        .order('full_name');
      if (cErr) throw cErr;

      setTeams(teamsData || []);
      setCsepeliCompetitors(compsData || []);
    } catch (err) {
      console.error('CompetitionTeamsView load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, competitionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Mentés (új vagy szerkesztés) ─────────────────────────────
  const handleSave = async (formData, memberIds) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const isNew = editing === 'new';
      const teamPayload = {
        competition_id: competitionId,
        name: formData.name.trim(),
        age_range: formData.age_range?.trim() || null,
        placement: formData.placement ? parseInt(formData.placement, 10) : null,
        score: formData.score ? parseFloat(formData.score) : null,
        notes: formData.notes?.trim() || null,
        modified_at: new Date().toISOString()
      };

      let teamId;
      if (isNew) {
        const { data, error } = await supabase
          .from('competition_teams')
          .insert(teamPayload)
          .select('id')
          .single();
        if (error) throw error;
        teamId = data.id;
      } else {
        teamId = editing.id;
        const { error } = await supabase
          .from('competition_teams')
          .update(teamPayload)
          .eq('id', teamId);
        if (error) throw error;
      }

      // Tagok frissítése: töröljük a régieket, beszúrjuk az újakat
      if (!isNew) {
        await supabase.from('competition_team_members').delete().eq('team_id', teamId);
      }
      if (memberIds.length > 0) {
        const rows = memberIds.map((cid, idx) => ({
          team_id: teamId,
          competitor_id: cid,
          position: idx + 1
        }));
        const { error: mErr } = await supabase.from('competition_team_members').insert(rows);
        if (mErr) throw mErr;
      }

      setSuccessMsg(isNew ? 'Csapat létrehozva' : 'Csapat módosítva');
      setEditing(null);
      await loadData();
      if (onChange) onChange();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  // ─── Csapat törlése ───────────────────────────────────────────
  const handleDelete = async (team) => {
    if (!window.confirm(`Biztos törölni szeretnéd a "${team.name}" csapatot?`)) return;
    try {
      const { error } = await supabase.from('competition_teams').delete().eq('id', team.id);
      if (error) throw error;
      setSuccessMsg('Csapat törölve');
      await loadData();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (editing) {
    return (
      <CompetitionTeamForm
        team={editing === 'new' ? null : editing}
        csepeliCompetitors={csepeliCompetitors}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
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

      {/* Új csapat gomb */}
      {canEdit && (
        <button
          onClick={() => setEditing('new')}
          className="w-full sm:w-auto px-4 py-2 rounded text-white font-medium flex items-center justify-center gap-2"
          style={{ backgroundColor: COLORS.red }}
        >
          <Plus className="w-4 h-4" />
          Új csapat
        </button>
      )}

      {/* Csapatok listája */}
      {teams.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          Még nincs rögzített csapat ezen a versenyen.
          {canEdit && <div className="mt-1">Kattints az "Új csapat" gombra a hozzáadáshoz.</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map(team => (
            <TeamCard 
              key={team.id} 
              team={team} 
              canEdit={canEdit}
              onEdit={() => setEditing(team)}
              onDelete={() => handleDelete(team)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Csapat kártya (listázás)
// ═══════════════════════════════════════════════════════════════════

function TeamCard({ team, canEdit, onEdit, onDelete }) {
  const members = team.competition_team_members || [];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3" style={{ borderLeft: `3px solid ${COLORS.red}` }}>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: COLORS.red }}>{team.name}</span>
            {team.age_range && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: COLORS.gray100, color: COLORS.secondary }}>
                {team.age_range}
              </span>
            )}
          </div>
          {team.placement && (
            <div className="mt-1 flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: team.placement === 1 ? COLORS.amber : (team.placement === 2 ? COLORS.secondary : (team.placement === 3 ? '#92400E' : COLORS.primary)) }} />
              <span className="font-medium">{team.placement}. hely</span>
              {team.score && <span className="text-sm text-gray-600">· {parseFloat(team.score).toFixed(3)} pont</span>}
            </div>
          )}
          {team.notes && (
            <div className="mt-1 text-xs text-gray-600 italic">{team.notes}</div>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100" title="Szerkesztés">
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-gray-100" title="Törlés">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>

      {/* Tagok */}
      {members.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Tagok ({members.length})</div>
          <div className="flex flex-wrap gap-1">
            {members.map(m => (
              <span 
                key={m.id} 
                className="text-xs px-2 py-1 rounded" 
                style={{ backgroundColor: COLORS.redPink, color: COLORS.red }}
              >
                {m.competitor ? formatCompetitorName(m.competitor) : '(törölt versenyző)'}
                {m.competitor?.kategoria && (
                  <span className="text-gray-500 ml-1">({m.competitor.kategoria})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Csapat szerkesztő űrlap
// ═══════════════════════════════════════════════════════════════════

function CompetitionTeamForm({ team, csepeliCompetitors, onSave, onCancel }) {
  const isNew = !team;
  const [form, setForm] = useState({
    name: team?.name || '',
    age_range: team?.age_range || '',
    placement: team?.placement || '',
    score: team?.score || '',
    notes: team?.notes || ''
  });
  const [memberIds, setMemberIds] = useState(
    team?.competition_team_members?.map(m => m.competitor?.id).filter(Boolean) || []
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const toggleMember = (cid) => {
    setMemberIds(prev => 
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]
    );
  };

  const handleSubmit = async () => {
    setLocalError(null);
    if (!form.name.trim()) {
      setLocalError('A csapat neve kötelező.');
      return;
    }
    if (memberIds.length === 0) {
      setLocalError('Legalább egy tagot ki kell választani.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form, memberIds);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Szűrt versenyzők (kereséshez)
  const filtered = search 
    ? csepeliCompetitors.filter(c => 
        (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.nickname || '').toLowerCase().includes(search.toLowerCase())
      )
    : csepeliCompetitors;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isNew ? 'Új csapat' : 'Csapat szerkesztése'}
          </h3>
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            Mégse
          </button>
        </div>

        {localError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {localError}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Csapat neve *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='pl. "Csepel A csapat"'
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              autoFocus
            />
          </Field>

          <Field label="Korosztály / leírás (opcionális)">
            <input
              type="text"
              value={form.age_range}
              onChange={(e) => setForm({ ...form, age_range: e.target.value })}
              placeholder='pl. "2010-2011" vagy "VSK II Junior"'
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Helyezés">
              <input
                type="number"
                min="1"
                value={form.placement}
                onChange={(e) => setForm({ ...form, placement: e.target.value })}
                placeholder="pl. 1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              />
            </Field>
            <Field label="Pont (opcionális)">
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                placeholder="pl. 75.450"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              />
            </Field>
          </div>

          <Field label="Megjegyzés (opcionális)">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder='pl. "Magyar Bajnokság győztes csapat"'
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
            />
          </Field>
        </div>
      </div>

      {/* Tagok kiválasztása */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="mb-3">
          <div className="font-medium text-sm mb-1">Csapat tagjai * ({memberIds.length} kiválasztva)</div>
          <div className="text-xs text-gray-500">Csak csepeli (klubtag) versenyzők szerepelhetnek.</div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés név vagy becenév szerint..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-3"
        />

        <div className="max-h-72 overflow-y-auto space-y-1 border border-gray-200 rounded p-2">
          {filtered.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-2 text-center">Nincs találat.</div>
          ) : filtered.map(c => {
            const checked = memberIds.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                style={checked ? { backgroundColor: COLORS.redPink } : {}}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(c.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={checked ? { color: COLORS.red } : {}}>
                    {formatCompetitorName(c)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.kategoria} · {c.korosztaly}
                    {c.birth_year && ` · ${c.birth_year}`}
                    {!c.is_active && ' · inaktív'}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Mentés / Mégse gombok */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 sm:flex-none px-6 py-2.5 rounded font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: COLORS.green }}
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          Mégse
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  );
}
