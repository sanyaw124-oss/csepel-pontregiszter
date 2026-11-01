// ═══════════════════════════════════════════════════════════════════
// Korábbi eredmények Excelben (v1.10.0) — Sándor 2026.11.01:
//   „nehézkesen megy a versenyzők eredményeinek a feltöltése … a szülő vagy
//   gyerek kitölti, elküldi nekem, … betöltésnél ne lehessen duplikálni”.
//   - Letöltés: a gyerek, a szülő és az edző egy sablont tölt le a gyerek
//     nevével (lenyíló listákkal), kitöltés után e-mailben elküldik.
//   - Betöltés (edző / admin): előnézet soronként — zöld = új, sárga = már
//     bent van (azonos nap + hasonló versenynév, ill. a programban pontozott
//     verseny), piros = hibás; csak a zöldek mennek be, a csapateredmény a
//     csapattársaknál is megjelenik (sync_historical_team), mint a kézi felvételnél.
// A historical_results tábla: versenyenként egy sor, a szerek a results-ban.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Download, Upload, Loader, X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const SEND_TO = 'sanyaw124@gmail.com';
const PURPLE = '#7c3aed';

const BESOROLAS = [
  ['fig', 'FIG nemzetközi'], ['nemzetkozi', 'Nemzetközi'], ['mrgsz_mb', 'MRGSZ Magyar Bajnokság'],
  ['mrgsz_kupa', 'MRGSZ Magyar Kupa'], ['mrgsz_regional', 'MRGSZ Regionális verseny'], ['diakolimpia', 'Diákolimpia'],
  ['club', 'Klubverseny / Kisverseny'], ['egyeb', 'Egyéb']
];
const TIPUS = [['egyeni', 'Egyéni'], ['egyuttes', 'Együttes (kéziszer)'], ['klubcsapat', 'Klub-csapat']];
const SZER = [['szabad', 'Szabad'], ['karika', 'Karika'], ['labda', 'Labda'], ['buzogany', 'Buzogány'], ['szalag', 'Szalag'],
  ['kotel', 'Kötél'], ['osszetett', 'Összetett'], ['csapat', 'Csapat']];
const KATEGORIA = ['BNK', 'SZK', 'VSK I', 'VSK II'];
const KOROSZTALY = ['gyermek', 'serdülő', 'junior', 'felnőtt', 'master'];
const COLS = ['Dátum *', 'Verseny neve *', 'Besorolás *', 'Versenyszám *', 'Kategória', 'Korosztály',
  'Szer / eredmény *', 'Pontszám', 'Helyezés *', 'Csapat neve', 'Csapattársak (vesszővel)', 'Megjegyzés'];
const DATA_ROWS = 60;

