// ═══════════════════════════════════════════════════════════════════
// „Rólam” — kedvencek és célok (v0.9.64), Sándor 2026.10.06:
// „a gyerekek tudjanak beírni olyat, hogy kedvenc versenyem, legjobb
// versenyélmény, stb … és hozzá hogy célod”.
// Írja: a versenyző maga vagy a szülője, illetve az edzők; látja: minden
// bejelentkezett klubtag (a klubtársak is). Tábla: competitor_stories
// (docs/sql/2026-10-06_v0.9.64_kedvencek-celok.sql).
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Loader, Plus, Trash2, Check, X, Edit2 } from 'lucide-react';

export const STORY_KINDS = [
  { kind: 'kedvenc_verseny', label: 'Kedvenc versenyem', icon: '🏆', placeholder: 'pl. Wroclaw Cup — mert ott volt az első nemzetközi versenyem' },
  { kind: 'legjobb_elmeny', label: 'Legjobb versenyélményem', icon: '✨', placeholder: 'pl. amikor a csapattal együtt álltunk a dobogón' },
  { kind: 'kedvenc_szer', label: 'Kedvenc szerem', icon: '🎀', placeholder: 'pl. szalag — mert olyan, mintha táncolna' },
  { kind: 'kedvenc_elem', label: 'Kedvenc elemem', icon: '🤸', placeholder: 'pl. spárga ugrás' },
  { kind: 'cel', label: 'Céljaim', icon: '🎯', placeholder: 'pl. idén bekerülni a magyar bajnokság döntőjébe', multi: true }
];

const MAX = 500;

function StoryEditor({ initial = '', placeholder, onSave, onCancel, saving }) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-1.5">
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, MAX))} rows={2} autoFocus
                placeholder={placeholder}
                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-400" />
      <div className="flex items-center gap-2">
        <button onClick={() => onSave(text.trim())} disabled={saving || !text.trim()}
                className="text-xs px-3 py-1.5 rounded text-white font-medium disabled:opacity-50" style={{ backgroundColor: '#BE185D' }}>
          {saving ? <Loader className="w-3 h-3 inline animate-spin" /> : <Check className="w-3 h-3 inline mr-1" />}Mentés
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50">
          <X className="w-3 h-3 inline mr-1" />Mégse
        </button>
        <span className="text-[10px] text-gray-400 ml-auto">{text.length}/{MAX}</span>
      </div>
    </div>
  );
}

export function StoriesPanel({ supabase, competitorId, canWrite = false, title = 'Rólam — kedvencek és célok' }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // { kind, id|null }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('competitor_stories')
      .select('id, kind, body, year, achieved, updated_at')
      .eq('competitor_id', competitorId)
      .order('created_at', { ascending: true });
    if (err) { setError(err.message); setItems([]); return; }
    setItems(data || []);
  }, [supabase, competitorId]);

  useEffect(() => { if (competitorId) load(); }, [load, competitorId]);

  const save = async (kind, id, body) => {
    setSaving(true); setError(null);
    try {
      if (id) {
        const { error: err } = await supabase.from('competitor_stories')
          .update({ body, updated_at: new Date().toISOString() }).eq('id', id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('competitor_stories')
          .insert({ competitor_id: competitorId, kind, body });
        if (err) throw err;
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm('Biztos törlöd ezt a bejegyzést?')) return;
    const { error: err } = await supabase.from('competitor_stories').delete().eq('id', item.id);
    if (err) setError('Törlés sikertelen: ' + err.message); else load();
  };

  const toggleAchieved = async (item) => {
    const { error: err } = await supabase.from('competitor_stories')
      .update({ achieved: !item.achieved, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (err) setError('Mentés sikertelen: ' + err.message); else load();
  };

  if (items === null) return null;
  const anyContent = items.length > 0;
  if (!anyContent && !canWrite) return null; // olvasónak üres blokkot nem mutatunk

  return (
    <div className="rounded-lg p-3 border space-y-3" style={{ borderColor: '#FBCFE8', backgroundColor: '#FFF7FB' }}>
      <div className="font-semibold text-sm" style={{ color: '#9D174D' }}>💗 {title}</div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      {STORY_KINDS.map(k => {
        const list = items.filter(i => i.kind === k.kind);
        if (!canWrite && list.length === 0) return null;
        const editingThis = editing && editing.kind === k.kind;
        return (
          <div key={k.kind}>
            <div className="text-xs font-semibold text-gray-700 mb-1">{k.icon} {k.label}</div>
            <div className="space-y-1.5">
              {list.map(item => (
                editingThis && editing.id === item.id ? (
                  <StoryEditor key={item.id} initial={item.body} placeholder={k.placeholder} saving={saving}
                               onSave={(body) => save(k.kind, item.id, body)} onCancel={() => setEditing(null)} />
                ) : (
                  <div key={item.id} className="flex items-start gap-2 bg-white rounded border px-2 py-1.5" style={{ borderColor: '#FBCFE8' }}>
                    {k.kind === 'cel' && (
                      <button onClick={canWrite ? () => toggleAchieved(item) : undefined} disabled={!canWrite}
                              title={item.achieved ? 'Elértem!' : (canWrite ? 'Megjelölöm: elértem' : 'Még dolgozik rajta')}
                              className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                              style={{ borderColor: item.achieved ? '#15803D' : '#D1D5DB', backgroundColor: item.achieved ? '#15803D' : 'white' }}>
                        {item.achieved && <Check className="w-3 h-3 text-white" />}
                      </button>
                    )}
                    <div className={`flex-1 text-sm whitespace-pre-wrap break-words ${item.achieved ? 'text-gray-500' : 'text-gray-800'}`}>
                      {item.body}
                      {k.kind === 'cel' && (
                        <span className="text-[10px] ml-1.5" style={{ color: item.achieved ? '#15803D' : '#9CA3AF' }}>
                          {item.achieved ? '✓ elértem!' : `· ${item.year}`}
                        </span>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditing({ kind: k.kind, id: item.id })} className="p-1 rounded hover:bg-pink-50" title="Szerkesztés">
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => remove(item)} className="p-1 rounded hover:bg-pink-50" title="Törlés">
                          <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              ))}
              {canWrite && editingThis && editing.id === null && (
                <StoryEditor placeholder={k.placeholder} saving={saving}
                             onSave={(body) => save(k.kind, null, body)} onCancel={() => setEditing(null)} />
              )}
              {canWrite && !editingThis && (k.multi || list.length === 0) && (
                <button onClick={() => setEditing({ kind: k.kind, id: null })}
                        className="text-xs font-medium flex items-center gap-1" style={{ color: '#BE185D' }}>
                  <Plus className="w-3 h-3" /> {k.multi ? 'Új cél' : 'Beírom'}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {canWrite && (
        <div className="text-[10px] text-gray-400">Ezt a klubtársaid is látják a profilodon.</div>
      )}
    </div>
  );
}
