// ═══════════════════════════════════════════════════════════════════
// PONTREGISZTER v0.9.24 — EDZŐI NAPLÓ
// Önálló menüpont az összes edzői megjegyzés egy helyen
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, Loader, AlertCircle, Search,
  MessageCircle, Lock, ArrowLeft, Calendar, User
} from 'lucide-react';

const COLORS = {
  blue: '#1e3a8a',
  blueDark: '#1e3a8a',
  red: '#BE123C',
  gray200: '#e5e7eb',
  gray700: '#374151'
};

// ═══════════════════════════════════════════════════════════════════
// MAIN: CoachNotesView
// ═══════════════════════════════════════════════════════════════════

export function CoachNotesView({ supabase, userRole }) {
  const [notes, setNotes] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [authors, setAuthors] = useState({});
  const [error, setError] = useState(null);
  const [filterCompetitor, setFilterCompetitor] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | note
  
  const canWrite = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(userRole);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Megjegyzések + versenyzők egyszerre
      const [notesRes, compRes] = await Promise.all([
        supabase
          .from('coach_notes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('competitors')
          .select('id, full_name, nickname, kategoria, korosztaly')
          .eq('is_active', true)
          .eq('is_provisional', false)
          .order('full_name')
      ]);
      
      if (notesRes.error) throw notesRes.error;
      setNotes(notesRes.data || []);
      setCompetitors(compRes.data || []);

      // Szerzők lekérdezése
      const authorIds = [...new Set((notesRes.data || []).map(n => n.created_by).filter(Boolean))];
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p.full_name; });
        setAuthors(map);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (note) => {
    if (!window.confirm('Biztos törlöd ezt a megjegyzést?')) return;
    try {
      await supabase.from('coach_notes').delete().eq('id', note.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (editing !== null) {
    return (
      <CoachNoteForm
        supabase={supabase}
        note={editing === 'new' ? null : editing}
        competitors={competitors}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (notes === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Szűrés
  let filtered = notes;
  if (filterCompetitor !== 'all') {
    filtered = filtered.filter(n => n.competitor_id === filterCompetitor);
  }
  if (filterYear !== 'all') {
    filtered = filtered.filter(n => n.created_at?.slice(0, 4) === filterYear);
  }

  // Elérhető évek (csökkenő sorrendben)
  const yearSet = new Set();
  notes.forEach(n => { if (n.created_at) yearSet.add(n.created_at.slice(0, 4)); });
  const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

  // Versenyző név lookup
  const competitorMap = {};
  competitors.forEach(c => { competitorMap[c.id] = c; });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatCompName = (c) => {
    if (!c) return 'Versenyző';
    if (c.nickname) {
      const parts = c.full_name.split(' ');
      return `${parts[0]} "${c.nickname}" ${parts.slice(1).join(' ')}`;
    }
    return c.full_name;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: COLORS.blueDark }}>
        📝 Edzői napló
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        <Lock className="w-3 h-3 inline mr-1" /> Csak edzők és a versenyzők szülei látják a saját gyermekükre vonatkozó megjegyzéseket.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 mb-4 shadow-sm">
        {/* Fejléc: szűrők + új gomb */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-gray-600">Szűrés:</span>
            <select
              value={filterCompetitor}
              onChange={(e) => setFilterCompetitor(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-sm"
            >
              <option value="all">Minden versenyző</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>
                  {formatCompName(c)}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-sm"
            >
              <option value="all">Minden év</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">· {filtered.length} bejegyzés</span>
          </div>

          {canWrite && (
            <button
              onClick={() => setEditing('new')}
              className="px-4 py-2 rounded text-white text-sm font-medium flex items-center gap-1"
              style={{ backgroundColor: '#d97706' }}
            >
              <Plus className="w-4 h-4" /> Új megjegyzés
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              {notes.length === 0 
                ? 'Még nincs bejegyzés. Új megjegyzéssel kezdheted.' 
                : 'Nincs találat a szűrőre.'}
            </div>
          ) : (
            filtered.map(note => {
              const comp = competitorMap[note.competitor_id];
              const authorName = authors[note.created_by] || 'Edző';
              const isModified = note.modified_at && note.modified_at !== note.created_at;
              return (
                <div 
                  key={note.id} 
                  className="bg-white rounded-lg p-3 border-l-4 text-sm"
                  style={{ 
                    borderLeftColor: '#d97706', 
                    borderColor: COLORS.gray200, 
                    borderWidth: '0.5px', 
                    borderStyle: 'solid', 
                    borderLeftWidth: '3px',
                    backgroundColor: '#FFFBEB'
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <MessageCircle className="w-3 h-3 flex-shrink-0" style={{ color: '#d97706' }} />
                      <span className="font-semibold" style={{ color: '#92400e' }}>
                        {authorName}
                      </span>
                      <span className="text-gray-500">·</span>
                      <span className="font-semibold flex items-center gap-0.5" style={{ color: COLORS.red }}>
                        ★ {formatCompName(comp)}
                      </span>
                      {comp && (
                        <span className="text-xs text-gray-400">
                          ({comp.kategoria} {comp.korosztaly})
                        </span>
                      )}
                      <span className="text-gray-500">· {formatDate(note.created_at)}</span>
                      {isModified && <span className="text-gray-400 italic text-xs">(szerkesztett)</span>}
                    </div>
                    {canWrite && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => setEditing(note)}
                          className="p-1 hover:bg-amber-100 rounded" 
                          title="Szerkesztés"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button 
                          onClick={() => handleDelete(note)}
                          className="p-1 hover:bg-red-50 rounded" 
                          title="Törlés"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {note.content}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CoachNoteForm - megjegyzés szerkesztő űrlap
// ═══════════════════════════════════════════════════════════════════

function CoachNoteForm({ supabase, note, competitors, onSaved, onCancel }) {
  const [competitorId, setCompetitorId] = useState(note?.competitor_id || '');
  const [content, setContent] = useState(note?.content || '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEdit = !!note;

  const filteredCompetitors = competitors.filter(c => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return c.full_name.toLowerCase().includes(lower) ||
           (c.nickname || '').toLowerCase().includes(lower);
  });

  const formatCompName = (c) => {
    if (!c) return '';
    if (c.nickname) {
      const parts = c.full_name.split(' ');
      return `${parts[0]} "${c.nickname}" ${parts.slice(1).join(' ')}`;
    }
    return c.full_name;
  };

  const selectedComp = competitors.find(c => c.id === competitorId);

  const save = async () => {
    setError(null);
    if (!competitorId) {
      setError('Válassz egy versenyzőt!');
      return;
    }
    if (!content.trim()) {
      setError('A megjegyzés nem lehet üres!');
      return;
    }
    setSaving(true);
    try {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data?.user?.id;

      if (isEdit) {
        await supabase.from('coach_notes').update({
          competitor_id: competitorId,
          content: content.trim(),
          modified_by: userId,
          modified_at: new Date().toISOString()
        }).eq('id', note.id);
      } else {
        await supabase.from('coach_notes').insert({
          competitor_id: competitorId,
          content: content.trim(),
          created_by: userId
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold" style={{ color: COLORS.blueDark }}>
          {isEdit ? 'Megjegyzés szerkesztése' : 'Új edzői megjegyzés'}
        </h2>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm">
        {/* Versenyző választó */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Versenyző *
          </label>
          {selectedComp && !search && (
            <div className="mb-2 flex items-center justify-between bg-amber-50 border border-amber-300 rounded p-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold" style={{ color: COLORS.red }}>
                  ★ {formatCompName(selectedComp)}
                </span>
                <span className="text-xs text-gray-500">
                  ({selectedComp.kategoria} {selectedComp.korosztaly})
                </span>
              </div>
              <button 
                onClick={() => { setCompetitorId(''); setSearch(''); }}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                Másik versenyző...
              </button>
            </div>
          )}
          
          {(!selectedComp || search) && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Versenyző keresése név alapján..."
                  className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus={!isEdit}
                />
              </div>
              <div className="mt-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded">
                {filteredCompetitors.length === 0 ? (
                  <div className="p-2 text-sm text-gray-400 italic">Nincs találat.</div>
                ) : (
                  filteredCompetitors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCompetitorId(c.id); setSearch(''); }}
                      className="w-full text-left px-2 py-1.5 hover:bg-amber-50 text-sm border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: COLORS.red }}>★</span>
                        <span className="font-medium">{formatCompName(c)}</span>
                        <span className="text-xs text-gray-500">
                          ({c.kategoria} {c.korosztaly})
                        </span>
                      </span>
                      {competitorId === c.id && <span className="text-green-600 text-xs">✓</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Szöveg */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Megjegyzés *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Pl. Fejlődési észrevétel, edzői megfigyelés, orvosi infó, egyéb..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
            rows="4"
          />
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={saving || !competitorId || !content.trim()}
            className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1"
            style={{ backgroundColor: '#d97706' }}
          >
            {saving 
              ? <Loader className="w-4 h-4 animate-spin" /> 
              : <Save className="w-4 h-4" />}
            Mentés
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
          >
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
}