// az ExcelJS csak akkor töltődik be, amikor valaki letölt / betölt (a program így nem lassul)
async function loadExcelJS() {
  const mod = await import('exceljs/dist/exceljs.min.js');
  return mod.default || mod;
}
const fold = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const byLabel = (list, label) => (list.find(([, l]) => fold(l) === fold(label)) || [])[0] || null;
const normCompName = (s) => fold(s).replace(/\b(19|20)\d\d\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const similarCompName = (a, b) => {
  const x = normCompName(a), y = normCompName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x) || editDistance(x, y) <= 3;
};
const fileSafe = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ─── Sablon letöltése ───────────────────────────────────────────────
export async function downloadResultsTemplate(competitor) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pontregiszter · Csepeli RG Club';
  const name = competitor.full_name;

  const guide = wb.addWorksheet('Útmutató');
  guide.getColumn(1).width = 110;
  const lines = [
    ['Korábbi versenyeredmények — kitöltő', { bold: true, size: 16, color: { argb: 'FF7C3AED' } }],
    [`Versenyző: ${name}`, { bold: true, size: 13 }],
    [''],
    [`Kitöltés után küldd el e-mailben ide: ${SEND_TO}`, { bold: true, size: 12, color: { argb: 'FFBE185D' } }],
    [''],
    ['Hogyan töltsd ki?', { bold: true }],
    ['• Az „Eredmények” lapon egy sor = egy eredmény (egy szer, az összetett vagy a csapat egy versenyen).'],
    ['• Ha egy versenyen több szeren indultál, minden szer külön sorba kerül (a dátum és a verseny neve ugyanaz).'],
    ['• Dátum: a verseny napja, pl. 2025.05.10. — Helyezés: szám (pl. 3). A pontszám nem kötelező.'],
    ['• Besorolás, Versenyszám, Kategória, Korosztály, Szer: válassz a lenyíló listából (a cellára kattintva megjelenik).'],
    ['• Versenyszám: „Egyéni” — egyéni szerek és összetett; „Együttes (kéziszer)” — csapatgyakorlat; „Klub-csapat” — klubok közti csapatverseny.'],
    ['• Csapateredménynél (Szer = „Csapat”) a csapattársakat is írd be vesszővel elválasztva — ez kötelező.'],
    ['• Ami már szerepel a programban (pl. amit ott pontoztunk), azt nem kell újra beírni — a program úgyis kiszűri.'],
    [''],
    ['Köszönjük! — Csepeli RG Club', { italic: true }]
  ];
  lines.forEach(([t, font], i) => {
    const c = guide.getCell(i + 1, 1);
    c.value = t;
    if (font) c.font = font;
  });

  const lists = wb.addWorksheet('Listák', { state: 'veryHidden' });
  const putList = (col, values) => values.forEach((v, i) => { lists.getCell(i + 1, col).value = v; });
  putList(1, BESOROLAS.map(x => x[1]));
  putList(2, TIPUS.map(x => x[1]));
  putList(3, KATEGORIA);
  putList(4, KOROSZTALY);
  putList(5, SZER.map(x => x[1]));
  lists.getCell(1, 10).value = 'pontregiszter-korabbi-eredmenyek-v1';
  lists.getCell(2, 10).value = competitor.id;
  lists.getCell(3, 10).value = name;

  const ws = wb.addWorksheet('Eredmények', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.mergeCells(1, 1, 1, COLS.length);
  const title = ws.getCell(1, 1);
  title.value = `${name} — korábbi eredmények · küldd el: ${SEND_TO}`;
  title.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;
  COLS.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF7C3AED' } } };
  });
  [13, 34, 24, 20, 11, 12, 16, 10, 10, 18, 36, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const listRef = (col, n) => `'Listák'!$${col}$1:$${col}$${n}`;
  for (let r = 3; r < 3 + DATA_ROWS; r++) {
    ws.getCell(r, 1).numFmt = 'yyyy.mm.dd';
    ws.getCell(r, 1).dataValidation = { type: 'date', operator: 'between', allowBlank: true, formulae: [new Date(2000, 0, 1), new Date(2100, 0, 1)],
      showErrorMessage: true, errorTitle: 'Dátum', error: 'Dátumot írj, pl. 2025.05.10.' };
    const dv = (col, ref) => { ws.getCell(r, col).dataValidation = { type: 'list', allowBlank: true, formulae: [ref], showErrorMessage: true, errorTitle: 'Válassz a listából', error: 'Kérlek, a lenyíló listából válassz.' }; };
    dv(3, listRef('A', BESOROLAS.length));
    dv(4, listRef('B', TIPUS.length));
    dv(5, listRef('C', KATEGORIA.length));
    dv(6, listRef('D', KOROSZTALY.length));
    dv(7, listRef('E', SZER.length));
    ws.getCell(r, 9).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 500],
      showErrorMessage: true, errorTitle: 'Helyezés', error: 'A helyezés egész szám (pl. 3).' };
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Korabbi_eredmenyek_${fileSafe(name)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function ResultsTemplateButton({ competitor, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!competitor?.id) return null;
  return (
    <span className="inline-flex flex-col">
      <button onClick={async () => { setBusy(true); setErr(null); try { await downloadResultsTemplate(competitor); } catch (e) { setErr(e.message); } setBusy(false); }}
              disabled={busy}
              className={`${compact ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2'} rounded-lg text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50`}
              style={{ backgroundColor: PURPLE }}>
        {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Korábbi eredmények Excel letöltése
      </button>
      {err && <span className="text-xs text-red-600 mt-1">{err}</span>}
    </span>
  );
}

// ─── Betöltés (edző / admin) ─────────────────────────────────────────
const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(x => x.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return v.result;
  }
  return v;
};
function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 30000 && v < 80000) { // Excel sorszám-dátum
    const d = new Date(Math.round((v - 25569) * 86400000));
    return parseDate(d);
  }
  const m = String(v || '').trim().match(/^(\d{4})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})\.?$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}
