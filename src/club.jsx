// ═══════════════════════════════════════════════════════════════════
// Egyesület fül (v0.9.78) — Sándor 2026.10.14: a klub adatai, rövid
// bemutatkozás (magyar + angol), vezetőség és edzők szerepkörrel. Ebből
// töltődik a dokumentumok fejléce és aláírás-sora is.
// v0.9.78b: hivatalos adatok (hivatalos név, adószám, telefon) + SZJA 1%
// szöveg; bővített szerepkörök (+ „Egyéb” saját megnevezéssel); szerkeszteni
// csak Admin és Szülő-admin tud, a többiek PDF-et készítenek és másolnak.
// A listából törlés csak a listából töröl — a felhasználói fiókot nem érinti.
// Táblák: club_info, club_people (docs/sql/2026-10-14_v0.9.78*.sql).
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Edit2, Save, X, Plus, Trash2, ChevronUp, ChevronDown, Users as UsersIcon, Mail, Globe, MapPin,
         Phone, Copy, Check, FileText, Printer, Heart } from 'lucide-react';
import { CSEPEL_RG_LOGO } from './logos';

export const CLUB_TITLES = [
  { value: 'elnok', hu: 'Elnök', huPl: 'Elnök', en: 'President' },
  { value: 'alelnok', hu: 'Alelnök', huPl: 'Alelnökök', en: 'Vice President' },
  { value: 'elnoksegi_tag', hu: 'Elnökségi tag', huPl: 'Elnökségi tagok', en: 'Board Member' },
  { value: 'titkar', hu: 'Titkár', huPl: 'Titkárok', en: 'Secretary' },
  { value: 'vezetoedzo', hu: 'Vezetőedző', huPl: 'Vezetőedzők', en: 'Head Coach' },
  { value: 'edzo', hu: 'Edző', huPl: 'Edzők', en: 'Coach' },
  { value: 'segededzo', hu: 'Segédedző', huPl: 'Segédedzők', en: 'Assistant Coach' },
  { value: 'egyeb', hu: 'Egyéb', huPl: 'Egyéb', en: 'Other' }
];
// Egy személy szerepköre szövegként („Egyéb”-nél a saját megnevezés)
export const personTitle = (p, lang = 'hu') => {
  if (p.title === 'egyeb' && p.title_label) return p.title_label;
  return (CLUB_TITLES.find(t => t.value === p.title) || {})[lang] || p.title;
};

const EDITORS = ['admin', 'szulo_admin'];
const BLUE = '#1e3a8a';
const DEFAULT_NAME = 'Csepeli RG Club';

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
  return { info: info.data || { name: DEFAULT_NAME }, people: list };
}

const officialName = (info) => info.official_name || info.name || DEFAULT_NAME;

// Másolható szövegek
function officialText(info) {
  return [
    officialName(info),
    info.address && `Cím: ${info.address}`,
    info.tax_number && `Adószám: ${info.tax_number}`,
    info.phone && `Telefon: ${info.phone}`,
    info.email && `E-mail: ${info.email}`,
    info.website && `Honlap: ${info.website}`
  ].filter(Boolean).join('\n');
}
function szjaText(info) {
  return [
    'Kedves Szülők!',
    `Kérjük, hogy személyi jövedelemadója egy százalékát ajánlja fel a ${officialName(info)} számára!`,
    `A kedvezményezett adószáma: ${info.tax_number || '—'}`,
    `A kedvezményezett neve: ${officialName(info).toUpperCase()}`,
    'Segítségét hálásan köszönjük!'
  ].join('\n');
}

function CopyButton({ text, label, small }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <button onClick={copy} title="Másolás"
            className={`${small ? 'p-1' : 'px-3 py-1.5'} rounded border border-gray-300 text-xs bg-white hover:bg-gray-50 flex items-center gap-1.5`}>
      {done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
      {label && <span>{done ? 'Kimásolva' : label}</span>}
    </button>
  );
}

