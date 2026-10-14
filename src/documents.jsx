// ═══════════════════════════════════════════════════════════════════
// Dokumentumok fül (v0.9.79) — Sándor 2026.10.14: bemutatkozó lap
// (támogatónak, iskolai felvételihez, válogatotthoz) és egyesületi igazolás
// a versenyzőről, magyarul vagy angolul, egyesületi fejléccel.
//   - Készíti: a szülő (a saját gyerekének) és az edzők (bárkinek); a gyerek
//     csak megnézi és PDF-et készít.
//   - Választható: időszak, versenybesorolás, egyéni / csapat, helyezés
//     (dobogó / első 6 / 8 / 10), versenyenként kipipálható eredmények,
//     edzésszám, edzői ajánlás, „Válogatott kerettag”, 1 fotó, aláírók.
//   - Az edzői ajánlást és a válogatott jelölést CSAK edző írja (a gyerekhez
//     mentve, minden dokumentumba bekerülhet).
//   - Aláírás: edző + egyesületi elnök (az Egyesület fül listájából).
//   - A mentett dokumentum beállításai megmaradnak → bármikor újra
//     legenerálható a friss eredményekkel.
// Adatbázis: docs/sql/2026-10-14_v0.9.79_dokumentumok.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Plus, Loader, Save, Trash2, X, Printer, Image as ImageIcon, Award, ArrowLeft, Star } from 'lucide-react';
import { CSEPEL_RG_LOGO } from './logos';
import { formatCompetitorName, huSortByNickname } from './names';
import { loadBadgeData } from './badges';
import { loadClub, personTitle } from './club';
import { resizeImage } from './avatar';

const BLUE = '#1e3a8a';
const STAFF = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'];
const EXTRA_WRITERS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];
const PHOTO_BUCKET = 'document-photos';
const TRAINING_TYPES = ['edzes', 'egesznapos', 'tabor'];

const IMPORTANCES = [
  { value: 'fig', hu: 'FIG verseny', en: 'FIG competition' },
  { value: 'nemzetkozi', hu: 'Nemzetközi verseny', en: 'International competition' },
  { value: 'mrgsz_mb', hu: 'Magyar Bajnokság', en: 'Hungarian Championship' },
  { value: 'mrgsz_kupa', hu: 'Magyar Kupa', en: 'Hungarian Cup' },
  { value: 'mrgsz_reg', hu: 'Regionális verseny', en: 'Regional competition' },
  { value: 'diakolimpia', hu: 'Diákolimpia', en: 'Student Olympics' },
  { value: 'klub', hu: 'Klubverseny', en: 'Club competition' },
  { value: 'egyeb', hu: 'Egyéb verseny', en: 'Other competition' }
];
const normImp = (v) => ({ mrgsz_regional: 'mrgsz_reg', club: 'klub' }[v] || v || 'egyeb');
const impLabel = (v, lang) => (IMPORTANCES.find(i => i.value === normImp(v)) || IMPORTANCES[7])[lang];

const AUDIENCES = [
  { value: 'tamogato', hu: 'Támogatói megkeresés', en: 'Sponsorship' },
  { value: 'felveteli', hu: 'Iskolai felvételi', en: 'School admission' },
  { value: 'valogatott', hu: 'Válogatott', en: 'National team' },
  { value: 'egyeb', hu: 'Egyéb', en: 'Other' }
];
const PLACEMENT_LIMITS = [
  { value: 0, label: 'Minden helyezés' }, { value: 3, label: 'Csak dobogó (1–3.)' },
  { value: 6, label: 'Első 6' }, { value: 8, label: 'Első 8' }, { value: 10, label: 'Első 10' }
];