const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

export function ResultsExcelImport({ supabase, competitorId, onClose, onImported }) {
  const [state, setState] = useState(null); // { owner, groups[] }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const readFile = async (file) => {
    setError(null); setState(null); setDone(null); setBusy(true);
    try {
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const lists = wb.getWorksheet('Listák');
      const ws = wb.getWorksheet('Eredmények');
      if (!ws) throw new Error('Ez nem a Pontregiszter kitöltő Excele (nincs „Eredmények” lap).');
      const ownerId = lists ? String(cellText(lists.getCell(2, 10).value) || '') : '';
      const ownerName = lists ? String(cellText(lists.getCell(3, 10).value) || '') : '';
      const targetId = ownerId || competitorId;

      const [{ data: owner }, { data: club }, { data: existing }] = await Promise.all([
        supabase.from('competitors').select('id, full_name, nickname').eq('id', targetId).maybeSingle(),
        supabase.from('competitors').select('id, full_name, nickname').eq('is_club_member', true),
        supabase.from('historical_results').select('id, competition_name, competition_date, results').eq('competitor_id', targetId)
      ]);
      if (!owner) throw new Error('A fájlban szereplő versenyző nincs a programban.');

      // a programban pontozott versenyei (ezeket nem kell korábbi eredményként felvenni)
      const { data: liveEntries } = await supabase.from('startlist_entries')
        .select('competition_categories!inner(competition_days!inner(competitions!inner(name, start_date, end_date)))')
        .eq('competitor_id', targetId);
      const live = (liveEntries || []).map(e => e.competition_categories?.competition_days?.competitions).filter(Boolean);

      const matchMember = (raw) => {
        const n = fold(raw);
        if (!n) return null;
        const exact = (club || []).filter(c => fold(c.full_name) === n);
        const prefix = (club || []).filter(c => fold(c.full_name).startsWith(n + ' '));
        const nick = (club || []).filter(c => c.nickname && fold(c.nickname) === n);
        const hit = exact.length === 1 ? exact[0] : (exact.length === 0 && prefix.length === 1 ? prefix[0] : (nick.length === 1 ? nick[0] : null));
        return hit ? { competitor_id: hit.id, name: hit.full_name } : { competitor_id: null, name: String(raw).trim() };
      };

      // sorok beolvasása
      const rows = [];
      ws.eachRow((row, r) => {
        if (r < 3) return;
        const v = (c) => cellText(row.getCell(c).value);
        const raw = [1, 2, 3, 4, 7, 8, 9].map(v).filter(x => x !== '' && x !== null && x !== undefined);
        if (!raw.length) return;
        const errs = [];
        const date = parseDate(v(1));
        if (!date) errs.push('hiányzó vagy hibás dátum');
        const compName = String(v(2) || '').trim();
        if (!compName) errs.push('nincs verseny neve');
        const imp = byLabel(BESOROLAS, v(3));
        if (!imp) errs.push('besorolás a listából');
        const type = byLabel(TIPUS, v(4));
        if (!type) errs.push('versenyszám a listából');
        const app = byLabel(SZER, v(7));
        if (!app) errs.push('szer a listából');
        if (type && app && type !== 'egyeni' && app !== 'csapat') errs.push(`${TIPUS.find(t => t[0] === type)[1]} versenyszámnál a szer „Csapat”`);
        const placement = num(v(9));
        if (!placement || placement < 1 || Math.round(placement) !== placement) errs.push('helyezés (egész szám)');
        const kat = String(v(5) || '').trim();
        const kor = String(v(6) || '').trim();
        rows.push({
          r, date, compName, imp, type, app, score: num(v(8)), placement: placement ? Math.round(placement) : null,
          kategoria: KATEGORIA.includes(kat) ? kat : null, korosztaly: KOROSZTALY.includes(kor) ? kor : null,
          teamName: String(v(10) || '').trim(), mates: String(v(11) || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean),
          notes: String(v(12) || '').trim(), errs
        });
      });
      if (!rows.length) throw new Error('A fájlban nincs kitöltött sor.');

      // csoportosítás: egy verseny + versenyszám = egy bejegyzés
      const groups = [];
      rows.forEach(rw => {
        let g = rw.date && rw.compName && rw.type
          ? groups.find(x => x.date === rw.date && x.type === rw.type && similarCompName(x.compName, rw.compName))
          : null;
        if (!g) {
          g = { date: rw.date, compName: rw.compName, imp: rw.imp, type: rw.type, kategoria: rw.kategoria, korosztaly: rw.korosztaly,
                teamName: rw.teamName, notes: [], results: {}, mates: [], rows: [], errs: [] };
          groups.push(g);
        }
        g.rows.push(rw.r);
        g.kategoria = g.kategoria || rw.kategoria;
        g.korosztaly = g.korosztaly || rw.korosztaly;
        g.teamName = g.teamName || rw.teamName;
        if (rw.notes) g.notes.push(rw.notes);
        rw.mates.forEach(m => { if (!g.mates.some(x => fold(x) === fold(m))) g.mates.push(m); });
        if (rw.errs.length) { g.errs.push(`${rw.r}. sor: ${rw.errs.join(', ')}`); return; }
        if (g.results[rw.app]) { g.errs.push(`${rw.r}. sor: a(z) ${SZER.find(s => s[0] === rw.app)[1]} kétszer szerepel ennél a versenynél`); return; }
        g.results[rw.app] = { placement: rw.placement, score: rw.score };
      });

      groups.forEach(g => {
        g.isTeam = g.type !== 'egyeni' || !!g.results.csapat;
        const others = g.mates.map(matchMember).filter(m => m && m.competitor_id !== targetId);
        g.members = g.isTeam ? [{ competitor_id: targetId, name: owner.full_name }, ...others] : [];
        if (g.isTeam && others.length === 0) g.errs.push('csapateredménynél a csapattársak megadása kötelező');
        g.unmatched = others.filter(m => !m.competitor_id).map(m => m.name);
        if (g.errs.length) { g.status = 'error'; return; }
        const dupHist = (existing || []).find(h => h.competition_date === g.date && similarCompName(h.competition_name, g.compName));
        const dupLive = live.find(c => c.start_date <= g.date && (c.end_date || c.start_date) >= g.date && similarCompName(c.name, g.compName));
        if (dupHist) { g.status = 'dup'; g.dupText = `már rögzítve: ${dupHist.competition_date} · ${dupHist.competition_name}`; }
        else if (dupLive) { g.status = 'dup'; g.dupText = `ezt a versenyt a programban pontoztuk: ${dupLive.name}`; }
        else g.status = 'ok';
      });
      setState({ owner, ownerName, mismatch: ownerId && ownerId !== competitorId, groups });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const importOk = async () => {
    setBusy(true); setError(null);
    let n = 0;
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const g of state.groups.filter(x => x.status === 'ok')) {
        const payload = {
          competitor_id: state.owner.id,
          year: parseInt(g.date.slice(0, 4), 10),
          competition_date: g.date,
          competition_name: g.compName,
          competition_type: g.type,
          importance: g.imp,
          kategoria: g.kategoria,
          korosztaly: g.korosztaly,
          team_name: g.teamName || null,
          notes: g.notes.length ? g.notes.join(' · ') : null,
          results: g.results,
          team_members: g.isTeam ? g.members : [],
          created_by: u?.user?.id || null,
          modified_by: u?.user?.id || null,
          modified_at: new Date().toISOString()
        };
        const { data: ins, error: iErr } = await supabase.from('historical_results').insert(payload).select('id').single();
        if (iErr) throw new Error(`${g.date} ${g.compName}: ${iErr.message}`);
        if (g.isTeam) {
          const { error: rErr } = await supabase.rpc('sync_historical_team', { p_source: ins.id });
          if (rErr) throw new Error(`${g.date} ${g.compName} (csapattagok): ${rErr.message}`);
        }
        n += 1;
      }
      setDone(n);
      if (onImported) onImported();
    } catch (e) {
      setError(`${n} bejegyzés bekerült, utána hiba: ${e.message}`);
      if (n && onImported) onImported();
    }
    setBusy(false);
  };

  const counts = state ? ['ok', 'dup', 'error'].map(k => state.groups.filter(g => g.status === k).length) : [0, 0, 0];
  const appName = (k) => (SZER.find(s => s[0] === k) || [k, k])[1];
  return (
    <div className="rounded-lg p-3 border-2 bg-white space-y-2" style={{ borderColor: PURPLE }}>
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm" style={{ color: PURPLE }}>Kitöltött Excel betöltése</div>
        <button onClick={onClose} className="p-1 rounded border border-gray-300 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>
      <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold cursor-pointer shadow-sm" style={{ backgroundColor: PURPLE }}>
        {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Excel kiválasztása
        <input type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readFile(f); }} />
      </label>
      {error && <div className="text-sm text-red-700 bg-red-50 rounded p-2">{error}</div>}
      {state && (
        <>
          <div className="text-sm">
            Versenyző: <b>{state.owner.full_name}</b>
            {state.mismatch && <span className="ml-2 text-amber-700 font-semibold">⚠ a fájl nem ehhez a versenyzőhöz készült — az eredmények {state.owner.full_name} adataihoz kerülnek</span>}
          </div>
          <div className="flex gap-2 flex-wrap text-xs font-semibold">
            <span className="px-2 py-1 rounded bg-green-100 text-green-800">✓ új: {counts[0]}</span>
            <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">≈ már bent van: {counts[1]}</span>
            <span className="px-2 py-1 rounded bg-red-100 text-red-800">✕ hibás: {counts[2]}</span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {state.groups.map((g, i) => (
              <div key={i} className="rounded border p-2 text-xs"
                   style={{ borderColor: g.status === 'ok' ? '#86EFAC' : g.status === 'dup' ? '#FCD34D' : '#FCA5A5',
                            backgroundColor: g.status === 'ok' ? '#F0FDF4' : g.status === 'dup' ? '#FFFBEB' : '#FEF2F2' }}>
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  {g.status === 'ok' ? <CheckCircle className="w-4 h-4 text-green-600" /> : g.status === 'dup' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                  {(g.date || '?').replace(/-/g, '.')} · {g.compName || '?'}
                  <span className="font-normal text-gray-500">({(TIPUS.find(t => t[0] === g.type) || [0, '?'])[1]}, {g.rows.length} sor)</span>
                </div>
                {Object.keys(g.results).length > 0 && (
                  <div className="mt-0.5">{Object.entries(g.results).map(([k, v]) => `${appName(k)}: ${v.placement}.${v.score !== null ? ` (${v.score})` : ''}`).join(' · ')}</div>
                )}
                {g.isTeam && g.members.length > 1 && <div className="mt-0.5">👥 {g.members.map(m => m.name).join(', ')}</div>}
                {g.unmatched?.length > 0 && <div className="mt-0.5 text-amber-700">Nem klubtag (névvel kerül be): {g.unmatched.join(', ')}</div>}
                {g.status === 'dup' && <div className="mt-0.5 text-amber-800 font-semibold">Nem töltöm be — {g.dupText}</div>}
                {g.errs.length > 0 && <div className="mt-0.5 text-red-700">{g.errs.join(' | ')}</div>}
              </div>
            ))}
          </div>
          {done !== null ? (
            <div className="text-sm font-semibold text-green-700">✓ {done} bejegyzés betöltve.</div>
          ) : (
            <button onClick={importOk} disabled={busy || counts[0] === 0}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm disabled:opacity-40" style={{ backgroundColor: '#15803D' }}>
              {busy ? <Loader className="w-4 h-4 animate-spin inline" /> : null} A(z) {counts[0]} új bejegyzés betöltése
            </button>
          )}
        </>
      )}
    </div>
  );
}

// kis segéd: a versenyző adatai az azonosítóból (a letöltés gombhoz)
export function useCompetitorBasic(supabase, competitorId) {
  const [c, setC] = useState(null);
  useEffect(() => {
    if (!competitorId) return;
    supabase.from('competitors').select('id, full_name').eq('id', competitorId).maybeSingle().then(({ data }) => setC(data));
  }, [supabase, competitorId]);
  return c;
}