function InfoEditor({ supabase, info, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: info.name || DEFAULT_NAME, official_name: info.official_name || '', address: info.address || '',
    tax_number: info.tax_number || '', phone: info.phone || '', email: info.email || '',
    website: info.website || '', intro_hu: info.intro_hu || '', intro_en: info.intro_en || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setSaving(true); setError(null);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v || '').trim() || null]));
    payload.name = payload.name || DEFAULT_NAME;
    payload.updated_at = new Date().toISOString();
    const { error: err } = await supabase.from('club_info').update(payload).eq('id', 1);
    setSaving(false);
    if (err) setError('Mentés sikertelen: ' + err.message); else onSaved();
  };
  const inp = 'w-full text-sm px-2 py-1.5 border border-gray-300 rounded mt-0.5';
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold" style={{ color: BLUE }}>Hivatalos adatok</div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">Rövid név (a fejlécben)<input className={inp} value={form.name} onChange={set('name')} /></label>
        <label className="text-xs text-gray-600">Hivatalos név<input className={inp} value={form.official_name} onChange={set('official_name')} placeholder="pl. Csepeli Ritmikus Gimnasztika Club" /></label>
        <label className="text-xs text-gray-600">Cím (székhely)<input className={inp} value={form.address} onChange={set('address')} /></label>
        <label className="text-xs text-gray-600">Adószám<input className={inp} value={form.tax_number} onChange={set('tax_number')} placeholder="12345678-1-43" /></label>
        <label className="text-xs text-gray-600">Telefon<input className={inp} value={form.phone} onChange={set('phone')} /></label>
        <label className="text-xs text-gray-600">E-mail<input className={inp} value={form.email} onChange={set('email')} /></label>
        <label className="text-xs text-gray-600 sm:col-span-2">Honlap<input className={inp} value={form.website} onChange={set('website')} /></label>
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
  const [form, setForm] = useState({ name: person.name || '', title: person.title || 'edzo', title_label: person.title_label || '', note: person.note || '' });
  if (editing) {
    const ok = form.name.trim() && (form.title !== 'egyeb' || form.title_label.trim());
    return (
      <div className="flex flex-wrap gap-2 items-center bg-blue-50 rounded p-2 my-1">
        <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="text-sm px-2 py-1.5 border border-gray-300 rounded bg-white">
          {CLUB_TITLES.map(t => <option key={t.value} value={t.value}>{t.value === 'egyeb' ? 'Egyéb (saját megnevezés)' : t.hu}</option>)}
        </select>
        {form.title === 'egyeb' && (
          <input value={form.title_label} onChange={e => setForm({ ...form, title_label: e.target.value })} placeholder="Szerepkör, pl. Koreográfus" className="min-w-[150px] text-sm px-2 py-1.5 border border-gray-300 rounded" />
        )}
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Név" className="flex-1 min-w-[160px] text-sm px-2 py-1.5 border border-gray-300 rounded" />
        <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Megjegyzés (nem kötelező)" className="flex-1 min-w-[140px] text-sm px-2 py-1.5 border border-gray-300 rounded" />
        <button disabled={!ok} onClick={async () => {
                  const v = { name: form.name.trim(), title: form.title, note: form.note.trim() || null,
                              title_label: form.title === 'egyeb' ? form.title_label.trim() : null };
                  if (await onSave(v)) setEditing(false);
                }}
                className="px-3 py-1.5 rounded text-white text-sm disabled:opacity-40" style={{ backgroundColor: BLUE }}><Save className="w-4 h-4" /></button>
        <button onClick={() => (person.id ? setEditing(false) : onDelete())} className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 min-w-0">
        <span className="text-base font-semibold text-gray-900">{person.name}</span>
        {person.title === 'egyeb' && person.title_label && <span className="text-sm text-gray-600"> · {person.title_label}</span>}
        {person.note && <span className="text-sm text-gray-500"> · {person.note}</span>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="p-1 rounded hover:bg-gray-100 disabled:opacity-20" title="Feljebb"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => onMove(1)} disabled={isLast} className="p-1 rounded hover:bg-gray-100 disabled:opacity-20" title="Lejjebb"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100" title="Szerkesztés"><Edit2 className="w-4 h-4 text-gray-500" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" title="Törlés a listából (a fiókot nem érinti)"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      )}
    </div>
  );
}

// ─── Egyesületi adatlap (PDF) ───────────────────────────────────────
const PRINT_CSS = `
@media print {
  body > *:not(.club-print-root) { display: none !important; }
  .club-print-root { position: static !important; overflow: visible !important; background: white !important; }
  .club-no-print { display: none !important; }
  .club-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
  .club-block { break-inside: avoid; }
  @page { size: A4; margin: 14mm; }
}`;
const L = {
  hu: { sheet: 'Egyesületi adatlap', official: 'Hivatalos adatok', name: 'Név', address: 'Cím', tax: 'Adószám', phone: 'Telefon',
        email: 'E-mail', web: 'Honlap', about: 'Bemutatkozás', people: 'Vezetőség és edzők', szja: 'SZJA 1% felajánlás',
        szjaName: 'A kedvezményezett neve', szjaTax: 'A kedvezményezett adószáma', made: 'Készült' },
  en: { sheet: 'Club information', official: 'Official details', name: 'Name', address: 'Address', tax: 'Tax number', phone: 'Phone',
        email: 'E-mail', web: 'Website', about: 'About the club', people: 'Board and coaches', szja: '1% personal income tax donation',
        szjaName: 'Beneficiary name', szjaTax: 'Beneficiary tax number', made: 'Created' }
};

