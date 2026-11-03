// ═══════════════════════════════════════════════════════════════════
// Egyesület fül — bemutatkozó (v1.13.0), Sándor 2026.11.03.
//   - DRAFT: a netről gyűjtött adatok piszkozata. Amíg nincs elmentett
//     bemutatkozás, csak a kezelők látják; közzététel után az adatbázisból jön.
//   - A bemutatkozás sima szöveg, egyszerű jelölésekkel (a szerkesztőben is
//     leírva): ! szám | felirat = kiemelt csempe, ## cím, - lista, - 1987: szöveg
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const BLUE = '#1e3a8a';
const RED = '#B91C1C';

export const DRAFT = {
  official_name: 'Csepeli Ritmikus Gimnasztika Club',
  address: '1212 Budapest, Széchenyi utca 29.',
  tax_number: '18242739-1-43',
  phone: '+36 30 242 1672',
  email: 'kfzsuzsi@gmail.com',
  website: 'https://www.facebook.com/csepelirgklub',
  intro_hu: `! 1987 | óta működünk
! 3 éves | kortól ovis torna
! 6 éves | kortól versenyzés
! 3. hely | az MRGSZ 2023-as összevont egyesületi rangsorában

A Csepeli Ritmikus Gimnasztika Club 1987 óta várja Csepelen a ritmikus gimnasztikát szerető lányokat. A kezdeti húszfős csoportból mára az ország egyik meghatározó egyesülete lett. Mottónk: „Ügyesen, Okosan, Mosoly”.

## Kiket várunk?
- Hároméves kortól ovis tornára
- Hatéves kortól versenyzőnek, egyéniben és csapatban, egészen felnőtt korig
- Szabadidős és versenyző formában is lehet nálunk sportolni

## Így dolgozunk
- A versenyzők heti 4–5 alkalommal edzenek
- Az edzés része az erősítés, a nyújtás, a testtechnika és a balett
- A kisebbek karikával, labdával és kötéllel, 12 éves kortól buzogánnyal és szalaggal is gyakorolnak

## Edzőink
Kiss Kata vezetőedző 15-szörös országos bajnok, 1993 és 2008 között a válogatott tagja, kétszer választották az év ritmikus gimnasztikázójának. Pályafutása után légtornászként a Fővárosi Nagycirkuszban is fellépett. A munkát Eszenyi Zsuzsanna edző segíti, aki maga is sikeres versenyző volt.

## Mérföldkövek
- 1987: Megalakul a klub.
- 2004: Kiss Katalin megnyeri a Magyar Kupát és a mesterfokú bajnokság egyéni összetettjét. A klub a mesterfokún négy aranyat, egy ezüstöt és két bronzot szerez.
- 2019: Egy athéni nemzetközi versenyen minden indulónk dobogóra áll: két egyéni arany és csapatgyőzelem.
- 2023: 3. hely az MRGSZ összevont egyesületi rangsorában.
- 2026: Magyar Kupa, Törökbálint: 2. hely együttes kéziszer-csapatban és kombinált csapatban, 3. hely egyéni csapatban.

## Csepelhez tartozunk
A Csepel SC Alapítvánnyal együttműködő sportszervezetként Csepel sportéletének része vagyunk.`,
  intro_en: `! 1987 | founded
! Age 3 | pre-school gymnastics
! Age 6 | competing
! 3rd place | in the 2023 combined club ranking of the Hungarian federation

Csepeli Ritmikus Gimnasztika Club has welcomed girls who love rhythmic gymnastics in Csepel, Budapest, since 1987. From an initial group of twenty, it has grown into one of Hungary's leading clubs. Our motto: "Skilfully, Smartly, with a Smile".

## Who we welcome
- Pre-school gymnastics from age three
- Competitors from age six, individually and in teams, up to senior level
- Both recreational and competitive training

## How we work
- Competitors train 4–5 times a week
- Training includes strength, flexibility, body technique and ballet
- Younger gymnasts work with hoop, ball and rope, and from age 12 with clubs and ribbon too

## Our coaches
Head coach Kata Kiss is a 15-time national champion, was a member of the national team between 1993 and 2008, and was twice named rhythmic gymnast of the year. After her competitive career she also performed as an aerialist at the Budapest Circus. Coach Zsuzsanna Eszenyi, herself a successful competitor, supports the work.

## Milestones
- 1987: The club is founded.
- 2004: Katalin Kiss wins the Hungarian Cup and the all-around at the master-level championship. The club takes four golds, a silver and two bronzes there.
- 2019: At an international competition in Athens, all our gymnasts reach the podium: two individual golds and a team win.
- 2023: 3rd place in the combined club ranking of the Hungarian federation.
- 2026: Hungarian Cup, Törökbálint: 2nd in the group team and combined team events, 3rd in the individual team event.

## Part of Csepel
As a sports organisation cooperating with the Csepel SC Foundation, we are part of the sporting life of Csepel.`
};

