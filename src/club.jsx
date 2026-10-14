// ═══════════════════════════════════════════════════════════════════
// Egyesület fül (v0.9.78) — Sándor 2026.10.14: a klub adatai, rövid
// bemutatkozás (magyar + angol), vezetőség és edzők titulussal (Elnök,
// Vezetőedző, Edző, Segédedző). Ebből töltődik a dokumentumok fejléce és
// aláírás-sora is. Látja: mindenki, aki belépett. Szerkeszti: Admin,
// Szülő-admin, Vezetőedző. Táblák: club_info, club_people
// (docs/sql/2026-10-14_v0.9.78_egyesulet.sql).
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Loader, Edit2, Save, X, Plus, Trash2, ChevronUp, ChevronDown, Users as UsersIcon, Mail, Globe, MapPin } from 'lucide-react';
import { CSEPEL_RG_LOGO } from './logos';

export const CLUB_TITLES = [
  { value: 'elnok', hu: 'Elnök', en: 'President' },
  { value: 'vezetoedzo', hu: 'Vezetőedző', en: 'Head Coach' },
  { value: 'edzo', hu: 'Edző', en: 'Coach' },
  { value: 'segededzo', hu: 'Segédedző', en: 'Assistant Coach' }
];
export const titleLabel = (value, lang = 'hu') => (CLUB_TITLES.find(t => t.value === value) || {})[lang] || value;

const EDITORS = ['admin', 'szulo_admin', 'vezetoedzo'];
const BLUE = '#1e3a8a';

// A klub adatai + emberek (a dokumentumok is ezt használják)
export async function loadClub(supabase) {
  const [info, people] = await Promise.all([
    supabase.from('club_info').select('*').eq('id', 1).maybeSingle(),
    supabase.from('club_people').select('*').order('sort_order').order('name')
  ]);
  if (info.error) throw info.error;
  if (people.error) throw people.error;
  const order = (t) => CLUB_TITLES.findIndex(x => x.value === t);
  const list = [...(people.data || [])].sort((a, b) => order(a.title) - order(b.title) || a.sort_order - b.sort_order);
  return { info: info.data || { name: 'Csepeli RG Club' }, people: list };
}

function InfoEditor({ supabase, info, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: info.name || 'Csepeli RG Club', address: info.address || '', email: info.email || '',
    website: info.website || '', intro_hu: info.intro_hu || '', intro_en: info.intro_en || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setSaving(true); setError(null);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v || '').trim() || null]));
    payload.name = payload.name || 'Csepeli RG Club';
    payload.updated_at = new Date().toISOString();
    const { error: err } = await supabase.from('club_info').update(payload).eq('id', 1);
    setSaving(false);
    if (err) setError('Mentés sikertelen: ' + err.message); else onSaved();
  };
  const inp = 'w-full text-sm px-2 py-1.5 border border-gray-300 rounded';
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">Klub neve<input className={inp} value={form.name} onChange={set('name')} /></label>
        <label className="text-xs text-gray-600">Cím<input className={inp} value={form.address} onChange={set('address')} placeholder="pl. 1211 Budapest, …" /></label>
        <label className="text-xs text-gray-600">E-mail<input className={inp} value={form.email} onChange={set('email')} /></label>
        <label className="text-xs text-gray-600">Honlap<input className={inp} value={form.website} onChange={set('website')} /></label>
      </div>
      <label className="text-xs text-gray-600 block">Rövid bemutatkozás (magyar)
        <textarea className={inp} rows={5} value={form.intro_hu} onChange={set('intro_hu')} /></label>
      <label className="text-xs text-gray-600 block">Short introduction (English — a dokumentumok angol változatához)
        <textarea className={inp} rows={5} value={form.intro_en} onChange={set('intro_en')} /></label>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: BLUE }}>
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5"><X className="w-4 h-4" /> Mégse</button>
      </div>
    </div>
  );
}

