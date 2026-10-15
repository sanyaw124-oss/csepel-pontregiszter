// ═══════════════════════════════════════════════════════════════════
// „Mit tehetek itt?” (v0.9.80) — Sándor + Kata 2026.10.15: minden oldalon
// egy kis ⓘ ikon; rávitt egérrel vagy koppintásra rövid leírás arról, mit
// tehet ott a belépett felhasználó a szerepköre szerint.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

const STAFF = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'];
const EDITORS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];
const ROLE_NAMES = {
  admin: 'Admin', szulo_admin: 'Szülő-admin', vezetoedzo: 'Vezetőedző', edzo: 'Edző',
  segededzo: 'Segédedző', szulo: 'Szülő', versenyzo: 'Versenyző'
};

// Oldalanként a leírás (pontokba szedve) a szerepkör szerint
function infoFor(view, role) {
  const staff = STAFF.includes(role);
  const editor = EDITORS.includes(role);
  const kid = role === 'versenyzo';
  const parent = role === 'szulo';
  switch (view) {
    case 'dashboard':
      return kid
        ? ['A napi köszöntés, a profilképed és a napi idézet.', 'Az érmeid, az edzéseid és a legutóbbi eredményed.', 'A klub hírei és a közelgő versenyek.',
           'Ha egy csapattársadnak szülinapja van, a „Köszöntöm” gombbal matricát és jókívánságot küldhetsz neki (a napján és utána 7 napig).']
        : ['A klub hírei, a közelgő versenyek és események, a szülinaposok.',
           ...(parent || role === 'szulo_admin' ? ['A gyermeked legfrissebb adatai és az új edzői bejegyzések jelzése.'] : []),
           ...(staff ? ['Klubszintű összesítők, a klub legjobbjai.'] : [])];
    case 'profile':
      return kid
        ? ['A saját adataid, profilkép feltöltése (csak RG témájú kép).', 'Az eredményeid, a fejlődési grafikonod és a statisztikád.']
        : ['A gyermeked adatai: érmek, eredmények, grafikon, statisztika, edzések, kitűzők, edzői értékelés és napló.',
           'Edzést rögzíthetsz neki (ma és az elmúlt 7 nap), korábbi eredményt vihetsz fel, és szerkesztheted a személyes adatait.',
           'A „Verseny összesítő” gombbal egy évről PDF-et készíthetsz.'];
    case 'treasure':
      return ['Az éremfalad, a kitűzőid, a kedvenceid és céljaid.', 'Az edződ értékelése és a statisztikád.',
              'Legfeljebb 3 legjobb barátnőt jelölhetsz — csak ti ketten és a szüleitek látjátok.', 'A kapott szülinapi köszöntéseid.'];
    case 'competitors':
      return staff
        ? ['A klub összes aktív versenyzője, profilképpel. Keresés és kategóriaszűrő.',
           'Egy versenyzőt megnyitva mindent látsz róla: érmek, eredmények, grafikon, statisztika, edzések, kitűzők, értékelés, edzői napló.',
           ...(editor ? ['Innen szerkesztheted az adatait („Adatok szerkesztése”), és elrejtheted a nem megfelelő profilképet.'] : [])]
        : ['A klubtársak listája. Egy versenyzőt megnyitva látod az érmeit, helyezéseit és a kedvenceit.',
           'Pontszámot csak a saját (gyermeked) adatlapján látsz.'];
    case 'competitions':
      return editor
        ? ['A versenyek listája és naptára. Új verseny felvétele, kategóriák, startlista (importálás JSON-ból), csapatok.',
           'Verseny közben pontozás, a végén helyezések és lezárás. Lezárt verseny újranyitható.']
        : ['A versenyek listája, a startlisták időpontokkal és a lezárt versenyek eredményei.'];
    case 'calendar':
      return ['A versenyek havi naptárban, a hónap listájával. Egy versenyre kattintva: időpont, helyszín, érkezés.',
              ...(editor ? ['Új versenyt a Versenyek fülön veszel fel — magától megjelenik itt is.'] : []),
              'Az Áttekintésen a következő 30 nap versenyei látszanak.'];
    case 'training':
      return staff
        ? ['„Klub összesítő”: ki hány edzésen volt havi vagy éves bontásban.', '„Edzés rögzítése”: a napi jelenlét felvétele (edzés, egész napos, tábor, balett).']
        : kid
          ? ['Az edzéseid száma havi és éves bontásban.', 'Rögzítheted a mai vagy az elmúlt 7 nap edzését, ha az edző még nem tette meg.']
          : ['A gyermeked edzései havi és éves bontásban.'];
    case 'events':
      return editor
        ? ['A klub üzenőfala: hírek, események, közlemények. Új bejegyzést írhatsz, a sajátodat szerkesztheted.']
        : ['A klub hírei, eseményei, közleményei.'];
    case 'club':
      return editor
        ? ['A klub hivatalos adatai, az SZJA 1% szöveg, a bemutatkozás (magyarul, angolul), a vezetőség és az edzők.',
           '„Adatok szerkesztése”, új személy, sorrend. A listából törlés a fiókot nem érinti.',
           'Az „Adatlap PDF” egy lapon adja mindezt. Ebből készül a dokumentumok fejléce és aláírás-sora.']
        : ['A klub adatai, az SZJA 1% felajánláshoz szükséges név és adószám (másolás gombbal), a vezetőség és az edzők.',
           'Az „Adatlap PDF” egy lapon adja mindezt.'];
    case 'documents':
      return kid
        ? ['A rólad készült lapok (bemutatkozó lap, egyesületi igazolás). Megnézheted és PDF-et készíthetsz belőlük.']
        : ['Bemutatkozó lap és egyesületi igazolás egy versenyzőről, magyarul vagy angolul, egyesületi fejléccel.',
           'Választható: időszak, versenyfajta, egyéni / csapat, helyezés, egyenként pipálható eredmények, 1 fotó, aláírók.',
           ...(parent ? ['Csak a saját gyermekednek készíthetsz lapot.'] : []),
           ...(editor ? ['Gyerekenként megírhatod az edzői ajánlást és bejelölheted a válogatott kerettagot.'] : [])];
    case 'stats':
      return ['Versenyző fül: edzői értékelés, évösszefoglaló PDF, grafikon, statisztika, kitűzők.',
              'Klub fül: edzéslátogatás, érmek korosztályonként, a legtöbbet fejlődők.'];
    case 'coach-posts':
      return ['Edzői napló: bejegyzések a gyerekekről (a szülő a saját gyerekéét látja).',
              ...(editor ? ['Klub büszkesége: a kiemelt eredmények fotóval, a nyitóoldalon jelennek meg.'] : []),
              'Üzenőfal: a klub hírei és eseményei.'];
    case 'coach-notes':
      return ['Az edzők bejegyzései a gyermekedről. Olvasni tudod, írni az edzők írnak.'];
    case 'admin':
      return ['Fiókok és kapcsolatok: versenyzők felvétele, szülői és edzői fiókok, ki kinek a szülője.',
              'A versenyzők napi kezelése (adatok, kép) a Versenyzők fülön is megy.'];
    default:
      return null;
  }
}

export function PageInfo({ view, role }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef(null);
  const items = infoFor(view, role);
  useEffect(() => { setOpen(false); }, [view]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  if (!items || items.length === 0) return null;
  const shown = open || hover;
  return (
    <div ref={ref} className="relative flex justify-end -mb-2" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={() => setOpen(o => !o)} aria-label="Mit tehetek itt?"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: '#1D4ED8' }}>
        <Info className="w-4 h-4" /> Mit tehetek itt?
      </button>
      {shown && (
        <div className="absolute right-0 top-full mt-1 z-40 w-80 max-w-[90vw] bg-white rounded-lg border shadow-lg p-3 text-sm"
             style={{ borderColor: '#BFDBFE' }}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
              {ROLE_NAMES[role] || 'Felhasználó'} — ezen az oldalon
            </div>
            {open && <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-gray-100"><X className="w-3.5 h-3.5 text-gray-500" /></button>}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-gray-700">
            {items.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