function ClubSheet({ info, people, lang }) {
  const t = L[lang];
  const intro = lang === 'en' ? info.intro_en : info.intro_hu;
  const rows = [[t.name, officialName(info)], [t.address, info.address], [t.tax, info.tax_number], [t.phone, info.phone],
                [t.email, info.email], [t.web, info.website]].filter(r => r[1]);
  return (
    <div className="text-gray-900">
      <div className="flex items-center gap-4 pb-3 border-b-2" style={{ borderColor: BLUE }}>
        <img src={CSEPEL_RG_LOGO} alt="" className="w-20 h-20 object-contain" />
        <div className="flex-1">
          <div className="text-2xl font-bold" style={{ color: BLUE }}>{officialName(info)}</div>
          <div className="text-sm text-gray-600">{[info.address, info.email, info.website].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="text-right text-sm font-semibold uppercase tracking-wide" style={{ color: BLUE }}>{t.sheet}</div>
      </div>
      <div className="club-block mt-5">
        <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: BLUE }}>{t.official}</div>
        <table className="text-sm"><tbody>
          {rows.map(([k, v]) => <tr key={k}><td className="pr-6 py-0.5 text-gray-500">{k}</td><td className="py-0.5 font-medium">{v}</td></tr>)}
        </tbody></table>
      </div>
      {intro && (
        <div className="club-block mt-5">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: BLUE }}>{t.about}</div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{intro}</div>
        </div>
      )}
      {people.length > 0 && (
        <div className="club-block mt-5">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: BLUE }}>{t.people}</div>
          <table className="text-sm"><tbody>
            {people.map(p => <tr key={p.id}><td className="pr-6 py-0.5 text-gray-500">{personTitle(p, lang)}</td><td className="py-0.5 font-semibold">{p.name}</td></tr>)}
          </tbody></table>
        </div>
      )}
      {info.tax_number && (
        <div className="club-block mt-5 rounded border-2 p-3" style={{ borderColor: '#FCA5A5' }}>
          <div className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: '#B91C1C' }}>{t.szja}</div>
          <div className="text-sm">{t.szjaName}: <b>{officialName(info).toUpperCase()}</b></div>
          <div className="text-sm">{t.szjaTax}: <b>{info.tax_number}</b></div>
        </div>
      )}
      <div className="mt-6 text-xs text-gray-400">{t.made}: {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'hu-HU')}</div>
    </div>
  );
}

