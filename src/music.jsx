// ═══════════════════════════════════════════════════════════════════
// Gyakorlatzenék (v0.9.83) — Kata + Sándor 2026.10.15
//   - az edző gyerekenként, szerenként EGY zenét tölt fel; az új a régit
//     lecseréli (a régi fájl törlődik); csapatgyakorlathoz nincs zene
//   - a gyerek, a szülője és az edzők látják a feltöltés dátumával,
//     belehallgathatnak és letölthetik (fájlnév: név_gyakorlat)
//   - a fájl úgy marad, ahogy feltöltötték (MP3 ajánlott, max 15 MB)
//   - forgalomkímélés (ingyenes csomag, havi 5 GB letöltés): a lejátszó csak
//     a „Belehallgatás” gombra tölt; a gyakorláshoz a Letöltés ajánlott
// Adatbázis: docs/sql/2026-10-15_v0.9.83_gyakorlatzenek.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Upload, Download, Play, Trash2, Loader } from 'lucide-react';
import { ApparatusIcon } from './apparatusIcons';

const BUCKET = 'music';
const MAX_BYTES = 15 * 1024 * 1024;
const UPLOADERS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];
const BLUE = '#1e3a8a';
const APPARATUS = [
  { key: 'szabad', label: 'Szabad' }, { key: 'karika', label: 'Karika' }, { key: 'labda', label: 'Labda' },
  { key: 'buzogany', label: 'Buzogány' }, { key: 'szalag', label: 'Szalag' }, { key: 'kotel', label: 'Kötél' }
];
const ACCEPT = '.mp3,.m4a,.aac,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav';

const ascii = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const huDate = (iso) => (iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '') : '');
const extOf = (name) => { const m = /\.([a-z0-9]{2,4})$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'mp3'; };
const mb = (b) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');

// A letöltött fájl neve: név_gyakorlat (pl. Volgyesi_Noemi_Karika.mp3) — a feltöltés
// dátuma a listában látszik, a fájlnévbe nem kell (Sándor 2026.10.15)
export const musicFileName = (fullName, appLabel, original) =>
  `${ascii(fullName)}_${ascii(appLabel)}.${extOf(original)}`;

// Feltöltés (új vagy csere): a régi fájl törlődik. Hibánál magyar üzenettel dob.
async function uploadMusic(supabase, competitorId, appKey, file, oldItem) {
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav)$/i.test(file.name)) throw new Error('Hangfájlt válassz (MP3 ajánlott).');
  if (file.size > MAX_BYTES) throw new Error('Legfeljebb 15 MB lehet. Az MP3 általában 2–4 MB.');
  const path = `${competitorId}/${appKey}_${Date.now()}.${extOf(file.name)}`;
  const type = file.type || (extOf(file.name) === 'mp3' ? 'audio/mpeg' : 'audio/mp4');
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (upErr) throw new Error('Feltöltés sikertelen: ' + upErr.message);
  const row = { competitor_id: competitorId, apparatus: appKey, file_path: path, original_name: file.name,
                size_bytes: file.size, uploaded_at: new Date().toISOString() };
  const { error: dbErr } = await supabase.from('competitor_music').upsert(row, { onConflict: 'competitor_id,apparatus' });
  if (dbErr) { await supabase.storage.from(BUCKET).remove([path]); throw new Error('Mentés sikertelen: ' + dbErr.message); }
  if (oldItem?.file_path && oldItem.file_path !== path) await supabase.storage.from(BUCKET).remove([oldItem.file_path]);
}

