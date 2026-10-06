// ═══════════════════════════════════════════════════════════════════
// Szer-ikonok (v0.9.63) — Sándor 2026.10.06: „a szerek jelölése ne szöveg
// legyen hanem kép, a szabad csak egy négyzet” (a nemzetközi eredménylisták
// mintájára: fekete keretes kis kép). Rajzolt (SVG): minden méretben éles,
// nincs külön képfájl. Ismeretlen kód (pl. „5 labda” csapatgyakorlat)
// szövegként marad; a kombinált szer („karika+labda”) ikonsor.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const NAMES = {
  szabad: 'Szabad', karika: 'Karika', labda: 'Labda',
  buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél'
};

const INK = '#111827';

// Egy buzogány: gomb fent, vékony nyak, lent kiöblösödő test
function Club({ x }) {
  return (
    <g fill={INK}>
      <circle cx={x} cy="5.4" r="1.35" />
      <rect x={x - 0.55} y="5.6" width="1.1" height="5" />
      <path d={`M${x - 0.6} 10 C ${x - 2.7} 12.5, ${x - 2.5} 18.6, ${x} 19 C ${x + 2.5} 18.6, ${x + 2.7} 12.5, ${x + 0.6} 10 Z`} />
    </g>
  );
}

function Inner({ kind }) {
  switch (kind) {
    case 'karika':
      return <circle cx="12" cy="12" r="6.6" fill="none" stroke={INK} strokeWidth="1.7" />;
    case 'labda':
      return <circle cx="12" cy="12" r="3.3" fill={INK} />;
    case 'buzogany':
      return <g><Club x={9.4} /><Club x={14.6} /></g>;
    case 'szalag':
      return (
        <path d="M6.5 18.5 C 4.8 13.5, 8.6 7.2, 13 8 C 17.2 8.8, 17.2 14.4, 13.2 15.2 C 10 15.8, 9 12.2, 11.8 10.2 C 14 8.6, 16.6 7, 18.2 5.2"
              fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      );
    case 'kotel':
      return (
        <g>
          <path d="M8 16.5 C 4.5 7, 19.5 7, 16 16.5" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          <rect x="6.7" y="16" width="2.6" height="3.4" rx="0.8" fill={INK} />
          <rect x="14.7" y="16" width="2.6" height="3.4" rx="0.8" fill={INK} />
        </g>
      );
    default:
      return null; // szabad: üres négyzet
  }
}

// Egy szer képe fekete keretben
export function ApparatusIcon({ kind, size = 22, className = '' }) {
  if (!NAMES[kind]) return <span className={className}>{kind}</span>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`inline-block align-middle flex-shrink-0 ${className}`}
         role="img" aria-label={NAMES[kind]}>
      <title>{NAMES[kind]}</title>
      <rect x="1.2" y="1.2" width="21.6" height="21.6" fill="white" stroke={INK} strokeWidth="1.6" />
      <Inner kind={kind} />
    </svg>
  );
}

// Szer-érték (pl. „karika”, „karika+labda”, „5 labda”) ikonként; üres → fallback
export function ApparatusMark({ value, size = 22, fallback = null, className = '' }) {
  if (!value) return fallback;
  const parts = String(value).split('+').map(p => p.trim()).filter(Boolean);
  if (!parts.every(p => NAMES[p])) return <span className={className}>{value}</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className}`} title={parts.map(p => NAMES[p]).join(' + ')}>
      {parts.map((p, i) => <ApparatusIcon key={i} kind={p} size={size} />)}
    </span>
  );
}