function PersonRow({ person, canEdit, isFirst, isLast, onMove, onSave, onDelete }) {
  const [editing, setEditing] = useState(!person.id);
  const [form, setForm] = useState({ name: person.name || '', title: person.title || 'edzo', note: person.note || '' });
  if (editing) {
    return (
      <div className="flex flex-wrap gap-2 items-center bg-blue-50 rounded p-2">
        <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="text-sm px-2 py-1.5 border border-gray-300 rounded bg-white">
          {CLUB_TITLES.map(t => <option key={t.value} value={t.value}>{t.hu}</option>)}
        </select>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Név" className="flex-1 min-w-[160px] text-sm px-2 py-1.5 border border-gray-300 rounded" />
        <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Megjegyzés (pl. szakedző)" className="flex-1 min-w-[140px] text-sm px-2 py-1.5 border border-gray-300 rounded" />
        <button onClick={async () => { if (form.name.trim() && await onSave({ ...form, name: form.name.trim(), note: form.note.trim() || null })) setEditing(false); }}
                className="px-3 py-1.5 rounded text-white text-sm" style={{ backgroundColor: BLUE }}><Save className="w-4 h-4" /></button>
        <button onClick={() => (person.id ? setEditing(false) : onDelete())} className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{person.name}</span>
        {person.note && <span className="text-xs text-gray-500"> · {person.note}</span>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="p-1 rounded hover:bg-gray-100 disabled:opacity-20" title="Feljebb"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => onMove(1)} disabled={isLast} className="p-1 rounded hover:bg-gray-100 disabled:opacity-20" title="Lejjebb"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100" title="Szerkesztés"><Edit2 className="w-4 h-4 text-gray-500" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" title="Törlés"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      )}
    </div>
  );
}