const FACT = /^!\s*(.+?)\s*\|\s*(.+)$/;
const HEADING = /^##\s*(.+)$/;
const ITEM = /^[-•]\s*(.+)$/;
const DATED = /^(\d{4}(?:[–-]\d{4})?):\s*(.+)$/;

// A szöveg felbontása blokkokra: csempék, címek, listák, bekezdések
function introBlocks(text) {
  const blocks = [];
  const last = () => blocks[blocks.length - 1];
  (text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    let m;
    if ((m = line.match(FACT))) {
      if (last()?.type !== 'facts') blocks.push({ type: 'facts', items: [] });
      last().items.push({ value: m[1], label: m[2] });
    } else if ((m = line.match(HEADING))) {
      blocks.push({ type: 'heading', text: m[1] });
    } else if ((m = line.match(ITEM))) {
      if (last()?.type !== 'list') blocks.push({ type: 'list', items: [] });
      last().items.push(m[1]);
    } else {
      blocks.push({ type: 'para', text: line });
    }
  });
  return blocks;
}

// Másoláshoz: jelölések nélküli szöveg
export function plainIntro(text) {
  return introBlocks(text).map(b => {
    if (b.type === 'facts') return b.items.map(i => `${i.value} ${i.label}`).join('\n');
    if (b.type === 'heading') return b.text;
    if (b.type === 'list') return b.items.map(i => `– ${i}`).join('\n');
    return b.text;
  }).join('\n\n');
}

export function RichIntro({ text }) {
  return (
    <div className="space-y-3">
      {introBlocks(text).map((b, idx) => {
        if (b.type === 'facts') {
          return (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {b.items.map((f, i) => (
                <div key={i} className="rounded-xl p-3 text-center text-white" style={{ background: i % 2 ? RED : BLUE }}>
                  <div className="text-xl font-bold leading-tight">{f.value}</div>
                  <div className="text-xs mt-1 leading-snug">{f.label}</div>
                </div>
              ))}
            </div>
          );
        }
        if (b.type === 'heading') {
          return <div key={idx} className="club-block text-base font-bold pt-2 border-b-2 pb-1" style={{ color: BLUE, borderColor: '#FCA5A5' }}>{b.text}</div>;
        }
        if (b.type === 'list') {
          return (
            <ul key={idx} className="space-y-1.5">
              {b.items.map((item, i) => {
                const dated = item.match(DATED);
                return dated ? (
                  <li key={i} className="flex gap-3 items-start text-sm text-gray-800">
                    <span className="flex-shrink-0 w-14 text-center rounded-md py-0.5 text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>{dated[1]}</span>
                    <span className="leading-relaxed">{dated[2]}</span>
                  </li>
                ) : (
                  <li key={i} className="flex gap-2 items-start text-sm text-gray-800">
                    <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RED }} />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return <p key={idx} className="text-sm text-gray-800 leading-relaxed">{b.text}</p>;
      })}
    </div>
  );
}