// v0.9.83 (Sándor): csak a feltöltött zenék sora látszik; új zene = „Zene feltöltése”
// ablak: szer kiválasztása → fájl → feltöltés
function UploadForm({ supabase, competitorId, byApp, onDone, onCancel }) {
  const [app, setApp] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    if (!app || !file) return;
    if (byApp[app] && !window.confirm('Ehhez a szerhez már van zene. Lecseréled az újra? (A régi törlődik.)')) return;
    setBusy(true); setError(null);
    try { await uploadMusic(supabase, competitorId, app, file, byApp[app]); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="rounded-lg border-2 p-3 my-2 space-y-2" style={{ borderColor: '#FBCFE8', backgroundColor: '#FFF7FB' }}>
      <div className="text-sm font-semibold" style={{ color: '#BE185D' }}>1. Melyik gyakorlat?</div>
      <div className="flex flex-wrap gap-2">
        {APPARATUS.map(a => (
          <button key={a.key} onClick={() => setApp(a.key)}
                  className="px-3 py-2 rounded-lg border-2 text-sm font-semibold flex items-center gap-2 bg-white"
                  style={{ borderColor: app === a.key ? '#BE185D' : '#E5E7EB', backgroundColor: app === a.key ? '#FDF2F8' : 'white' }}>
            <ApparatusIcon kind={a.key} size={22} /> {a.label}{byApp[a.key] && <span className="text-[10px] font-normal text-gray-500">(van)</span>}
          </button>
        ))}
      </div>
      <div className="text-sm font-semibold" style={{ color: '#BE185D' }}>2. A zene</div>
      <input type="file" accept={ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm" />
      {file && <div className="text-xs text-gray-600">{file.name} · {mb(file.size)}</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button onClick={go} disabled={!app || !file || busy}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-40" style={{ backgroundColor: '#BE185D' }}>
          {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Feltöltés
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Mégse</button>
      </div>
    </div>
  );
}

function MusicRow({ supabase, item, app, competitorId, competitorName, canUpload, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [playUrl, setPlayUrl] = useState(null);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try { await uploadMusic(supabase, competitorId, app.key, file, item); setPlayUrl(null); onChanged(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm(`Törlöd a(z) ${app.label} zenét?`)) return;
    setBusy(true);
    const { error: err } = await supabase.from('competitor_music').delete().eq('id', item.id);
    if (!err) await supabase.storage.from(BUCKET).remove([item.file_path]);
    setBusy(false);
    if (err) setError(err.message); else onChanged();
  };
  const play = async () => {
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_path, 3600);
    if (err) setError(err.message); else setPlayUrl(data.signedUrl);
  };
  const download = async () => {
    const name = musicFileName(competitorName, app.label, item.original_name);
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_path, 600, { download: name });
    if (err) { setError(err.message); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="py-2.5 border-b last:border-b-0" style={{ borderColor: '#F3F4F6' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <ApparatusIcon kind={app.key} size={28} />
        <div className="flex-1 min-w-[140px]">
          <div className="font-semibold text-sm">{app.label}</div>
          {item
            ? <div className="text-xs text-gray-600">Feltöltve: <b>{huDate(item.uploaded_at)}</b>{item.size_bytes ? ` · ${mb(item.size_bytes)}` : ''}</div>
            : <div className="text-xs text-gray-400 italic">Még nincs zene</div>}
        </div>
        {item && (
          <>
            <button onClick={play} className="px-3 py-1.5 rounded-lg border-2 text-xs font-semibold flex items-center gap-1 bg-white" style={{ borderColor: BLUE, color: BLUE }}>
              <Play className="w-3.5 h-3.5" /> Belehallgatás
            </button>
            <button onClick={download} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 shadow-sm" style={{ backgroundColor: BLUE }}>
              <Download className="w-3.5 h-3.5" /> Letöltés
            </button>
          </>
        )}
        {canUpload && (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 shadow-sm disabled:opacity-50" style={{ backgroundColor: '#BE185D' }}>
              {busy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {item ? 'Csere' : 'Feltöltés'}
            </button>
            {item && (
              <button onClick={remove} disabled={busy} className="p-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-50" title="Zene törlése">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </>
        )}
      </div>
      {playUrl && <audio controls autoPlay src={playUrl} className="w-full mt-2" />}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

export function MusicPanel({ supabase, competitorId, competitorName, userRole }) {
  const canUpload = UPLOADERS.includes(userRole);
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('competitor_music').select('*').eq('competitor_id', competitorId);
    setItems(error ? [] : (data || []));
  }, [supabase, competitorId]);
  useEffect(() => { load(); }, [load]);
  if (items === null) return null;
  const byApp = Object.fromEntries(items.map(i => [i.apparatus, i]));
  const shown = APPARATUS.filter(a => byApp[a.key]);
  if (!canUpload && shown.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="font-semibold flex items-center gap-2" style={{ color: BLUE }}><Music className="w-5 h-5" /> Gyakorlatzenék</div>
        {canUpload && !adding && (
          <button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 shadow-sm" style={{ backgroundColor: '#BE185D' }}>
            <Upload className="w-3.5 h-3.5" /> Zene feltöltése
          </button>
        )}
      </div>
      <div className="text-xs text-gray-500 mb-1">
        {canUpload ? 'Szerenként egy zene; az új feltöltés lecseréli a régit. MP3 ajánlott, legfeljebb 15 MB.' : 'Gyakorláshoz töltsd le a telefonodra — a Belehallgatás csak gyors ellenőrzésre való.'}
      </div>
      {adding && <UploadForm supabase={supabase} competitorId={competitorId} byApp={byApp}
                             onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}
      {shown.length === 0 && !adding && <div className="text-sm text-gray-400 italic py-1">Még nincs feltöltött zene.</div>}
      {shown.map(app => (
        <MusicRow key={app.key} supabase={supabase} item={byApp[app.key]} app={app} competitorId={competitorId}
                  competitorName={competitorName} canUpload={canUpload} onChanged={load} />
      ))}
    </div>
  );
}
