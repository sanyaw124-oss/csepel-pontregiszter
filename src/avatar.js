// ═══════════════════════════════════════════════════════════════════
// Profilkép (v0.9.50) — Sándor 2026.10.04
//   - a versenyző (gyerek) tölti fel; csak RG témájú kép
//   - privát tárhely ('avatars'), csak bejelentkezve, rövid lejáratú linkkel
//   - feltöltés előtt kicsinyítés (max 512 px, JPEG) → kb. 30–80 KB
//   - a versenyző adatlapján mindenki látja, aki belép; letöltés gomb nincs,
//     jobb klikk / húzás tiltva (képernyőkép ellen nincs védelem)
//   - Admin / Szülő-admin / Vezetőedző / Edző elrejtheti: bejegyzés az
//     avatar_rejections táblába (a gyerek nem írhatja) + a fájl törlése;
//     a gyerek a programban értesítést kap, és új kép feltöltéséig nem látszik kép
// Adatbázis: docs/sql/2026-10-04_v0.9.50_nem-indult_profilkep.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';

export const AVATAR_BUCKET = 'avatars';
const MAX_SIDE = 512;
const SIGNED_URL_SECONDS = 60 * 60;

export const MODERATOR_ROLES = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];
export const canModerate = (role) => MODERATOR_ROLES.includes(role);

export const AVATAR_RULES_TEXT =
  'Csak RG témájú képet tölthetsz fel: téged ábrázoló edzés-, verseny- vagy dresszes képet. ' +
  'Más kép (barátok, állatok, mémek, más emberek) nem lehet — az edzők elrejtik.';

// Kép kicsinyítése a böngészőben: a hosszabbik oldal legfeljebb maxSide px, JPEG
// (a klub büszkesége fotói is ezt használják)
export function resizeImage(file, maxSide = MAX_SIDE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('A kép feldolgozása nem sikerült'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ez nem olvasható képfájl')); };
    img.src = url;
  });
}

// Feltöltés: új fájl a versenyző mappájába, a régi törlése
export async function uploadAvatar(supabase, competitor, file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Képfájlt válassz (JPG, PNG)!');
  const blob = await resizeImage(file);
  const path = `${competitor.id}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('competitors')
    .update({ avatar_path: path }).eq('id', competitor.id);
  if (dbErr) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw dbErr;
  }
  if (competitor.avatar_path && competitor.avatar_path !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([competitor.avatar_path]);
  }
  return path;
}

// Elrejtés (edző): bejegyzés + a fájl törlése. Az avatar_path marad, ebből
// tudja a program, hogy a gyerek jelenlegi képe el lett rejtve.
export async function rejectAvatar(supabase, competitor) {
  if (!competitor?.avatar_path) return;
  const { error } = await supabase.from('avatar_rejections')
    .upsert({ competitor_id: competitor.id, avatar_path: competitor.avatar_path },
            { onConflict: 'competitor_id,avatar_path' });
  if (error) throw error;
  await supabase.storage.from(AVATAR_BUCKET).remove([competitor.avatar_path]);
}

// Elrejtett-e a versenyző jelenlegi képe?
export async function isAvatarRejected(supabase, competitor) {
  if (!competitor?.avatar_path) return false;
  const { data } = await supabase.from('avatar_rejections')
    .select('id').eq('competitor_id', competitor.id).eq('avatar_path', competitor.avatar_path)
    .maybeSingle();
  return !!data;
}

// Egy versenyző képének rövid lejáratú linkje (null, ha nincs vagy el van rejtve).
// `version` növelésével újratölthető (feltöltés / elrejtés után).
export function useAvatarUrl(supabase, competitor, version = 0) {
  const [state, setState] = useState({ url: null, rejected: false, loading: true });
  const id = competitor?.id;
  const path = competitor?.avatar_path;
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase || !id || !path) { if (active) setState({ url: null, rejected: false, loading: false }); return; }
      try {
        const rejected = await isAvatarRejected(supabase, { id, avatar_path: path });
        if (rejected) { if (active) setState({ url: null, rejected: true, loading: false }); return; }
        const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
        if (active) setState({ url: data?.signedUrl || null, rejected: false, loading: false });
      } catch (err) {
        console.error('useAvatarUrl:', err);
        if (active) setState({ url: null, rejected: false, loading: false });
      }
    })();
    return () => { active = false; };
  }, [supabase, id, path, version]);
  return state;
}

// Megjelenítés: kép, ha van; különben az avatar-emoji. Letöltés-nehezítés:
// háttérképként rajzolva (nincs "Kép mentése" menü), jobb klikk és húzás tiltva.
export function AvatarImage({ url, emoji = '🎀', size = 96, className = '' }) {
  if (!url) {
    return <div className={className} style={{ fontSize: Math.round(size * 0.75), lineHeight: 1 }}>{emoji}</div>;
  }
  return (
    <div
      className={className}
      role="img"
      aria-label="Profilkép"
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      style={{
        width: size, height: size, borderRadius: '50%', margin: '0 auto',
        backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center',
        border: '3px solid #FBCFE8', userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    />
  );
}