// Eredmény-címkék angolul (a loadBadgeData magyar címkéket ad)
const LABEL_EN = { Szabad: 'Free', Karika: 'Hoop', Labda: 'Ball', 'Buzogány': 'Clubs', Szalag: 'Ribbon', 'Kötél': 'Rope', 'Összetett': 'All-around' };
const itemLabel = (label, lang) => {
  if (lang !== 'en') return label;
  if (label.startsWith('Csapat')) return 'Group' + label.slice(6);
  return LABEL_EN[label] || label;
};
const ordinalEn = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const placeText = (p, lang) => (lang === 'en' ? ordinalEn(p) : `${p}.`);
const huDate = (d) => (d ? d.replace(/-/g, '.') + '.' : '');
const enDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtDate = (d, lang) => (lang === 'en' ? enDate(d) : huDate(d));
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const T = {
  hu: {
    bemutatkozo: 'Bemutatkozó lap', igazolas: 'Egyesületi igazolás', to: 'Címzett', born: 'Született', club: 'Egyesület',
    category: 'Kategória', age: 'Korosztály', license: 'Versenyengedély', results: 'Versenyeredmények', comps: 'verseny',
    gold: 'arany', silver: 'ezüst', bronze: 'bronz', trainings: 'edzés', period: 'Időszak', recommendation: 'Edzői ajánlás',
    valogatott: 'Magyar válogatott kerettag', coach: 'Edző', president: 'Elnök', stamp: 'P. H.',
    date: 'Kelt', noResults: 'A választott feltételekkel nincs eredmény.',
    certify: (c, club, lic) => `Alulírottak igazoljuk, hogy ${c.full_name}${c.birth_year ? ` (született: ${c.birth_year})` : ''} a(z) ${club} igazolt versenyzője${lic ? `, versenyengedélyének száma: ${lic}` : ''}.`,
    sport: (c) => `Ritmikus gimnasztikában versenyez${[c.kategoria && `, kategóriája: ${c.kategoria}`, c.korosztaly && `, korosztálya: ${c.korosztaly}`].filter(Boolean).join('')}.`,
    trainingSentence: (n, from, to) => `${from === to ? `${from}-ben` : `${from}–${to} között`} ${n} edzésen vett részt.`,
    compSentence: (n, g, s, b) => `${n} versenyen indult${g + s + b > 0 ? `, ahol ${g + s + b} érmet szerzett (${[g && `${g} arany`, s && `${s} ezüst`, b && `${b} bronz`].filter(Boolean).join(', ')})` : ''}.`,
    purpose: (p) => `Az igazolást ${p} céljából adtuk ki.`
  },
  en: {
    bemutatkozo: 'Athlete Profile', igazolas: 'Certificate of Club Membership', to: 'To', born: 'Born', club: 'Club',
    category: 'Category', age: 'Age group', license: 'Licence no.', results: 'Competition results', comps: 'competitions',
    gold: 'gold', silver: 'silver', bronze: 'bronze', trainings: 'training sessions', period: 'Period', recommendation: "Coach's recommendation",
    valogatott: 'Member of the Hungarian national team squad', coach: 'Coach', president: 'President', stamp: 'Seal',
    date: 'Date', noResults: 'No results match the selected filters.',
    certify: (c, club, lic) => `We hereby certify that ${c.full_name}${c.birth_year ? ` (born ${c.birth_year})` : ''} is a registered athlete of ${club}${lic ? `, licence number ${lic}` : ''}.`,
    sport: (c) => `She competes in rhythmic gymnastics${[c.kategoria && `, category: ${c.kategoria}`, c.korosztaly && `, age group: ${c.korosztaly}`].filter(Boolean).join('')}.`,
    trainingSentence: (n, from, to) => `${from === to ? `In ${from}` : `Between ${from} and ${to}`} she attended ${n} training sessions.`,
    compSentence: (n, g, s, b) => `She competed in ${n} competitions${g + s + b > 0 ? `, winning ${[g && `${g} gold`, s && `${s} silver`, b && `${b} bronze`].filter(Boolean).join(', ')} medal${g + s + b > 1 ? 's' : ''}` : ''}.`,
    purpose: (p) => `This certificate is issued for the purpose of ${p}.`
  }
};

export function defaultSettings(kind) {
  const y = new Date().getFullYear();
  return {
    yearFrom: y - 2, yearTo: y, importances: IMPORTANCES.map(i => i.value), egyeni: true, csapat: true,
    placementMax: 0, excluded: [], showResults: kind !== 'igazolas', showTraining: true,
    showRecommendation: true, showValogatott: true, showPhoto: true,
    coachPersonId: null, presidentPersonId: null, signCoach: true, signPresident: true,
    place: 'Budapest', docDate: todayIso(), purpose: ''
  };
}

