// ═══════════════════════════════════════════════════════════════════
// Gyakorlatzenék (v0.9.83) — Kata + Sándor 2026.10.15
//   - az edző gyerekenként, szerenként EGY zenét tölt fel; az új a régit
//     lecseréli (a régi fájl törlődik); csapatgyakorlathoz nincs zene
//   - a gyerek, a szülője és az edzők látják a feltöltés dátumával,
//     belehallgathatnak és letölthetik (fájlnév: név_gyakorlat_dátum)
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
const isoDay = (iso) => (iso || '').slice(0, 10);
const extOf = (name) => { const m = /\.([a-z0-9]{2,4})$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'mp3'; };
const mb = (b) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');

// A letöltött fájl neve: név_gyakorlat_dátum (pl. Volgyesi_Noemi_Karika_2026-10-15.mp3)
export const musicFileName = (fullName, appLabel, uploadedAt, original) =>
  `${ascii(fullName)}_${ascii(appLabel)}_${isoDay(uploadedAt)}.${extOf(original)}`;

function MusicRow({ supabase, item, app, competitorId, competitorName, canUpload, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [playUrl, setPlayUrl] = useState(null);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setError(null);
    if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav)$/i.test(file.name)) { setError('Hangfájlt válassz (MP3 ajánlott).'); return; }
    if (file.size > MAX_BYTES) { setError('Legfeljebb 15 MB lehet. Az MP3 általában 2–4 MB.'); return; }
    setBusy(true);
    try {
      const path = `${competitorId}/${app.key}_${Date.now()}.${extOf(file.name)}`;
      const type = file.type || (extOf(file.name) === 'mp3' ? 'audio/mpeg' : 'audio/mp4');
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false });
      if (upErr) throw upErr;
      const row = { competitor_id: competitorId, apparatus: app.key, file_path: path, original_name: file.name,
                    size_bytes: file.size, uploaded_at: new Date().toISOString() };
      const { error: dbErr } = await supabase.from('competitor_music').upsert(row, { onConflict: 'competitor_id,apparatus' });
      if (dbErr) { await supabase.storage.from(BUCKET).remove([path]); throw dbErr; }
      if (item?.file_path && item.file_path !== path) await supabase.storage.from(BUCKET).remove([item.file_path]);
      setPlayUrl(null);
      onChanged();
    } catch (err) { setError('Feltöltés sikertelen: ' + err.message); }
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
    const name = musicFileName(competitorName, app.label, item.uploaded_at, item.original_name);
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
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('competitor_music').select('*').eq('competitor_id', competitorId);
    setItems(error ? [] : (data || []));
  }, [supabase, competitorId]);
  useEffect(() => { load(); }, [load]);
  if (items === null) return null;
  const byApp = Object.fromEntries(items.map(i => [i.apparatus, i]));
  const shown = canUpload ? APPARATUS : APPARATUS.filter(a => byApp[a.key]);
  if (!canUpload && shown.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
      <div className="font-semibold flex items-center gap-2 mb-1" style={{ color: BLUE }}><Music className="w-5 h-5" /> Gyakorlatzenék</div>
      <div className="text-xs text-gray-500 mb-1">
        {canUpload ? 'Szerenként egy zene; az új feltöltés lecseréli a régit. MP3 ajánlott, legfeljebb 15 MB.' : 'Gyakorláshoz töltsd le a telefonodra — a Belehallgatás csak gyors ellenőrzésre való.'}
      </div>
      {shown.map(app => (
        <MusicRow key={app.key} supabase={supabase} item={byApp[app.key]} app={app} competitorId={competitorId}
                  competitorName={competitorName} canUpload={canUpload} onChanged={load} />
      ))}
    </div>
  );
}