export function ClubView({ supabase, userRole }) {
  const canEdit = EDITORS.includes(userRole);
  const [club, setClub] = useState(null);
  const [error, setError] = useState(null);
  const [editInfo, setEditInfo] = useState(false);
  const [lang, setLang] = useState('hu');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setClub(await loadClub(supabase)); setError(null); }
    catch (err) { setError(err.message); setClub({ info: {}, people: [] }); }
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const savePerson = async (person, values) => {
    const q = person.id
      ? supabase.from('club_people').update(values).eq('id', person.id)
      : supabase.from('club_people').insert({ ...values, sort_order: (club.people.length + 1) * 10 });
    const { error: err } = await q;
    if (err) { setError('Mentés sikertelen: ' + err.message); return false; }
    setAdding(false); await load(); return true;
  };
  const deletePerson = async (person) => {
    if (!person.id) { setAdding(false); return; }
    if (!window.confirm(`Biztos törlöd: ${person.name}?`)) return;
    const { error: err } = await supabase.from('club_people').delete().eq('id', person.id);
    if (err) setError('Törlés sikertelen: ' + err.message); else load();
  };
  const move = async (group, idx, dir) => {
    const a = group[idx], b = group[idx + dir];
    if (!a || !b) return;
    const sa = a.sort_order === b.sort_order ? a.sort_order + dir : b.sort_order;
    await supabase.from('club_people').update({ sort_order: sa }).eq('id', a.id);
    await supabase.from('club_people').update({ sort_order: a.sort_order }).eq('id', b.id);
    load();
  };
  // Edzői fiókok behozása (aki még nincs a listán)
  const importStaff = async () => {
    const { data, error: err } = await supabase.from('profiles').select('id, full_name, role')
      .in('role', ['vezetoedzo', 'edzo', 'segededzo']);
    if (err) { setError(err.message); return; }
    const have = new Set(club.people.map(p => p.profile_id).filter(Boolean));
    const haveNames = new Set(club.people.map(p => (p.name || '').toLowerCase().trim()));
    const rows = (data || []).filter(p => p.full_name && !have.has(p.id) && !haveNames.has(p.full_name.toLowerCase().trim()))
      .map((p, i) => ({ name: p.full_name, title: p.role, profile_id: p.id, sort_order: 100 + i * 10 }));
    if (rows.length === 0) { window.alert('Minden edzői fiók már szerepel a listán.'); return; }
    const { error: insErr } = await supabase.from('club_people').insert(rows);
    if (insErr) setError(insErr.message); else load();
  };

  if (!club) return <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>;
  const { info, people } = club;
  const intro = lang === 'en' ? info.intro_en : info.intro_hu;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Fejléc */}
      <div className="bg-white rounded-xl border p-5 flex items-center gap-4 flex-wrap" style={{ borderColor: '#E5E7EB' }}>
        <img src={CSEPEL_RG_LOGO} alt="" className="w-20 h-20 object-contain" />
        <div className="flex-1 min-w-[200px]">
          <div className="text-2xl font-bold" style={{ color: BLUE }}>{info.name || 'Csepeli RG Club'}</div>
          <div className="text-sm text-gray-600 space-y-0.5 mt-1">
            {info.address && <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {info.address}</div>}
            {info.email && <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> <a href={`mailto:${info.email}`} className="underline">{info.email}</a></div>}
            {info.website && <div className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> <a href={info.website.startsWith('http') ? info.website : `https://${info.website}`} target="_blank" rel="noreferrer" className="underline">{info.website}</a></div>}
          </div>
        </div>
        {canEdit && !editInfo && (
          <button onClick={() => setEditInfo(true)} className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> Adatok szerkesztése</button>
        )}
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {editInfo ? (
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <InfoEditor supabase={supabase} info={info} onCancel={() => setEditInfo(false)} onSaved={() => { setEditInfo(false); load(); }} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold" style={{ color: BLUE }}>{lang === 'en' ? 'About the club' : 'Bemutatkozás'}</div>
            <div className="flex gap-1 text-xs">
              {['hu', 'en'].map(l => (
                <button key={l} onClick={() => setLang(l)} className="px-2 py-0.5 rounded border"
                        style={{ borderColor: lang === l ? BLUE : '#E5E7EB', color: lang === l ? BLUE : '#6B7280', fontWeight: lang === l ? 600 : 400 }}>
                  {l === 'hu' ? 'Magyar' : 'English'}
                </button>
              ))}
            </div>
          </div>
          {intro
            ? <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{intro}</div>
            : <div className="text-sm text-gray-400 italic">{canEdit ? 'Még nincs bemutatkozás — „Adatok szerkesztése”.' : 'Hamarosan…'}</div>}
        </div>
      )}

      {/* Vezetőség és edzők */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="font-semibold flex items-center gap-2" style={{ color: BLUE }}><UsersIcon className="w-5 h-5" /> Vezetőség és edzők</div>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={importStaff} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white hover:bg-gray-50">Edzők behozása a fiókokból</button>
              <button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded text-white text-xs flex items-center gap-1" style={{ backgroundColor: BLUE }}><Plus className="w-3 h-3" /> Új személy</button>
            </div>
          )}
        </div>
        {adding && <PersonRow person={{}} canEdit onSave={(v) => savePerson({}, v)} onDelete={() => setAdding(false)} />}
        {CLUB_TITLES.map(t => {
          const group = people.filter(p => p.title === t.value);
          if (group.length === 0) return null;
          return (
            <div key={t.value} className="mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 border-b pb-1" style={{ borderColor: '#F3F4F6' }}>
                {t.hu}{group.length > 1 && t.value !== 'elnok' ? 'ök' : ''}
              </div>
              {group.map((p, i) => (
                <PersonRow key={p.id} person={p} canEdit={canEdit} isFirst={i === 0} isLast={i === group.length - 1}
                           onMove={(dir) => move(group, i, dir)} onSave={(v) => savePerson(p, v)} onDelete={() => deletePerson(p)} />
              ))}
            </div>
          );
        })}
        {people.length === 0 && !adding && <div className="text-sm text-gray-400 italic">Még nincs felvéve senki.</div>}
      </div>
    </div>
  );
}