// ─── Szűrés: a dokumentumba kerülő versenyek és eredmények ─────────────
function selectResults(comps, s) {
  const imps = new Set(s.importances || []);
  return comps
    .filter(c => {
      const y = parseInt((c.date || '').slice(0, 4), 10);
      return y >= s.yearFrom && y <= s.yearTo && imps.has(normImp(c.importance));
    })
    .map(c => ({
      ...c,
      all: c.items,
      items: c.items.filter(it => (it.group === 'csapat' ? s.csapat : s.egyeni)
        && (!s.placementMax || it.placement <= s.placementMax)
        && !(s.excluded || []).includes(`${c.key}|${it.label}`))
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Fotó ──────────────────────────────────────────────────────────────
function usePhotoUrl(supabase, path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return undefined; }
    supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600)
      .then(({ data }) => { if (active) setUrl(data?.signedUrl || null); })
      .catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [supabase, path]);
  return url;
}

// ─── A nyomtatható lap ────────────────────────────────────────────────
function DocSheet({ doc, competitor, club, extras, data, photoUrl }) {
  const lang = doc.lang;
  const t = T[lang];
  const s = doc.settings;
  const info = club.info || {};
  const clubName = info.official_name || info.name || 'Csepeli RG Club';
  const comps = selectResults(data.comps, s).filter(c => c.items.length > 0);
  const medals = [1, 2, 3].map(p => comps.reduce((n, c) => n + c.items.filter(i => i.placement === p).length, 0));
  const trainings = data.sessions.filter(x => {
    const y = parseInt(x.date.slice(0, 4), 10);
    return y >= s.yearFrom && y <= s.yearTo && TRAINING_TYPES.includes(x.type);
  }).length;
  const coach = club.people.find(p => p.id === s.coachPersonId);
  const president = club.people.find(p => p.id === s.presidentPersonId);
  const recommendation = lang === 'en' ? extras?.recommendation_en : extras?.recommendation_hu;
  const isCert = doc.kind === 'igazolas';
  const periodText = s.yearFrom === s.yearTo ? `${s.yearFrom}` : `${s.yearFrom}–${s.yearTo}`;

  const signer = (person, fallbackTitle) => (
    <div className="text-center w-56">
      <div className="border-t border-gray-500 pt-1 mt-12 text-sm font-semibold">{person ? person.name : ' '}</div>
      <div className="text-xs text-gray-600">{person ? personTitle(person, lang) : fallbackTitle}</div>
    </div>
  );

  return (
    <div className="text-gray-900 text-[13px] leading-relaxed">
      {/* Fejléc */}
      <div className="flex items-center gap-4 pb-3 border-b-2" style={{ borderColor: BLUE }}>
        <img src={CSEPEL_RG_LOGO} alt="" className="w-20 h-20 object-contain" />
        <div className="flex-1">
          <div className="text-xl font-bold" style={{ color: BLUE }}>{clubName}</div>
          <div className="text-xs text-gray-600">{[info.address, info.phone, info.email, info.website].filter(Boolean).join(' · ')}</div>
          {info.tax_number && <div className="text-xs text-gray-500">{lang === 'en' ? 'Tax number' : 'Adószám'}: {info.tax_number}</div>}
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold" style={{ color: BLUE }}>{doc.title || t[doc.kind]}</div>
          {doc.recipient && <div className="text-sm mt-1"><span className="text-gray-500">{t.to}:</span> {doc.recipient}</div>}
        </div>
      </div>

      {isCert ? (
        <div className="mt-5 space-y-3">
          <p>{t.certify(competitor, clubName, competitor.license_number)}</p>
          <p>{t.sport(competitor)}</p>
          {s.showValogatott && extras?.valogatott && (
            <p className="font-semibold">{t.valogatott}{extras.valogatott_text ? ` (${extras.valogatott_text})` : ''}.</p>
          )}
          {s.showTraining && trainings > 0 && <p>{t.trainingSentence(trainings, s.yearFrom, s.yearTo)}</p>}
          {s.showResults && comps.length > 0 && (
            <p>{t.compSentence(comps.length, medals[0], medals[1], medals[2])}</p>
          )}
          {doc.body && <p className="whitespace-pre-wrap">{doc.body}</p>}
          {s.purpose && <p>{t.purpose(s.purpose)}</p>}
        </div>
      ) : (
        <>
          {/* Versenyző */}
          <div className="mt-5 flex gap-5 items-start">
            {s.showPhoto && photoUrl && (
              <img src={photoUrl} alt="" className="w-40 h-48 object-cover rounded border" style={{ borderColor: '#E5E7EB' }} />
            )}
            <div className="flex-1">
              <div className="text-2xl font-bold">{competitor.full_name}</div>
              {s.showValogatott && extras?.valogatott && (
                <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: '#B91C1C' }}>
                  <Star className="w-3.5 h-3.5" /> {t.valogatott}{extras.valogatott_text ? ` · ${extras.valogatott_text}` : ''}
                </div>
              )}
              <table className="mt-2 text-sm"><tbody>
                {[[t.born, competitor.birth_year], [t.club, clubName], [t.category, competitor.kategoria], [t.age, competitor.korosztaly],
                  [t.license, competitor.license_number]].filter(r => r[1]).map(([k, v]) => (
                  <tr key={k}><td className="pr-5 text-gray-500">{k}</td><td className="font-medium">{v}</td></tr>
                ))}
              </tbody></table>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-gray-100">{t.period}: <b>{periodText}</b></span>
                {s.showResults && <span className="px-2 py-1 rounded bg-gray-100"><b>{comps.length}</b> {t.comps}</span>}
                {s.showResults && medals[0] > 0 && <span className="px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7' }}>🥇 <b>{medals[0]}</b> {t.gold}</span>}
                {s.showResults && medals[1] > 0 && <span className="px-2 py-1 rounded" style={{ backgroundColor: '#F3F4F6' }}>🥈 <b>{medals[1]}</b> {t.silver}</span>}
                {s.showResults && medals[2] > 0 && <span className="px-2 py-1 rounded" style={{ backgroundColor: '#FFEDD5' }}>🥉 <b>{medals[2]}</b> {t.bronze}</span>}
                {s.showTraining && trainings > 0 && <span className="px-2 py-1 rounded bg-gray-100"><b>{trainings}</b> {t.trainings}</span>}
              </div>
            </div>
          </div>

          {doc.body && <div className="mt-5 whitespace-pre-wrap">{doc.body}</div>}
        </>
      )}

      {s.showResults && (!isCert || comps.length > 0) && (
        <div className="doc-block mt-5">
          <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: BLUE }}>{t.results}</div>
          {comps.length === 0 ? <div className="text-sm text-gray-500 italic">{t.noResults}</div> : (
            <table className="w-full text-[12px] border-collapse">
              <tbody>
                {comps.map(c => (
                  <tr key={c.key} className="border-b align-top" style={{ borderColor: '#E5E7EB' }}>
                    <td className="py-1 pr-3 whitespace-nowrap text-gray-600">{fmtDate(c.date, lang)}</td>
                    <td className="py-1 pr-3">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[11px] text-gray-500">{impLabel(c.importance, lang)}</div>
                    </td>
                    <td className="py-1">
                      {c.items.map((it, i) => (
                        <span key={i} className="inline-block mr-2 whitespace-nowrap">
                          {itemLabel(it.label, lang)}: <b style={{ color: it.placement <= 3 ? '#B45309' : undefined }}>{placeText(it.placement, lang)}</b>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {s.showRecommendation && recommendation && (
        <div className="doc-block mt-5 rounded border-l-4 pl-3 py-1" style={{ borderColor: BLUE }}>
          <div className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: BLUE }}>{t.recommendation}</div>
          <div className="whitespace-pre-wrap italic">{recommendation}</div>
          {coach && <div className="text-xs text-gray-600 mt-1">— {coach.name}, {personTitle(coach, lang)}</div>}
        </div>
      )}

      {/* Kelt + aláírások */}
      <div className="doc-block mt-8">
        <div className="text-sm">{s.place ? `${s.place}, ` : ''}{fmtDate(s.docDate || todayIso(), lang)}</div>
        <div className="flex justify-around items-end mt-2 flex-wrap gap-4">
          {s.signCoach && signer(coach, t.coach)}
          {isCert && <div className="text-xs text-gray-400 mb-6">{t.stamp}</div>}
          {s.signPresident && signer(president, t.president)}
        </div>
      </div>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  body > *:not(.doc-print-root) { display: none !important; }
  .doc-print-root { position: static !important; overflow: visible !important; background: white !important; }
  .doc-no-print { display: none !important; }
  .doc-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
  .doc-block { break-inside: avoid; }
  @page { size: A4; margin: 14mm; }
}`;

function PrintOverlay({ title, onClose, children }) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
  return createPortal(
    <div className="doc-print-root fixed inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
      <style>{PRINT_CSS}</style>
      <div className="doc-no-print sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
        <span className="font-semibold text-sm flex-1 truncate">{title}</span>
        <button onClick={() => window.print()} className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5" style={{ backgroundColor: BLUE }}>
          <Printer className="w-4 h-4" /> Nyomtatás / mentés PDF-be
        </button>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" title="Bezárás"><X className="w-5 h-5" /></button>
      </div>
      <div className="doc-sheet bg-white max-w-3xl mx-auto my-4 p-10 shadow-lg rounded">{children}</div>
    </div>,
    document.body
  );
}

// ─── Edzői ajánlás + válogatott (csak edző írja) ──────────────────────
function ExtrasEditor({ supabase, competitorId, extras, onSaved }) {
  const [form, setForm] = useState({
    recommendation_hu: extras?.recommendation_hu || '', recommendation_en: extras?.recommendation_en || '',
    valogatott: !!extras?.valogatott, valogatott_text: extras?.valogatott_text || ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {
      competitor_id: competitorId, valogatott: form.valogatott, updated_at: new Date().toISOString(),
      recommendation_hu: form.recommendation_hu.trim() || null, recommendation_en: form.recommendation_en.trim() || null,
      valogatott_text: form.valogatott_text.trim() || null
    };
    const { error } = await supabase.from('competitor_doc_extras').upsert(payload, { onConflict: 'competitor_id' });
    setSaving(false);
    if (error) setMsg('Mentés sikertelen: ' + error.message); else { setMsg('Elmentve.'); onSaved(); }
  };
  const inp = 'w-full text-sm px-2 py-1.5 border border-gray-300 rounded mt-0.5';
  return (
    <div className="bg-white rounded-xl border p-4 space-y-2" style={{ borderColor: '#E5E7EB' }}>
      <div className="font-semibold flex items-center gap-2" style={{ color: BLUE }}><Award className="w-5 h-5" /> Edzői ajánlás és válogatott jelölés</div>
      <div className="text-xs text-gray-500">Csak edző írhatja. A gyerekhez mentődik, és minden dokumentumba bekerülhet (a szülő ki-be kapcsolhatja, de nem írhatja át).</div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.valogatott} onChange={e => setForm({ ...form, valogatott: e.target.checked })} />
        <span className="font-medium">Magyar válogatott kerettag</span>
      </label>
      {form.valogatott && (
        <input className={inp} value={form.valogatott_text} onChange={e => setForm({ ...form, valogatott_text: e.target.value })}
               placeholder="Kiegészítés (nem kötelező), pl. „junior csapat, 2026”" />
      )}
      <label className="text-xs text-gray-600 block">Edzői ajánlás (magyar)
        <textarea className={inp} rows={4} value={form.recommendation_hu} onChange={e => setForm({ ...form, recommendation_hu: e.target.value })} /></label>
      <label className="text-xs text-gray-600 block">Coach's recommendation (English)
        <textarea className={inp} rows={4} value={form.recommendation_en} onChange={e => setForm({ ...form, recommendation_en: e.target.value })} /></label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: BLUE }}>
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
        </button>
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}

// ─── Szerkesztő ─────────────────────────────────────────────────────
function DocEditor({ supabase, competitor, club, extras, data, initial, canEdit, onBack, onSaved }) {
  const [doc, setDoc] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoUrl = usePhotoUrl(supabase, doc.photo_path);
  const s = doc.settings;
  const setS = (patch) => setDoc(d => ({ ...d, settings: { ...d.settings, ...patch } }));
  const set = (k) => (e) => setDoc({ ...doc, [k]: e.target.value });

  const coaches = club.people.filter(p => ['vezetoedzo', 'edzo', 'segededzo'].includes(p.title));
  const presidents = club.people.filter(p => p.title === 'elnok');
  const candidates = useMemo(() => {
    const imps = new Set(s.importances);
    return data.comps.filter(c => {
      const y = parseInt((c.date || '').slice(0, 4), 10);
      return y >= s.yearFrom && y <= s.yearTo && imps.has(normImp(c.importance));
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [data.comps, s.yearFrom, s.yearTo, s.importances]);
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const first = Math.min(now, ...data.comps.map(c => parseInt((c.date || '').slice(0, 4), 10)).filter(Boolean), now - 5);
    const out = []; for (let y = now; y >= first; y--) out.push(y); return out;
  }, [data.comps]);

  const toggleExcluded = (key) => setS({ excluded: s.excluded.includes(key) ? s.excluded.filter(k => k !== key) : [...s.excluded, key] });
  const itemShown = (it) => (it.group === 'csapat' ? s.csapat : s.egyeni) && (!s.placementMax || it.placement <= s.placementMax);

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Képfájlt válassz (JPG, PNG)!');
      const blob = await resizeImage(file, 1200);
      const path = `${competitor.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      if (doc.photo_path && doc.photo_path !== initial.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([doc.photo_path]);
      setDoc(d => ({ ...d, photo_path: path }));
    } catch (err) { setError('Feltöltés sikertelen: ' + err.message); }
    setUploading(false);
  };
  const removePhoto = async () => {
    if (doc.photo_path && doc.photo_path !== initial.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([doc.photo_path]);
    setDoc(d => ({ ...d, photo_path: null }));
  };

  const save = async () => {
    if (!doc.title.trim()) { setError('Adj címet a dokumentumnak!'); return; }
    setSaving(true); setError(null);
    const payload = {
      competitor_id: competitor.id, kind: doc.kind, lang: doc.lang, title: doc.title.trim(), audience: doc.audience,
      recipient: (doc.recipient || '').trim() || null, body: (doc.body || '').trim() || null,
      settings: doc.settings, photo_path: doc.photo_path || null, updated_at: new Date().toISOString()
    };
    const res = doc.id
      ? await supabase.from('competitor_documents').update(payload).eq('id', doc.id).select().single()
      : await supabase.from('competitor_documents').insert(payload).select().single();
    setSaving(false);
    if (res.error) { setError('Mentés sikertelen: ' + res.error.message); return; }
    // a régi (lecserélt) fotó törlése
    if (initial.photo_path && initial.photo_path !== doc.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([initial.photo_path]);
    onSaved(res.data);
  };

  const inp = 'w-full text-sm px-2 py-1.5 border border-gray-300 rounded mt-0.5';
  const box = 'bg-white rounded-xl border p-4 space-y-2';
  const sheet = <DocSheet doc={doc} competitor={competitor} club={club} extras={extras} data={data} photoUrl={photoUrl} />;
  const pdfTitle = `${competitor.full_name} ${doc.title || T[doc.lang][doc.kind]}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Vissza</button>
        <div className="flex-1" />
        {canEdit && (
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded border text-sm font-medium flex items-center gap-1.5 bg-white disabled:opacity-50" style={{ borderColor: BLUE, color: BLUE }}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Mentés
          </button>
        )}
        <button onClick={() => setPrinting(true)} className="px-4 py-1.5 rounded text-white text-sm font-semibold flex items-center gap-1.5" style={{ backgroundColor: '#BE185D' }}>
          <FileText className="w-4 h-4" /> PDF készítése
        </button>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      <div className={canEdit ? 'grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-3 items-start' : ''}>
        {canEdit && (
          <div className="space-y-3">
            <div className={box} style={{ borderColor: '#E5E7EB' }}>
              <div className="font-semibold text-sm" style={{ color: BLUE }}>Alapok</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Típus
                  <select className={inp} value={doc.kind} onChange={e => setDoc({ ...doc, kind: e.target.value })}>
                    <option value="bemutatkozo">Bemutatkozó lap</option><option value="igazolas">Egyesületi igazolás</option>
                  </select></label>
                <label className="text-xs text-gray-600">Nyelv
                  <select className={inp} value={doc.lang} onChange={e => setDoc({ ...doc, lang: e.target.value })}>
                    <option value="hu">Magyar</option><option value="en">English</option>
                  </select></label>
              </div>
              <label className="text-xs text-gray-600 block">Kinek szól
                <select className={inp} value={doc.audience} onChange={e => setDoc({ ...doc, audience: e.target.value })}>
                  {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.hu}</option>)}
                </select></label>
              <label className="text-xs text-gray-600 block">Cím (a lap tetején)<input className={inp} value={doc.title} onChange={set('title')} /></label>
              <label className="text-xs text-gray-600 block">Címzett (nem kötelező)<input className={inp} value={doc.recipient || ''} onChange={set('recipient')} placeholder="pl. XY Gimnázium felvételi bizottsága" /></label>
              {doc.kind === 'igazolas' && (
                <label className="text-xs text-gray-600 block">Milyen célból (nem kötelező)<input className={inp} value={s.purpose} onChange={e => setS({ purpose: e.target.value })} placeholder={doc.lang === 'en' ? 'e.g. school admission' : 'pl. iskolai felvételi'} /></label>
              )}
              <label className="text-xs text-gray-600 block">{doc.kind === 'igazolas' ? 'További szöveg (nem kötelező)' : 'Bemutatkozó levél (a szülő / az edző szövege)'}
                <textarea className={inp} rows={doc.kind === 'igazolas' ? 3 : 8} value={doc.body || ''} onChange={set('body')}
                          placeholder={doc.lang === 'en' ? 'Write in English for the English version.' : ''} /></label>
            </div>

            <div className={box} style={{ borderColor: '#E5E7EB' }}>
              <div className="font-semibold text-sm" style={{ color: BLUE }}>Eredmények</div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.showResults} onChange={e => setS({ showResults: e.target.checked })} /> Eredmények a lapon</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Ettől az évtől
                  <select className={inp} value={s.yearFrom} onChange={e => setS({ yearFrom: Math.min(parseInt(e.target.value, 10), s.yearTo) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
                <label className="text-xs text-gray-600">Eddig az évig
                  <select className={inp} value={s.yearTo} onChange={e => setS({ yearTo: Math.max(parseInt(e.target.value, 10), s.yearFrom) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
              </div>
              <div className="text-xs text-gray-600">Versenyek</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {IMPORTANCES.map(i => (
                  <label key={i.value} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={s.importances.includes(i.value)}
                           onChange={e => setS({ importances: e.target.checked ? [...s.importances, i.value] : s.importances.filter(v => v !== i.value) })} />
                    {i.hu}
                  </label>
                ))}
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.egyeni} onChange={e => setS({ egyeni: e.target.checked })} /> Egyéni</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.csapat} onChange={e => setS({ csapat: e.target.checked })} /> Csapat</label>
              </div>
              <label className="text-xs text-gray-600 block">Helyezés
                <select className={inp} value={s.placementMax} onChange={e => setS({ placementMax: parseInt(e.target.value, 10) })}>
                  {PLACEMENT_LIMITS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select></label>
              <div className="text-xs text-gray-600">Egyenként (pipa = a lapra kerül)</div>
              <div className="max-h-72 overflow-y-auto border rounded p-2 space-y-1.5" style={{ borderColor: '#E5E7EB' }}>
                {candidates.length === 0 && <div className="text-xs text-gray-400 italic">Nincs eredmény ebben az időszakban.</div>}
                {candidates.map(c => (
                  <div key={c.key}>
                    <div className="text-xs font-semibold">{huDate(c.date)} {c.name}</div>
                    <div className="flex flex-wrap gap-x-3">
                      {c.items.map(it => {
                        const k = `${c.key}|${it.label}`;
                        const hidden = !itemShown(it);
                        return (
                          <label key={k} className={`flex items-center gap-1 text-xs ${hidden ? 'text-gray-300' : ''}`}>
                            <input type="checkbox" disabled={hidden} checked={!hidden && !s.excluded.includes(k)} onChange={() => toggleExcluded(k)} />
                            {it.label} {it.placement}.
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={box} style={{ borderColor: '#E5E7EB' }}>
              <div className="font-semibold text-sm" style={{ color: BLUE }}>Kiegészítők</div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.showTraining} onChange={e => setS({ showTraining: e.target.checked })} /> Edzésszám az időszakban</label>
              <label className={`flex items-center gap-2 text-sm ${extras?.recommendation_hu || extras?.recommendation_en ? '' : 'text-gray-400'}`}>
                <input type="checkbox" checked={s.showRecommendation} onChange={e => setS({ showRecommendation: e.target.checked })} />
                Edzői ajánlás {!(extras?.recommendation_hu || extras?.recommendation_en) && '(még nincs megírva)'}
              </label>
              <label className={`flex items-center gap-2 text-sm ${extras?.valogatott ? '' : 'text-gray-400'}`}>
                <input type="checkbox" checked={s.showValogatott} onChange={e => setS({ showValogatott: e.target.checked })} />
                Válogatott kerettag {!extras?.valogatott && '(az edző nem jelölte)'}
              </label>
              {doc.kind === 'bemutatkozo' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.showPhoto} onChange={e => setS({ showPhoto: e.target.checked })} /> Fotó</label>
                  <label className="px-2 py-1 rounded border border-gray-300 text-xs bg-white hover:bg-gray-50 cursor-pointer flex items-center gap-1">
                    {uploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} {doc.photo_path ? 'Csere' : 'Feltöltés'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {doc.photo_path && <button onClick={removePhoto} className="text-xs text-red-600 underline">Eltávolítás</button>}
                </div>
              )}
            </div>

            <div className={box} style={{ borderColor: '#E5E7EB' }}>
              <div className="font-semibold text-sm" style={{ color: BLUE }}>Aláírás</div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={s.signCoach} onChange={e => setS({ signCoach: e.target.checked })} />
                <select className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded" value={s.coachPersonId || ''} onChange={e => setS({ coachPersonId: e.target.value || null })}>
                  <option value="">— edző —</option>
                  {coaches.map(p => <option key={p.id} value={p.id}>{p.name} ({personTitle(p)})</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={s.signPresident} onChange={e => setS({ signPresident: e.target.checked })} />
                <select className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded" value={s.presidentPersonId || ''} onChange={e => setS({ presidentPersonId: e.target.value || null })}>
                  <option value="">— elnök —</option>
                  {presidents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {presidents.length === 0 && <div className="text-xs text-amber-700">Az Egyesület fülön még nincs elnök felvéve — az aláírás-sor név nélkül jelenik meg.</div>}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Hely<input className={inp} value={s.place} onChange={e => setS({ place: e.target.value })} /></label>
                <label className="text-xs text-gray-600">Dátum<input type="date" className={inp} value={s.docDate} onChange={e => setS({ docDate: e.target.value })} /></label>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm p-6 overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-xs text-gray-400 mb-3">Előnézet</div>
          {sheet}
        </div>
      </div>

      {printing && <PrintOverlay title={pdfTitle} onClose={() => setPrinting(false)}>{sheet}</PrintOverlay>}
    </div>
  );
}

// ─── Fő nézet ───────────────────────────────────────────────────────
export function DocumentsView({ supabase, profile }) {
  const role = profile?.role;
  const isStaff = STAFF.includes(role);
  const isKid = role === 'versenyzo';
  const [competitors, setCompetitors] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [ctx, setCtx] = useState(null);          // { competitor, club, extras, data, docs }
  const [editing, setEditing] = useState(null);  // a szerkesztett / megnyitott dokumentum
  const [error, setError] = useState(null);

  // Kik közül választhat: edző → mindenki; szülő → a saját gyerekei; gyerek → saját maga
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let q = supabase.from('competitors').select('id, full_name, nickname, korosztaly, kategoria');
        if (isStaff) {
          q = q.eq('is_active', true).eq('is_club_member', true);
        } else if (isKid) {
          q = q.eq('id', profile.competitor_id || '00000000-0000-0000-0000-000000000000');
        } else {
          const { data: links } = await supabase.from('parent_child_links').select('competitor_id').eq('parent_user_id', profile.id);
          const ids = (links || []).map(l => l.competitor_id);
          q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        }
        const { data, error: err } = await q;
        if (err) throw err;
        const list = [...(data || [])].sort(huSortByNickname);
        if (!active) return;
        setCompetitors(list);
        if (list.length === 1) setSelectedId(list[0].id);
      } catch (err) { if (active) { setError(err.message); setCompetitors([]); } }
    })();
    return () => { active = false; };
  }, [supabase, isStaff, isKid, profile?.id, profile?.competitor_id]);

  const loadCtx = useCallback(async (id) => {
    if (!id) { setCtx(null); return; }
    setCtx(null); setError(null);
    try {
      const [comp, club, extras, docs, data] = await Promise.all([
        supabase.from('competitors').select('*').eq('id', id).maybeSingle(),
        loadClub(supabase),
        supabase.from('competitor_doc_extras').select('*').eq('competitor_id', id).maybeSingle(),
        supabase.from('competitor_documents').select('*').eq('competitor_id', id).order('updated_at', { ascending: false }),
        loadBadgeData(supabase, id)
      ]);
      for (const r of [comp, extras, docs]) if (r.error) throw r.error;
      setCtx({ competitor: comp.data, club, extras: extras.data, docs: docs.data || [], data });
    } catch (err) { setError(err.message); }
  }, [supabase]);
  useEffect(() => { setEditing(null); loadCtx(selectedId); }, [selectedId, loadCtx]);

  const newDoc = (kind) => {
    const settings = defaultSettings(kind);
    const coach = ctx.club.people.find(p => p.title === 'vezetoedzo') || ctx.club.people.find(p => p.title === 'edzo');
    const president = ctx.club.people.find(p => p.title === 'elnok');
    settings.coachPersonId = coach?.id || null;
    settings.presidentPersonId = president?.id || null;
    setEditing({ kind, lang: 'hu', audience: 'egyeb', title: T.hu[kind], recipient: '', body: '', settings, photo_path: null });
  };
  const openDoc = (d) => setEditing({ ...d, settings: { ...defaultSettings(d.kind), ...(d.settings || {}) } });
  const deleteDoc = async (d) => {
    if (!window.confirm(`Biztos törlöd: „${d.title}”?`)) return;
    const { error: err } = await supabase.from('competitor_documents').delete().eq('id', d.id);
    if (err) { setError('Törlés sikertelen: ' + err.message); return; }
    if (d.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([d.photo_path]);
    loadCtx(selectedId);
  };

  if (competitors === null) return <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>;
  const canEdit = !isKid;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: BLUE }}><FileText className="w-6 h-6" /> Dokumentumok</h2>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {!editing && competitors.length > 1 && (
        <div className="bg-white rounded-lg border p-3" style={{ borderColor: '#E5E7EB' }}>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="text-sm px-2 py-1.5 border border-gray-300 rounded bg-white min-w-[260px]">
            <option value="">— válassz versenyzőt ({competitors.length}) —</option>
            {competitors.map(c => <option key={c.id} value={c.id}>{formatCompetitorName(c)}{c.korosztaly ? ` · ${c.korosztaly}` : ''}</option>)}
          </select>
        </div>
      )}
      {competitors.length === 0 && <div className="text-sm text-gray-500 italic">Nincs versenyző, akihez dokumentumot készíthetnél.</div>}
      {selectedId && !ctx && !error && <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {ctx && editing && (
        <DocEditor key={editing.id || 'new'} supabase={supabase} competitor={ctx.competitor} club={ctx.club} extras={ctx.extras} data={ctx.data}
                   initial={editing} canEdit={canEdit} onBack={() => setEditing(null)}
                   onSaved={(saved) => { setEditing(null); loadCtx(selectedId); return saved; }} />
      )}

      {ctx && !editing && (
        <div className="space-y-3">
          <div className="text-lg font-bold" style={{ color: BLUE }}>{formatCompetitorName(ctx.competitor)}</div>
          {canEdit && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => newDoc('bemutatkozo')} className="px-4 py-2 rounded text-white text-sm font-semibold flex items-center gap-1.5" style={{ backgroundColor: BLUE }}><Plus className="w-4 h-4" /> Új bemutatkozó lap</button>
              <button onClick={() => newDoc('igazolas')} className="px-4 py-2 rounded border text-sm font-semibold flex items-center gap-1.5 bg-white" style={{ borderColor: BLUE, color: BLUE }}><Plus className="w-4 h-4" /> Új egyesületi igazolás</button>
            </div>
          )}

          <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="font-semibold mb-2" style={{ color: BLUE }}>Mentett dokumentumok</div>
            {ctx.docs.length === 0 ? <div className="text-sm text-gray-400 italic">Még nincs mentett dokumentum.</div> : (
              <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {ctx.docs.map(d => (
                  <div key={d.id} className="py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{d.title}</div>
                      <div className="text-xs text-gray-500">
                        {d.kind === 'igazolas' ? 'Egyesületi igazolás' : 'Bemutatkozó lap'} · {d.lang === 'en' ? 'angol' : 'magyar'} · {(AUDIENCES.find(a => a.value === d.audience) || {}).hu} · {huDate((d.updated_at || '').slice(0, 10))}
                      </div>
                    </div>
                    <button onClick={() => openDoc(d)} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white hover:bg-gray-50">{canEdit ? 'Megnyitás / újragenerálás' : 'Megnézem'}</button>
                    {canEdit && <button onClick={() => deleteDoc(d)} className="p-1.5 rounded hover:bg-red-50" title="Törlés"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {EXTRA_WRITERS.includes(role) && (
            <ExtrasEditor key={ctx.competitor.id} supabase={supabase} competitorId={ctx.competitor.id} extras={ctx.extras} onSaved={() => loadCtx(selectedId)} />
          )}
        </div>
      )}
    </div>
  );
}
