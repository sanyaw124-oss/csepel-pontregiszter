// ═══════════════════════════════════════════════════════════════════
// Edzői értékelés (v0.9.67) — Sándor 2026.10.06: „pdf generálás előtt
// tudnak írni edzői értékelést; ha mentik, gyerekhez mentődik, szülő és
// gyerek is látja”. Évenként egy értékelés (competitor_evaluations).
// Írja az edző a Statisztika menüben; a gyerek (kincsesláda) és a szülő
// (a gyerek lapja) olvassa; az évösszefoglaló PDF-be is bekerül.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Loader, Save, Check } from 'lucide-react';

export async function loadEvaluation(supabase, competitorId, year) {
  const { data, error } = await supabase.from('competitor_evaluations')
    .select('id, year, body, updated_at').eq('competitor_id', competitorId).eq('year', year).maybeSingle();
  if (error) throw error;
  return data;
}

// Edzői szerkesztő: egy versenyző egy évének értékelése
export function EvaluationEditor({ supabase, competitorId, year, onSaved }) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoaded(false); setError(null); setSavedAt(null);
    loadEvaluation(supabase, competitorId, year)
      .then(d => { if (active) { setText(d?.body || ''); setSavedAt(d?.updated_at || null); setLoaded(true); } })
      .catch(err => { if (active) { setError(err.message); setLoaded(true); } });
    return () => { active = false; };
  }, [supabase, competitorId, year]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = text.trim();
      if (!body) {
        const { error: err } = await supabase.from('competitor_evaluations').delete()
          .eq('competitor_id', competitorId).eq('year', year);
        if (err) throw err;
        setSavedAt(null);
      } else {
        const now = new Date().toISOString();
        const { error: err } = await supabase.from('competitor_evaluations')
          .upsert({ competitor_id: competitorId, year, body, updated_at: now }, { onConflict: 'competitor_id,year' });
        if (err) throw err;
        setSavedAt(now);
      }
      if (onSaved) onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-sm text-gray-500 flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Betöltés…</div>;

  return (
    <div className="rounded-lg border-2 p-3 space-y-2" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
      <div className="font-semibold text-sm" style={{ color: '#3730A3' }}>📝 Edzői értékelés — {year}</div>
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, 4000))} rows={6}
                placeholder="Hogyan fejlődött idén, miben erős, min dolgozzon jövőre… (a szülő és a gyerek is olvassa, a PDF-be is bekerül)"
                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400" />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={save} disabled={saving}
                className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: '#4338CA' }}>
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés a gyerekhez
        </button>
        {savedAt && <span className="text-xs flex items-center gap-1" style={{ color: '#15803D' }}><Check className="w-3 h-3" /> Mentve: {new Date(savedAt).toLocaleString('hu-HU')}</span>}
        <span className="text-[10px] text-gray-400 ml-auto">{text.length}/4000 · üresen mentve törlődik</span>
      </div>
    </div>
  );
}

// Olvasó nézet (gyerek, szülő): az összes év értékelése, a legújabb felül
export function EvaluationsView({ supabase, competitorId, title = 'Edzői értékelés' }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.from('competitor_evaluations').select('year, body, updated_at')
      .eq('competitor_id', competitorId).order('year', { ascending: false })
      .then(({ data, error }) => { if (active) setItems(error ? [] : (data || [])); });
    return () => { active = false; };
  }, [supabase, competitorId]);

  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg p-3 border space-y-2" style={{ borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }}>
      <div className="font-semibold text-sm" style={{ color: '#3730A3' }}>📝 {title}</div>
      {items.map(e => (
        <div key={e.year} className="bg-white rounded border px-3 py-2" style={{ borderColor: '#E0E7FF' }}>
          <div className="text-xs font-semibold text-gray-500 mb-1">{e.year}</div>
          <div className="text-sm whitespace-pre-wrap text-gray-800">{e.body}</div>
        </div>
      ))}
    </div>
  );
}