function ClubPdfButton({ info, people, lang }) {
  const [open, setOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState(lang);
  useEffect(() => { setPdfLang(lang); }, [lang]);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.title;
    document.title = `${info.name || DEFAULT_NAME} ${L[pdfLang].sheet}`;
    return () => { document.title = prev; };
  }, [open, pdfLang, info.name]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded text-white text-xs font-medium flex items-center gap-1.5" style={{ backgroundColor: BLUE }}>
        <FileText className="w-3.5 h-3.5" /> Adatlap PDF
      </button>
      {open && createPortal(
        <div className="club-print-root fixed inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
          <style>{PRINT_CSS}</style>
          <div className="club-no-print sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shadow-sm" style={{ borderColor: '#E5E7EB' }}>
            <span className="font-semibold text-sm flex-1">Egyesületi adatlap</span>
            <select value={pdfLang} onChange={e => setPdfLang(e.target.value)} className="text-sm px-2 py-1 border border-gray-300 rounded bg-white">
              <option value="hu">Magyar</option><option value="en">English</option>
            </select>
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5" style={{ backgroundColor: BLUE }}>
              <Printer className="w-4 h-4" /> Nyomtatás / mentés PDF-be
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-gray-100" title="Bezárás"><X className="w-5 h-5" /></button>
          </div>
          <div className="club-sheet bg-white max-w-3xl mx-auto my-4 p-8 shadow-lg rounded">
            <ClubSheet info={info} people={people} lang={pdfLang} />
          </div>
        </div>,
        document.body
      )}
    </>
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
    if (!window.confirm(`Törlöd ${person.name} nevét az Egyesület listájából?\n(Csak erről a listáról tűnik el — a felhasználói fiókja megmarad.)`)) return;
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
  // Edzői fiókok behozása (aki még nincs a listán; az „admin” nevű technikai fiók kimarad)
  const importStaff = async () => {
    const { data, error: err } = await supabase.from('profiles').select('id, full_name, role')
      .in('role', ['vezetoedzo', 'edzo', 'segededzo']);
    if (err) { setError(err.message); return; }
    const have = new Set(club.people.map(p => p.profile_id).filter(Boolean));
    const haveNames = new Set(club.people.map(p => (p.name || '').toLowerCase().trim()));
    const rows = (data || []).filter(p => p.full_name && p.full_name.toLowerCase().trim() !== 'admin'
                                          && !have.has(p.id) && !haveNames.has(p.full_name.toLowerCase().trim()))
      .map((p, i) => ({ name: p.full_name, title: p.role, profile_id: p.id, sort_order: 100 + i * 10 }));
    if (rows.length === 0) { window.alert('Minden edzői fiók már szerepel a listán.'); return; }
    const { error: insErr } = await supabase.from('club_people').insert(rows);
    if (insErr) setError(insErr.message); else load();
  };

  if (!club) return <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>;
  const { info, people } = club;
  const intro = lang === 'en' ? info.intro_en : info.intro_hu;
  const card = 'bg-white rounded-xl border p-4';
  const officialRows = [[MapPin, 'Cím', info.address], [FileText, 'Adószám', info.tax_number], [Phone, 'Telefon', info.phone],
                        [Mail, 'E-mail', info.email], [Globe, 'Honlap', info.website]].filter(r => r[2]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Fejléc */}
      <div className="bg-white rounded-xl border p-5 flex items-center gap-4 flex-wrap" style={{ borderColor: '#E5E7EB' }}>
        <img src={CSEPEL_RG_LOGO} alt="" className="w-20 h-20 object-contain" />
        <div className="flex-1 min-w-[200px]">
          <div className="text-2xl font-bold" style={{ color: BLUE }}>{info.name || DEFAULT_NAME}</div>
          {info.official_name && info.official_name !== info.name && <div className="text-sm text-gray-600">{info.official_name}</div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <ClubPdfButton info={info} people={people} lang={lang} />
          {canEdit && !editInfo && (
            <button onClick={() => setEditInfo(true)} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white hover:bg-gray-50 flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Adatok szerkesztése</button>
          )}
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {editInfo ? (
        <div className={card} style={{ borderColor: '#E5E7EB' }}>
          <InfoEditor supabase={supabase} info={info} onCancel={() => setEditInfo(false)} onSaved={() => { setEditInfo(false); load(); }} />
        </div>
      ) : (
        <>
          {/* Hivatalos adatok */}
          <div className={card} style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-semibold" style={{ color: BLUE }}>Hivatalos adatok</div>
              {officialRows.length > 0 && <CopyButton text={officialText(info)} label="Adatok másolása" />}
            </div>
            {officialRows.length === 0
              ? <div className="text-sm text-gray-400 italic">{canEdit ? 'Még nincs kitöltve — „Adatok szerkesztése”.' : 'Hamarosan…'}</div>
              : (
                <div className="space-y-1.5">
                  <div className="text-base font-semibold text-gray-900">{officialName(info)}</div>
                  {officialRows.map(([Icon, label, value]) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500 w-20 flex-shrink-0">{label}</span>
                      <span className="font-medium text-gray-900 break-all">{value}</span>
                      <CopyButton text={value} small />
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* SZJA 1% */}
          {info.tax_number && (
            <div className="rounded-xl border-2 p-4 bg-white" style={{ borderColor: '#FCA5A5' }}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="font-semibold flex items-center gap-2" style={{ color: '#B91C1C' }}><Heart className="w-5 h-5" /> SZJA 1% felajánlás</div>
                <CopyButton text={szjaText(info)} label="Felhívás szövegének másolása" />
              </div>
              <div className="text-sm">A kedvezményezett neve: <b>{officialName(info).toUpperCase()}</b></div>
              <div className="text-sm">A kedvezményezett adószáma: <b>{info.tax_number}</b></div>
            </div>
          )}

          {/* Bemutatkozás */}
          <div className={card} style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="font-semibold" style={{ color: BLUE }}>{lang === 'en' ? 'About the club' : 'Bemutatkozás'}</div>
              <div className="flex gap-1 text-xs items-center">
                {intro && <CopyButton text={intro} small />}
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
        </>
      )}

      {/* Vezetőség és edzők */}
      <div className={card} style={{ borderColor: '#E5E7EB' }}>
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
            <div key={t.value} className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 border-b pb-0.5" style={{ borderColor: '#F3F4F6' }}>
                {group.length > 1 ? t.huPl : t.hu}
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
