// ═══════════════════════════════════════════════════════════════════
// Szer-ikonok (v0.9.63) — Sándor 2026.10.06: „a szerek jelölése ne szöveg
// legyen hanem kép, a szabad csak egy négyzet” (a nemzetközi eredménylisták
// mintájára: keretes kis kép). Ismeretlen kód (pl. „5 labda” csapatgyakorlat)
// szövegként marad; a kombinált szer („karika+labda”) ikonsor.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const NAMES = {
  szabad: 'Szabad', karika: 'Karika', labda: 'Labda',
  buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél'
};

function Inner({ kind }) {
  switch (kind) {
    case 'karika':
      return <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />;
    case 'labda':
      return <circle cx="12" cy="12" r="4.2" fill="currentColor" />;
    case 'buzogany':
      return (
        <g fill="currentColor">
          {[9, 15].map(x => (
            <g key={x}>
              <circle cx={x} cy="5.6" r="1.25" />
              <rect x={x - 0.65} y="5.6" width="1.3" height="5" />
              <ellipse cx={x} cy="14.6" rx="2.1" ry="4.4" />
            </g>
          ))}
        </g>
      );
    case 'szalag':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M6 18 C 6 10, 13 6, 15 9 C 17 12, 11 15, 10 12 C 9 8, 15 5, 18 6" />
          <path d="M6 18 L 5 19.5" />
        </g>
      );
    case 'kotel':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 17 C 5 9, 19 9, 16 17" />
          <rect x="6.6" y="16.5" width="2.6" height="2.8" rx="0.6" fill="currentColor" />
          <rect x="14.8" y="16.5" width="2.6" height="2.8" rx="0.6" fill="currentColor" />
        </g>
      );
    default:
      return null; // szabad: üres négyzet
  }
}

// Egy szer kis képe keretben
export function ApparatusIcon({ kind, size = 18, className = '' }) {
  if (!NAMES[kind]) return <span className={className}>{kind}</span>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`inline-block align-middle flex-shrink-0 ${className}`}
         role="img" aria-label={NAMES[kind]}>
      <title>{NAMES[kind]}</title>
      <rect x="1.5" y="1.5" width="21" height="21" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <Inner kind={kind} />
    </svg>
  );
}

// Szer-érték (pl. „karika”, „karika+labda”, „5 labda”) ikonként; üres → fallback
export function ApparatusMark({ value, size = 18, fallback = null, className = '' }) {
  if (!value) return fallback;
  const parts = String(value).split('+').map(p => p.trim()).filter(Boolean);
  if (!parts.every(p => NAMES[p])) return <span className={className}>{value}</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className}`} title={parts.map(p => NAMES[p]).join(' + ')}>
      {parts.map((p, i) => <ApparatusIcon key={i} kind={p} size={size} />)}
    </span>
  );
}
