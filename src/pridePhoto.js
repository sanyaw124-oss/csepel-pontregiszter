// ═══════════════════════════════════════════════════════════════════
// Klub büszkesége — fotó (v0.9.52), Sándor 2026.10.04
//   - bejegyzésenként egy fotó; feltölteni az Admin / Szülő-admin /
//     Vezetőedző / Edző tud (Adminisztráció → Klub büszkesége)
//   - privát tárhely ('club-photos'), csak bejelentkezve látszik, rövid
//     lejáratú linkkel; feltöltés előtt kicsinyítés (max 1200 px, JPEG)
//   - jobb klikk / húzás tiltva, mint a profilképnél
// Adatbázis: docs/sql/2026-10-04_v0.9.52_buszkeseg-foto.sql
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { resizeImage } from './avatar';

export const PRIDE_BUCKET = 'club-photos';
const MAX_SIDE = 1200;

// Új fotó feltöltése egy bejegyzéshez; a régi törlése. Visszaadja az új útvonalat.
export async function uploadPridePhoto(supabase, prideId, file, oldPath) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Képfájlt válassz (JPG, PNG)!');
  const blob = await resizeImage(file, MAX_SIDE);
  const path = `${prideId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from(PRIDE_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('club_pride').update({ photo_path: path }).eq('id', prideId);
  if (dbErr) {
    await supabase.storage.from(PRIDE_BUCKET).remove([path]);
    throw dbErr;
  }
  if (oldPath && oldPath !== path) await supabase.storage.from(PRIDE_BUCKET).remove([oldPath]);
  return path;
}

// Fotó eltávolítása egy bejegyzésről (a fájl is törlődik)
export async function removePridePhoto(supabase, prideId, path) {
  const { error } = await supabase.from('club_pride').update({ photo_path: null }).eq('id', prideId);
  if (error) throw error;
  if (path) await supabase.storage.from(PRIDE_BUCKET).remove([path]);
}

// Csak a fájl törlése (a bejegyzés törlésekor)
export async function deletePrideFile(supabase, path) {
  if (path) await supabase.storage.from(PRIDE_BUCKET).remove([path]);
}

// Rövid lejáratú link a fotóhoz (null, ha nincs)
export function usePridePhotoUrl(supabase, path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    if (!supabase || !path) { setUrl(null); return; }
    supabase.storage.from(PRIDE_BUCKET).createSignedUrl(path, 60 * 60)
      .then(({ data }) => { if (active) setUrl(data?.signedUrl || null); })
      .catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [supabase, path]);
  return url;
}
