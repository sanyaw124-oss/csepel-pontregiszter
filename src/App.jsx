import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Trophy, Star, Calendar, Users, Camera, Edit3, ChevronRight, Award,
  Activity, MapPin, User, X, Check, Shield, Trash2, Play, Target,
  ArrowLeft, List, Loader, Upload, Hash, ChevronDown, Plus, AlertCircle,
  FileText, Download, Medal, BarChart3, Crown, Sparkles, Search, Filter,
  ClipboardList, UserPlus, Home, Settings, Eye, TrendingUp, FileDown
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ============================================================================
// MRGSZ ADATMODELL - BESOROLÁSOK, KOROSZTÁLYOK, VERSENYFORMÁK
// ============================================================================

const BESOROLASOK = {
  VSK1: { label: "VSK I",  szin: "#C8102E", text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"    },
  VSK2: { label: "VSK II", szin: "#F59E0B", text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200"  },
  SZK:  { label: "SZK",    szin: "#10B981", text: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200"},
  BNK:  { label: "BNK",    szin: "#64748B", text: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200"  },
};

const KOROSZTALYOK = {
  kisgyermek: { label: "Kisgyermek", sorrend: 1 },
  gyermek:    { label: "Gyermek",    sorrend: 2 },
  serdulo:    { label: "Serdülő",    sorrend: 3 },
  junior:     { label: "Junior",     sorrend: 4 },
  felnott:    { label: "Felnőtt",    sorrend: 5 },
};

const VERSENYFORMAK = {
  egyeni_osszetett: { label: "Egyéni összetett", rovid: "Ö",  emoji: "🤸", leiras: "Egy versenyző, összes szere" },
  szerenkenti:      { label: "Szerenkénti",      rovid: "Sz", emoji: "⭐", leiras: "Szerenkénti helyezés" },
  egyeni_csapat:    { label: "Egyéni csapat",    rovid: "EC", emoji: "🏅", leiras: "2-6 fő, szerenként 2/4 legjobb" },
  ekcs:             { label: "EKCS csapat",      rovid: "EK", emoji: "🎯", leiras: "5+1 fő együtt, 2× gyakorlat" },
  kombinalt:        { label: "Kombinált",        rovid: "K",  emoji: "👑", leiras: "Egyéni csapat + EKCS" },
};

const SZER_META = {
  szabad:   { label: "Szabadgyakorlat", emoji: "✨", szin: "#6366f1", bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
  labda:    { label: "Labda",           emoji: "🔴", szin: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  karika:   { label: "Karika",          emoji: "⭕", szin: "#f43f5e", bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
  buzogany: { label: "Buzogány",        emoji: "🎳", szin: "#f59e0b", bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  szalag:   { label: "Szalag",          emoji: "🎀", szin: "#a855f7", bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
  kotel:    { label: "Kötél",           emoji: "🪢", szin: "#0ea5e9", bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
  valasztott: { label: "Választott szer", emoji: "🏅", szin: "#64748b", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  ekcs_gy1: { label: "EKCS gyak. 1",    emoji: "1️⃣", szin: "#ec4899", bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200" },
  ekcs_gy2: { label: "EKCS gyak. 2",    emoji: "2️⃣", szin: "#8b5cf6", bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
};

// ============================================================================
// MINTAADATOK - CSEPEL RG VERSENYZŐK (MRGSZ modellnek megfelelően)
// ============================================================================

const SZULOK = [
  { id: 1, nev: "Szülő (Völgyesi + Magyar)", gyerek_ids: [1, 12] },
  { id: 2, nev: "Kéri szülő", gyerek_ids: [2] },
];

const CSEPEL_VERSENYZOK = [
  { id: 1,  nev: "Völgyesi Noémi",          szuletesi_ev: 2014, besorolas: "VSK1", korosztaly: "gyermek",    kep: "VN",  edzo: "Kovács Anna", szulo_ids: [1] },
  { id: 2,  nev: "Kéri Milla",              szuletesi_ev: 2017, besorolas: "BNK",  korosztaly: "kisgyermek", kep: "KM",  edzo: "Nagy Rita",   szulo_ids: [2] },
  { id: 3,  nev: "Copek Dorina",            szuletesi_ev: 2016, besorolas: "BNK",  korosztaly: "kisgyermek", kep: "CD",  edzo: "Nagy Rita",   szulo_ids: [] },
  { id: 4,  nev: "Szilvási Kátya",          szuletesi_ev: 2013, besorolas: "VSK1", korosztaly: "serdulo",    kep: "SK",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 5,  nev: "Nagy Enikő",              szuletesi_ev: 2013, besorolas: "VSK1", korosztaly: "serdulo",    kep: "NE",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 6,  nev: "Mihályfalvy Dóra",        szuletesi_ev: 2013, besorolas: "VSK1", korosztaly: "serdulo",    kep: "MD",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 7,  nev: "Dudok Nóra",              szuletesi_ev: 2012, besorolas: "VSK2", korosztaly: "serdulo",    kep: "DN",  edzo: "Nagy Rita",   szulo_ids: [] },
  { id: 8,  nev: "Piller Liza Noa",         szuletesi_ev: 2011, besorolas: "VSK2", korosztaly: "junior",     kep: "PL",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 9,  nev: "Bencsik Csenge",          szuletesi_ev: 2011, besorolas: "VSK2", korosztaly: "junior",     kep: "BC",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 10, nev: "Illés Kiara",             szuletesi_ev: 2007, besorolas: "VSK1", korosztaly: "felnott",    kep: "IK",  edzo: "Nagy Rita",   szulo_ids: [] },
  { id: 11, nev: "Szarka Zoé",              szuletesi_ev: 2014, besorolas: "VSK2", korosztaly: "gyermek",    kep: "SZ",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 12, nev: "Magyar Noémi",            szuletesi_ev: 2014, besorolas: "VSK2", korosztaly: "gyermek",    kep: "MN",  edzo: "Kovács Anna", szulo_ids: [1] },
  { id: 13, nev: "Plausin Katalin",         szuletesi_ev: 2013, besorolas: "VSK2", korosztaly: "serdulo",    kep: "PK",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 14, nev: "Vigh Panna",              szuletesi_ev: 2007, besorolas: "VSK2", korosztaly: "felnott",    kep: "VP",  edzo: "Nagy Rita",   szulo_ids: [] },
  { id: 15, nev: "Majszín Nikolett",        szuletesi_ev: 2008, besorolas: "VSK2", korosztaly: "felnott",    kep: "MN2", edzo: "Nagy Rita",   szulo_ids: [] },
  { id: 16, nev: "Gasparics Mónika Regina", szuletesi_ev: 2011, besorolas: "VSK2", korosztaly: "junior",     kep: "GM",  edzo: "Kovács Anna", szulo_ids: [] },
  { id: 17, nev: "Pintér-Csillag Bora",     szuletesi_ev: 2011, besorolas: "VSK2", korosztaly: "junior",     kep: "PB",  edzo: "Nagy Rita",   szulo_ids: [] },
];

const VERSENYEK = [
  {
    id: 1, nev: "XXVII. Pécs Cup Hungary", helyszin: "Mohács", datum: "2025-10-11",
    tipus: "C", kiiras: "Nemzetközi",
    statusz: "lezart",
  },
  {
    id: 2, nev: "Régiós Bajnokság 2026", helyszin: "Budapest", datum: "2026-04-13",
    tipus: "A", kiiras: "Régiós Bajnokság",
    statusz: "folyamatban",
  },
  {
    id: 3, nev: "Bp. Regionális VSK II", helyszin: "Budapest", datum: "2026-05-15",
    tipus: "A", kiiras: "Régiós",
    statusz: "tervezett",
  },
];

// Nevezések (csepeli versenyzők egy adott versenyen) — valós Bp. kiemelt VSK2 serdülő
const NEVEZESEK_MINTA = [
  { id: 1, verseny_id: 2, versenyzo_id: 13, forma: "egyeni_osszetett", kategoria_kulcs: "VSK2-serdulo", csapat_id: null, rajtszam: 4,  szerek: ["karika","labda"] }, // Plausin Katalin
];

// Külső (nem csepeli) versenyzők — 2026-03-21 Bp. kiemelt VSK2 serdülő startlista
const KULSO_INDULOK = [
  { id: 201, verseny_id: 2, nev: "Medve Nikol",                   klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 1,  szerek: ["karika","labda"] },
  { id: 202, verseny_id: 2, nev: "Nemes Krisztina",               klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 2,  szerek: ["karika","labda"] },
  { id: 203, verseny_id: 2, nev: "Rokonai Szonja Felícia",        klub: "Hegyvidéki Szabadidősport", kategoria_kulcs: "VSK2-serdulo", rajtszam: 3,  szerek: ["karika","labda"] },
  { id: 205, verseny_id: 2, nev: "Mohilchenko Zlata",             klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 5,  szerek: ["karika","labda"] },
  { id: 206, verseny_id: 2, nev: "Dányi Zoé Gabriella",           klub: "Gloriett SE",               kategoria_kulcs: "VSK2-serdulo", rajtszam: 6,  szerek: ["karika","labda"] },
  { id: 207, verseny_id: 2, nev: "Szilágyi Kleopátra",            klub: "Gloriett SE",               kategoria_kulcs: "VSK2-serdulo", rajtszam: 7,  szerek: ["karika","labda"] },
  { id: 208, verseny_id: 2, nev: "Nemes Karolina",                klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 8,  szerek: ["karika","labda"] },
  { id: 209, verseny_id: 2, nev: "Dobolyi Emma",                  klub: "Gloriett SE",               kategoria_kulcs: "VSK2-serdulo", rajtszam: 9,  szerek: ["karika","labda"] },
  { id: 210, verseny_id: 2, nev: "Véssey Lilla Veronika",         klub: "Hegyvidéki Szabadidősport", kategoria_kulcs: "VSK2-serdulo", rajtszam: 10, szerek: ["karika","labda"] },
  { id: 211, verseny_id: 2, nev: "Balogh Enikő Regina",           klub: "ESMTK",                     kategoria_kulcs: "VSK2-serdulo", rajtszam: 11, szerek: ["karika","labda"] },
  { id: 223, verseny_id: 2, nev: "Kovács Karolina",               klub: "Gloriett SE",               kategoria_kulcs: "VSK2-serdulo", rajtszam: 23, szerek: ["karika","labda"] },
  { id: 224, verseny_id: 2, nev: "Kiss-Bódi Lilien",              klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 24, szerek: ["karika","labda"] },
  { id: 225, verseny_id: 2, nev: "Sándor Jázmin Laura",           klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 25, szerek: ["karika","labda"] },
  { id: 226, verseny_id: 2, nev: "Herpai Emerencia",              klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 26, szerek: ["karika","labda"] },
  { id: 227, verseny_id: 2, nev: "Hefelle-Kiss Franciska Johanna",klub: "MTK Budapest",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 27, szerek: ["karika","labda"] },
  { id: 228, verseny_id: 2, nev: "Khudorenko Veronika",           klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 28, szerek: ["karika","labda"] },
  { id: 229, verseny_id: 2, nev: "Horváth-Gulya Jázmin Mia",      klub: "Hegyvidéki Szabadidősport", kategoria_kulcs: "VSK2-serdulo", rajtszam: 29, szerek: ["karika","labda"] },
  { id: 230, verseny_id: 2, nev: "Imre Tünde Anna",               klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 30, szerek: ["karika","labda"] },
  { id: 231, verseny_id: 2, nev: "Szegedi Anna Mària",            klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 31, szerek: ["karika","labda"] },
  { id: 232, verseny_id: 2, nev: "Szabó Kéla",                    klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 32, szerek: ["karika","labda"] },
  { id: 233, verseny_id: 2, nev: "Kovács Nikol Lili",             klub: "Óbuda-Kalász RG TC",        kategoria_kulcs: "VSK2-serdulo", rajtszam: 33, szerek: ["karika","labda"] },
  { id: 234, verseny_id: 2, nev: "Faragó Benedetta Virág",        klub: "RUS RG Sport",              kategoria_kulcs: "VSK2-serdulo", rajtszam: 34, szerek: ["karika","labda"] },
  { id: 235, verseny_id: 2, nev: "Szarka Zoé",                    klub: "Csepeli RG Club",           kategoria_kulcs: "VSK2-serdulo", rajtszam: 35, szerek: ["karika","labda"] },
];

// Mintaeredmények (lezárt verseny: Pécs Cup — hogy legyen mit mutatni az éves összesítéshez)
const EREDMENYEK_MINTA = [
  // Völgyesi Noémi - Pécs Cup - Cat1 Children 2014
  { versenyzo_id: 1, verseny_id: 1, szer: "labda",    D: 5.2,  A: 7.8, E: 7.9, P: 0, ossz: 20.9 },
  { versenyzo_id: 1, verseny_id: 1, szer: "karika",   D: 5.5,  A: 8.0, E: 8.1, P: 0, ossz: 21.6 },
  { versenyzo_id: 1, verseny_id: 1, szer: "buzogany", D: 4.9,  A: 7.7, E: 7.6, P: 0.3, ossz: 19.9 },
  // Magyar Noémi - Pécs Cup - Cat2 Children
  { versenyzo_id: 12, verseny_id: 1, szer: "labda",   D: 4.1,  A: 7.5, E: 7.6, P: 0, ossz: 19.2 },
  { versenyzo_id: 12, verseny_id: 1, szer: "karika",  D: 4.0,  A: 7.4, E: 7.5, P: 0, ossz: 18.9 },
];

// Éremtáblák mintaadata: Völgyesi Noémi 2025-ben 2 arany szeren, 1 ezüst összetettben
const EREM_MINTA = [
  // Pécs Cup 2025
  { versenyzo_id: 1, verseny_id: 1, forma: "szerenkenti", szer: "karika",   helyezes: 1, kategoria: "Cat1 Children 2014" },
  { versenyzo_id: 1, verseny_id: 1, forma: "szerenkenti", szer: "labda",    helyezes: 2, kategoria: "Cat1 Children 2014" },
  { versenyzo_id: 1, verseny_id: 1, forma: "szerenkenti", szer: "buzogany", helyezes: 3, kategoria: "Cat1 Children 2014" },
  { versenyzo_id: 1, verseny_id: 1, forma: "egyeni_osszetett", helyezes: 2, kategoria: "Cat1 Children 2014" },
  { versenyzo_id: 12, verseny_id: 1, forma: "egyeni_osszetett", helyezes: 6, kategoria: "Cat2 Children" },
];

// ============================================================================
// HELPERS
// ============================================================================

const getHelyezesSzin = (h) => {
  if (h === 1) return { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", label: "🥇" };
  if (h === 2) return { bg: "bg-slate-200",  text: "text-slate-700",  border: "border-slate-300",  label: "🥈" };
  if (h === 3) return { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", label: "🥉" };
  return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: `${h}.` };
};

function calcTotal(D, A, E, P) {
  return (parseFloat(D)||0) + (parseFloat(A)||0) + (parseFloat(E)||0) - (parseFloat(P)||0);
}

function kategoriaLabel(kulcs) {
  if (!kulcs) return "—";
  const p = kulcs.split("-");
  const bes = BESOROLASOK[p[0]]?.label || p[0];
  const kor = KOROSZTALYOK[p[1]]?.label || p[1];
  const evf = p[2] === "idos" ? " (idősebb)" : p[2] === "fiatal" ? " (fiatalabb)" : "";
  return `${bes} ${kor}${evf}`;
}

// ============================================================================
// VALIDÁCIÓ (FIG CoP 2025-2028 értékek)
// ============================================================================

// D (Difficulty) nyitott végű, A és E max 10, P tipikusan 0-5
const MEZO_SZABALYOK = {
  D: { min: 0, max: 30, figyelmeztet: 15 },
  A: { min: 0, max: 10, figyelmeztet: null },
  E: { min: 0, max: 10, figyelmeztet: null },
  P: { min: 0, max: 5,  figyelmeztet: 2 },
};

function validalMezo(k, ertek) {
  const s = MEZO_SZABALYOK[k];
  if (!s || ertek === "" || ertek === null || ertek === undefined) return null;
  const n = parseFloat(ertek);
  if (isNaN(n)) return { tipus: "hiba", uzenet: "Nem szám" };
  if (n < s.min) return { tipus: "hiba", uzenet: `Min. ${s.min}` };
  if (n > s.max) return { tipus: "hiba", uzenet: `Max. ${s.max}` };
  if (s.figyelmeztet !== null && n > s.figyelmeztet) return { tipus: "figyelmeztet", uzenet: `${n} magas — biztos?` };
  return { tipus: "ok" };
}

function validalOssz(ertek, max = 60) {
  if (ertek === "" || ertek === null || ertek === undefined) return null;
  const n = parseFloat(ertek);
  if (isNaN(n) || n < 0) return { tipus: "hiba", uzenet: "Érvénytelen" };
  if (n > max) return { tipus: "hiba", uzenet: `Max. ${max}` };
  if (n > max * 0.7) return { tipus: "figyelmeztet", uzenet: `${n} magas` };
  return { tipus: "ok" };
}

// ============================================================================
// AVATAR
// ============================================================================

function Avatar({ v, size = "md", ring = false }) {
  const sizes = {
    xs: "w-6 h-6 text-[9px]",
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-xs",
    lg: "w-14 h-14 text-sm",
    xl: "w-20 h-20 text-xl"
  };
  const initials = v?.kep || v?.nev?.split(" ").map(x => x[0]).join("").slice(0,2) || "?";
  return (
    <div className={`${sizes[size]} rounded-2xl text-white flex items-center justify-center font-black shrink-0 ${ring ? "ring-4 ring-red-200" : ""}`}
      style={{ background: "linear-gradient(135deg,#C8102E,#003DA5)" }}>
      {initials}
    </div>
  );
}

// ============================================================================
// BADGE-EK
// ============================================================================

function BesorolasBadge({ b, size = "md" }) {
  const m = BESOROLASOK[b];
  if (!m) return null;
  const s = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`${s} rounded-md font-black ${m.bg} ${m.text} ${m.border} border`}>
      {m.label}
    </span>
  );
}

function KorosztalyBadge({ k, size = "md" }) {
  const m = KOROSZTALYOK[k];
  if (!m) return null;
  const s = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`${s} rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200`}>
      {m.label}
    </span>
  );
}

function VersenyFormaBadge({ f, size = "md" }) {
  const m = VERSENYFORMAK[f];
  if (!m) return null;
  const s = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`${s} rounded-md font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1`}>
      <span>{m.emoji}</span> {m.rovid}
    </span>
  );
}

// ============================================================================
// STARTLISTA FELTÖLTÉS MODAL (PDF vagy kézi)
// ============================================================================

function StartlistaModal({ verseny, onClose, onSave }) {
  const [mod, setMod] = useState("valaszt"); // "valaszt" | "json" | "kezi"
  const [hiba, setHiba] = useState(null);

  // JSON import state
  const [jsonStr, setJsonStr] = useState("");
  const jsonFileRef = useRef();

  // Kézi bevitel state
  const [kategoriaKulcs, setKategoriaKulcs] = useState("VSK2-serdulo");
  const [szerekStr, setSzerekStr] = useState("karika, labda");
  const [nevekStr, setNevekStr] = useState("");

  async function handleJsonFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      setJsonStr(text);
      setHiba(null);
    } catch (err) {
      setHiba("Nem sikerült beolvasni a fájlt.");
    }
  }

  function handleJsonBetolt() {
    setHiba(null);
    try {
      const parsed = JSON.parse(jsonStr);
      // Elfogadjuk mind { kategoriak: [...] } mind magát a tömböt
      const kategoriak = Array.isArray(parsed) ? parsed : parsed.kategoriak || [];
      if (kategoriak.length === 0) {
        setHiba("A JSON nem tartalmaz kategóriákat.");
        return;
      }
      onSave(kategoriak);
    } catch (err) {
      setHiba("Érvénytelen JSON formátum. Ellenőrizd a szerkezetet.");
    }
  }

  function handleKezi() {
    const szerek = szerekStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const sorok = nevekStr.split("\n").map(s => s.trim()).filter(Boolean);
    const indulok = sorok.map((sor, i) => {
      // Formátum: "1. Név - Klub - 2013" vagy "1. Név - Klub" vagy "Név"
      const parts = sor.split(/\s*[-–]\s*/);
      let rajtszam = i + 1, nev = "", klub = "", szul_ev = null;

      // Első rész: "1. Név" vagy csak "Név"
      const elso = parts[0] || "";
      const rm = elso.match(/^(\d+)\.?\s*(.+)$/);
      if (rm) {
        rajtszam = parseInt(rm[1]) || (i + 1);
        nev = rm[2].trim();
      } else {
        nev = elso.trim();
      }

      // Második rész: klub
      if (parts[1]) klub = parts[1].trim();

      // Harmadik rész: szül.év
      if (parts[2]) {
        const ev = parseInt(parts[2].trim());
        if (ev >= 1990 && ev <= 2025) szul_ev = ev;
      }

      return { rajtszam, nev, klub, szul_ev };
    });
    onSave([{ kategoria_kulcs: kategoriaKulcs, kategoria_label: kategoriaLabel(kategoriaKulcs), szerek, indulok }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              Startlista betöltés
            </div>
            <div className="font-black text-slate-900 text-lg leading-tight">{verseny.nev}</div>
            <div className="text-sm text-slate-500 mt-0.5">{verseny.helyszin} · {verseny.datum}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        {mod === "valaszt" && (
          <div className="p-5 space-y-3">
            <button onClick={() => setMod("json")}
              className="w-full p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-left flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                <FileText size={24} className="text-blue-700"/>
              </div>
              <div>
                <div className="font-black text-slate-900">JSON import</div>
                <div className="text-sm text-slate-500">Beillesztés vagy fájl feltöltés</div>
              </div>
            </button>
            <button onClick={() => setMod("kezi")}
              className="w-full p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition text-left flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Edit3 size={24} className="text-slate-700"/>
              </div>
              <div>
                <div className="font-black text-slate-900">Kézi bevitel</div>
                <div className="text-sm text-slate-500">Egy kategória, soronként egy induló</div>
              </div>
            </button>
          </div>
        )}

        {mod === "json" && (
          <div className="p-5 flex-1 overflow-y-auto space-y-3">
            <input type="file" accept="application/json,.json" ref={jsonFileRef}
              className="hidden" onChange={handleJsonFile}/>
            <button onClick={() => jsonFileRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 font-semibold text-slate-700 flex items-center justify-center gap-2">
              <Upload size={16}/> JSON fájl kiválasztása
            </button>
            <div className="text-center text-xs text-slate-400 font-semibold">— vagy illeszd be —</div>
            <textarea value={jsonStr} onChange={e => setJsonStr(e.target.value)}
              rows={10}
              placeholder='{"kategoriak":[{"kategoria_kulcs":"VSK2-serdulo","szerek":["karika","labda"],"indulok":[...]}]}'
              className="w-full p-3 border border-slate-200 rounded-xl font-mono text-[11px]"/>
            {hiba && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                <div>{hiba}</div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setMod("valaszt"); setHiba(null); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
                ← Vissza
              </button>
              <button onClick={handleJsonBetolt}
                disabled={!jsonStr.trim()}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                Betöltés
              </button>
            </div>
          </div>
        )}

        {mod === "kezi" && (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kategória</label>
              <select value={kategoriaKulcs} onChange={e => setKategoriaKulcs(e.target.value)}
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold text-slate-900">
                <option value="BNK-kisgyermek">BNK Kisgyermek</option>
                <option value="VSK1-gyermek-fiatal">VSK I Gyermek (fiatalabb)</option>
                <option value="VSK1-gyermek-idos">VSK I Gyermek (idősebb)</option>
                <option value="VSK2-gyermek-fiatal">VSK II Gyermek (fiatalabb)</option>
                <option value="VSK2-gyermek-idos">VSK II Gyermek (idősebb)</option>
                <option value="VSK1-serdulo">VSK I Serdülő</option>
                <option value="VSK2-serdulo">VSK II Serdülő</option>
                <option value="VSK1-junior">VSK I Junior</option>
                <option value="VSK2-junior">VSK II Junior</option>
                <option value="SZK-serdulo">SZK Serdülő</option>
                <option value="SZK-junior">SZK Junior</option>
                <option value="VSK1-felnott">VSK I Felnőtt</option>
                <option value="VSK2-felnott">VSK II Felnőtt</option>
                <option value="SZK-felnott">SZK Felnőtt</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Szerek (vesszővel)</label>
              <input type="text" value={szerekStr} onChange={e => setSzerekStr(e.target.value)}
                placeholder="karika, labda, buzogany"
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold"/>
              <div className="text-[11px] text-slate-500 mt-1">karika · labda · buzogany · szalag · kotel · szabad</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Indulók — soronként: <span className="text-slate-900">rajtszám. Név - Klub - szül.év</span>
              </label>
              <textarea value={nevekStr} onChange={e => setNevekStr(e.target.value)}
                rows={8}
                placeholder={"1. Szarka Zoé - Csepeli RG Club - 2014\n2. Horváth Petra - ESMTK - 2013\n3. Kiss Boglárka - Sziluett RGSE - 2013"}
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-mono text-sm"/>
              <div className="text-[11px] text-slate-500 mt-1">
                A szül. év opcionális. A klub is elhagyható.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMod("valaszt")}
                className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
                ← Vissza
              </button>
              <button onClick={handleKezi}
                disabled={!nevekStr.trim()}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                Betöltés
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SZER VÁLASZTÓ (fotós rögzítéshez, ha nem egyértelmű)
// ============================================================================

function SzerValaszto({ szerek, onValaszt, resztvevoNev, adat }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertCircle size={12}/> Szer azonosítása szükséges
          </div>
          <div className="font-black text-slate-900 text-lg leading-tight">{resztvevoNev}</div>
          <div className="text-sm text-slate-500 mt-1">Melyik szeren szerepel?</div>
          {adat?.total > 0 && (
            <div className="mt-2 text-sm font-semibold text-slate-700">
              Kiolvasott pontszám: <span className="text-slate-900 font-black">{adat.total.toFixed(3)}</span>
            </div>
          )}
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {szerek.map(sz => {
            const m = SZER_META[sz] || SZER_META.labda;
            return (
              <button key={sz} onClick={() => onValaszt(sz)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 ${m.border} ${m.bg} hover:brightness-95 active:scale-95 transition`}>
                <span className="text-3xl">{m.emoji}</span>
                <span className={`text-sm font-black ${m.text}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-4 pb-4">
          <button onClick={() => onValaszt(null)}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition">
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EREDMÉNY RÖGZÍTŐ MODAL (D + A + E + P)
// ============================================================================

function EredmenyModal({ indulo, szer, onClose, onSave, meglevo }) {
  const meta = SZER_META[szer] || SZER_META.labda;
  const [mod, setMod] = useState("ossz");
  const [ossz, setOssz] = useState(meglevo?.ossz?.toFixed(3) || "");
  const [reszlet, setReszlet] = useState({
    D: meglevo?.D?.toString() ?? "",
    A: meglevo?.A?.toString() ?? "",
    E: meglevo?.E?.toString() ?? "",
    P: meglevo?.P?.toString() ?? "0",
  });
  const [fotoUrl, setFotoUrl] = useState(null);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoHiba, setFotoHiba] = useState(null);
  const fileRef = useRef();

  const szamoltOssz = useMemo(() => {
    if (!reszlet.D && !reszlet.A && !reszlet.E) return null;
    const t = calcTotal(reszlet.D, reszlet.A, reszlet.E, reszlet.P);
    return isNaN(t) ? null : t;
  }, [reszlet]);

  const vegsoPont = mod === "ossz" ? parseFloat(ossz) : szamoltOssz;

  const validacio = useMemo(() => {
    if (mod === "ossz") {
      const ov = validalOssz(ossz);
      return { ossz: ov, mezok: {}, vanHiba: ov?.tipus === "hiba" };
    }
    const mezok = {};
    let vanHiba = false;
    ["D","A","E","P"].forEach(k => {
      const v = validalMezo(k, reszlet[k]);
      mezok[k] = v;
      if (v?.tipus === "hiba") vanHiba = true;
    });
    const ov = szamoltOssz !== null ? validalOssz(szamoltOssz) : null;
    if (ov?.tipus === "hiba") vanHiba = true;
    return { mezok, ossz: ov, vanHiba };
  }, [mod, ossz, reszlet, szamoltOssz]);

  const menthetoe = !!(vegsoPont && !isNaN(vegsoPont) && vegsoPont > 0 && !validacio.vanHiba);

  function mezoBorder(k) {
    const v = validacio.mezok?.[k];
    if (!v || v.tipus === "ok") return "border-slate-200 focus:border-blue-400";
    return v.tipus === "hiba" ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50";
  }

  async function handleFoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoLoading(true);
    setFotoHiba(null);
    try {
      const url = URL.createObjectURL(f);
      setFotoUrl(url);
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej();
        r.readAsDataURL(f);
      });
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: f.type, data: b64 } },
              { type: "text", text: `Olvasd ki a ritmikus gimnasztika pontlapon szereplő pontszámokat. Válaszolj KIZÁRÓLAG JSON-nel, semmi más:
{"D": 8.5, "A": 7.9, "E": 7.8, "P": 0, "total": 24.2}
Ha valami nem látszik, írj null-t. Ha csak összpontszám látszik, a D/A/E legyen null, csak total.` }
            ]
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.D != null || parsed.A != null || parsed.E != null) {
        setReszlet({
          D: parsed.D?.toString() ?? "",
          A: parsed.A?.toString() ?? "",
          E: parsed.E?.toString() ?? "",
          P: (parsed.P ?? 0).toString(),
        });
        setMod("reszlet");
      } else if (parsed.total) {
        setOssz(parsed.total.toString());
        setMod("ossz");
      }
    } catch (err) {
      setFotoHiba("Nem sikerült kiolvasni. Írd be kézzel.");
    } finally {
      setFotoLoading(false);
    }
  }

  function mentes() {
    if (!menthetoe) return;
    const adat = mod === "ossz"
      ? { ossz: parseFloat(ossz), D: null, A: null, E: null, P: null }
      : { D: parseFloat(reszlet.D)||0, A: parseFloat(reszlet.A)||0, E: parseFloat(reszlet.E)||0, P: parseFloat(reszlet.P)||0, ossz: szamoltOssz };
    onSave(adat);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col">
        <div className={`p-5 ${meta.bg} border-b ${meta.border} flex items-center gap-3`}>
          <div className="text-4xl">{meta.emoji}</div>
          <div className="flex-1">
            <div className={`text-xs font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</div>
            <div className="font-black text-slate-900 text-lg leading-tight">{indulo.nev}</div>
            {indulo.klub && <div className="text-xs text-slate-600 mt-0.5">{indulo.klub}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {/* Fotó gomb */}
          <input type="file" accept="image/*" capture="environment" ref={fileRef}
            className="hidden" onChange={handleFoto}/>
          <button onClick={() => fileRef.current?.click()}
            disabled={fotoLoading}
            className="w-full mb-4 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 font-semibold text-slate-700 flex items-center justify-center gap-2 transition">
            {fotoLoading ? <><Loader size={16} className="animate-spin"/> Olvasás...</> : <><Camera size={16}/> Fotó pontlapról</>}
          </button>
          {fotoHiba && (
            <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {fotoHiba}
            </div>
          )}

          {/* Mód váltó */}
          <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setMod("ossz")}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mod==="ossz" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              Csak összpont
            </button>
            <button onClick={() => setMod("reszlet")}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mod==="reszlet" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              D + A + E + P
            </button>
          </div>

          {mod === "ossz" && (
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Összpontszám</label>
              <input type="number" step="0.001" value={ossz} onChange={e => setOssz(e.target.value)}
                placeholder="pl. 24.250"
                className={`w-full mt-1 p-4 border-2 rounded-xl font-mono text-2xl font-black text-center ${mezoBorder("ossz")}`}/>
              {validacio.ossz?.uzenet && (
                <div className={`mt-1 text-xs font-semibold ${validacio.ossz.tipus==="hiba" ? "text-red-600" : "text-amber-600"}`}>
                  {validacio.ossz.uzenet}
                </div>
              )}
            </div>
          )}

          {mod === "reszlet" && (
            <div className="space-y-3">
              {[
                { k: "D", label: "Difficulty", hint: "DB + DA + R" },
                { k: "A", label: "Artistry",   hint: "10 - levonások" },
                { k: "E", label: "Execution",  hint: "10 - levonások" },
                { k: "P", label: "Penalty",    hint: "Büntetés (-)" },
              ].map(({k,label,hint}) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {k} — {label}
                    </label>
                    <span className="text-[10px] text-slate-400">{hint}</span>
                  </div>
                  <input type="number" step="0.001" value={reszlet[k]}
                    onChange={e => setReszlet(r => ({...r, [k]: e.target.value}))}
                    placeholder="0.000"
                    className={`w-full mt-1 p-3 border-2 rounded-xl font-mono text-lg font-bold ${mezoBorder(k)}`}/>
                  {validacio.mezok[k]?.uzenet && (
                    <div className={`mt-0.5 text-[11px] font-semibold ${validacio.mezok[k].tipus==="hiba" ? "text-red-600" : "text-amber-600"}`}>
                      {validacio.mezok[k].uzenet}
                    </div>
                  )}
                </div>
              ))}
              {szamoltOssz !== null && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">Számolt összpont</div>
                  <div className="text-2xl font-black text-blue-900 font-mono">{szamoltOssz.toFixed(3)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
            Mégse
          </button>
          <button onClick={mentes} disabled={!menthetoe}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT FUNKCIÓK (Excel / CSV - MRGSZ jegyzőkönyv formátumban)
// ============================================================================

function exportCSV(indulokPontokkal, verseny, kategoria, szerek) {
  const BOM = "\uFEFF";
  const sorok = [];
  sorok.push(`Verseny;${verseny.nev};;${verseny.datum};${verseny.helyszin}`);
  sorok.push(`Kategória;${kategoria};;Szerek;${szerek.join(" + ")}`);
  sorok.push("");

  const fej = ["Rajtszám","Név","Klub"];
  szerek.forEach(sz => {
    fej.push(`${SZER_META[sz]?.label || sz} D`);
    fej.push(`${SZER_META[sz]?.label || sz} A`);
    fej.push(`${SZER_META[sz]?.label || sz} E`);
    fej.push(`${SZER_META[sz]?.label || sz} Ossz`);
  });
  fej.push("Összetett");
  fej.push("Helyezés");
  sorok.push(fej.join(";"));

  indulokPontokkal.forEach(r => {
    const sor = [r.rajtszam, r.nev, r.klub || ""];
    szerek.forEach(sz => {
      const e = r.eredmenyek?.[sz];
      sor.push(e?.D?.toFixed(3) || "");
      sor.push(e?.A?.toFixed(3) || "");
      sor.push(e?.E?.toFixed(3) || "");
      sor.push(e?.ossz?.toFixed(3) || "");
    });
    sor.push(r.osszetett?.toFixed(3) || "");
    sor.push(r.helyezes || "");
    sorok.push(sor.map(x => String(x).replace(/;/g,",")).join(";"));
  });

  const blob = new Blob([BOM + sorok.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${verseny.nev}_${kategoria}.csv`.replace(/[^\w.]/g,"_");
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// FŐOLDAL - Csepel versenyzők + verseny lista
// ============================================================================

// ============================================================================
// VERSENY LÉTREHOZÁS / SZERKESZTÉS MODAL
// ============================================================================

function VersenyModal({ verseny, onClose, onSave }) {
  const [nev, setNev] = useState(verseny?.nev || "");
  const [helyszin, setHelyszin] = useState(verseny?.helyszin || "");
  const [datum, setDatum] = useState(verseny?.datum || "");
  const [kiiras, setKiiras] = useState(verseny?.kiiras || "Régiós Bajnokság");
  const [tipus, setTipus] = useState(verseny?.tipus || "A");
  const [forma, setForma] = useState(verseny?.forma || "egyeni");
  const [statusz, setStatusz] = useState(verseny?.statusz || "tervezett");

  const menthet = nev.trim() && helyszin.trim() && datum;

  function mentes() {
    if (!menthet) return;
    onSave({
      id: verseny?.id,
      nev: nev.trim(),
      helyszin: helyszin.trim(),
      datum,
      kiiras,
      tipus,
      forma,
      statusz,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              {verseny?.id ? "Verseny szerkesztése" : "Új verseny"}
            </div>
            <div className="font-black text-slate-900 text-lg">
              {verseny?.id ? verseny.nev : "Add meg az adatokat"}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Verseny neve *</label>
            <input type="text" value={nev} onChange={e => setNev(e.target.value)}
              placeholder="pl. Régiós Bajnokság 2026"
              className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Helyszín *</label>
              <input type="text" value={helyszin} onChange={e => setHelyszin(e.target.value)}
                placeholder="Budapest"
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dátum *</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kiírás</label>
            <select value={kiiras} onChange={e => setKiiras(e.target.value)}
              className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-semibold">
              <option>Magyar Bajnokság</option>
              <option>Régiós Bajnokság</option>
              <option>Magyar Kupa</option>
              <option>Mesterfokú Bajnokság</option>
              <option>Berczik Sára Emlékverseny</option>
              <option>Berczik Sára Emlékkupa</option>
              <option>Ovi-suli Bajnokság</option>
              <option>Diákolimpia</option>
              <option>Nemzetközi</option>
              <option>Egyéb</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Verseny típusa</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { k: "A", cimke: "A típus", leiras: "MRGSZ szervezés" },
                { k: "B", cimke: "B típus", leiras: "Hazai meghívásos" },
                { k: "C", cimke: "C típus", leiras: "Nemzetközi" },
              ].map(t => (
                <button key={t.k} onClick={() => setTipus(t.k)}
                  className={`py-2 rounded-xl font-black text-sm border-2 ${tipus === t.k ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-500"}`}>
                  <div>{t.cimke}</div>
                  <div className="text-[10px] font-semibold opacity-80">{t.leiras}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Versenyforma</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { k: "egyeni",   cimke: "Egyéni",         emoji: "🤸" },
                { k: "egyeni_csapat", cimke: "Egyéni csapat", emoji: "🏅" },
                { k: "ekcs",     cimke: "EKCS csapat",    emoji: "🎯" },
                { k: "vegyes",   cimke: "Vegyes",         emoji: "👑" },
              ].map(f => (
                <button key={f.k} onClick={() => setForma(f.k)}
                  className={`py-2.5 rounded-xl font-black text-sm border-2 flex items-center justify-center gap-1.5 ${forma === f.k ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white border-slate-200 text-slate-500"}`}>
                  <span>{f.emoji}</span>
                  <span>{f.cimke}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Státusz</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { k: "tervezett",   cimke: "Tervezett" },
                { k: "folyamatban", cimke: "Folyamatban" },
                { k: "lezart",      cimke: "Lezárt" },
              ].map(s => (
                <button key={s.k} onClick={() => setStatusz(s.k)}
                  className={`py-2 rounded-xl font-black text-xs border-2 ${statusz === s.k ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-500"}`}>
                  {s.cimke}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
            Mégse
          </button>
          <button onClick={mentes} disabled={!menthet}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
            {verseny?.id ? "Mentés" : "Létrehozás"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fooldal({ versenyzok, versenyek, eredmenyek, ermek, onValasztVersenyzo, onValasztVerseny, onUjVerseny }) {
  const [kereses, setKereses] = useState("");
  const [szuroBes, setSzuroBes] = useState("mind");
  const [szuroKor, setSzuroKor] = useState("mind");

  const szurt = useMemo(() => {
    return versenyzok.filter(v => {
      if (kereses && !v.nev.toLowerCase().includes(kereses.toLowerCase())) return false;
      if (szuroBes !== "mind" && v.besorolas !== szuroBes) return false;
      if (szuroKor !== "mind" && v.korosztaly !== szuroKor) return false;
      return true;
    });
  }, [versenyzok, kereses, szuroBes, szuroKor]);

  const ermSzamlalo = (vid) => {
    const ev = new Date().getFullYear();
    const sajat = ermek.filter(e => e.versenyzo_id === vid);
    return {
      arany: sajat.filter(e => e.helyezes === 1).length,
      ezust: sajat.filter(e => e.helyezes === 2).length,
      bronz: sajat.filter(e => e.helyezes === 3).length,
    };
  };

  const aktivVersenyek = versenyek.filter(v => v.statusz !== "lezart");
  const kozeljov = versenyek.filter(v => v.statusz === "tervezett");

  return (
    <div className="space-y-6">
      {/* Aktív verseny kártya — ha van folyamatban lévő */}
      {aktivVersenyek.filter(v => v.statusz === "folyamatban").map(v => (
        <div key={v.id}
          onClick={() => onValasztVerseny(v)}
          className="p-5 rounded-3xl cursor-pointer active:scale-98 transition"
          style={{
            background: "linear-gradient(135deg,#C8102E 0%,#7A0A1D 100%)",
            boxShadow: "0 20px 40px -10px rgba(200,16,46,0.4)"
          }}>
          <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"/>
            Élő verseny
          </div>
          <div className="text-white font-black text-xl mt-1">{v.nev}</div>
          <div className="text-white/80 text-sm flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1"><MapPin size={12}/>{v.helyszin}</span>
            <span className="flex items-center gap-1"><Calendar size={12}/>{v.datum}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-white/90 text-sm font-semibold">Indítsd a rögzítést</div>
            <ChevronRight size={20} className="text-white"/>
          </div>
        </div>
      ))}

      {/* Közelgő versenyek */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider">Versenyek</div>
          {onUjVerseny && (
            <button onClick={onUjVerseny}
              className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Plus size={12}/> Új verseny
            </button>
          )}
        </div>
        <div className="space-y-2">
          {kozeljov.map(v => (
            <div key={v.id} onClick={() => onValasztVerseny(v)}
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 cursor-pointer flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Calendar size={18} className="text-blue-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-900 text-sm truncate">{v.nev}</div>
                <div className="text-xs text-slate-500">{v.helyszin} · {v.datum}</div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">Tervezett</span>
              <ChevronRight size={18} className="text-slate-400"/>
            </div>
          ))}
          {versenyek.filter(v => v.statusz === "lezart").map(v => (
            <div key={v.id} onClick={() => onValasztVerseny(v)}
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 cursor-pointer flex items-center gap-3 opacity-80">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Trophy size={18} className="text-slate-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-900 text-sm truncate">{v.nev}</div>
                <div className="text-xs text-slate-500">{v.helyszin} · {v.datum}</div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">Lezárt</span>
              <ChevronRight size={18} className="text-slate-400"/>
            </div>
          ))}
          {kozeljov.length === 0 && versenyek.filter(v => v.statusz === "lezart").length === 0 && (
            <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-sm text-slate-500">
              Még nincs verseny. Kattints az „+ Új verseny" gombra.
            </div>
          )}
        </div>
      </div>

      {/* Szűrők */}
      <div className="sticky top-0 z-10 bg-slate-50 -mx-4 px-4 py-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" value={kereses} onChange={e => setKereses(e.target.value)}
            placeholder="Keresés versenyzők között..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm font-semibold"/>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setSzuroBes("mind")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap ${szuroBes==="mind" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            Mind
          </button>
          {Object.keys(BESOROLASOK).map(k => (
            <button key={k} onClick={() => setSzuroBes(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap ${szuroBes===k ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              {BESOROLASOK[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Versenyzők listája */}
      <div>
        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
          Csepel RG versenyzők <span className="text-slate-400">· {szurt.length} fő</span>
        </div>
        <div className="space-y-2">
          {szurt.map(v => {
            const e = ermSzamlalo(v.id);
            return (
              <div key={v.id} onClick={() => onValasztVersenyzo(v)}
                className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-red-200 hover:shadow-sm cursor-pointer flex items-center gap-3 transition">
                <Avatar v={v}/>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-900 text-sm leading-tight truncate">{v.nev}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <BesorolasBadge b={v.besorolas} size="sm"/>
                    <KorosztalyBadge k={v.korosztaly} size="sm"/>
                    <span className="text-[10px] text-slate-400">'{String(v.szuletesi_ev).slice(-2)}</span>
                  </div>
                </div>
                {(e.arany + e.ezust + e.bronz) > 0 && (
                  <div className="flex items-center gap-1 text-xs font-black">
                    {e.arany > 0 && <span title="Arany">🥇{e.arany}</span>}
                    {e.ezust > 0 && <span title="Ezüst">🥈{e.ezust}</span>}
                    {e.bronz > 0 && <span title="Bronz">🥉{e.bronz}</span>}
                  </div>
                )}
                <ChevronRight size={16} className="text-slate-300"/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VERSENY NÉZET - startlista szerenként, élő helyezés, rögzítés
// ============================================================================

function VersenyNezet({ verseny, versenyzok, nevezesek, kulsok, eredmenyek, fokuszId,
  onFokuszValt, onRogzit, onVissza, onStartlistaBetolt, onSzerkeszt, onExport, user }) {

  // Kategóriák ebben a versenyben
  const kategoriak = useMemo(() => {
    const sajat = nevezesek.filter(n => n.verseny_id === verseny.id);
    const kulso = kulsok.filter(k => k.verseny_id === verseny.id);
    const osszes = [...sajat, ...kulso];
    const mapping = new Map();
    osszes.forEach(i => {
      const k = i.kategoria_kulcs;
      if (!mapping.has(k)) {
        mapping.set(k, {
          kulcs: k,
          label: kategoriaLabel(k),
          szerek: i.szerek || [],
          indulok: []
        });
      }
      const g = mapping.get(k);
      if (i.szerek && i.szerek.length > g.szerek.length) g.szerek = i.szerek;
      // versenyző adatok
      const isSajat = !!i.versenyzo_id;
      const vzo = isSajat ? versenyzok.find(v => v.id === i.versenyzo_id) : null;
      g.indulok.push({
        forrasId: i.id,
        rajtszam: i.rajtszam,
        nev: vzo?.nev || i.nev,
        klub: vzo ? "Csepel RG" : i.klub,
        csepel_id: vzo?.id || null,
        csepel: !!vzo,
        szerek: i.szerek || [],
      });
    });
    mapping.forEach(g => g.indulok.sort((a,b) => a.rajtszam - b.rajtszam));
    return Array.from(mapping.values());
  }, [verseny, nevezesek, kulsok, versenyzok]);

  const [aktKategoria, setAktKategoria] = useState(kategoriak[0]?.kulcs || null);
  const [aktSzer, setAktSzer] = useState(null);
  const [nezet, setNezet] = useState("startlista"); // "startlista" | "osszetett"
  const [modal, setModal] = useState(null);
  const [startModal, setStartModal] = useState(false);

  const aktKat = kategoriak.find(k => k.kulcs === aktKategoria);

  useEffect(() => {
    if (aktKat && !aktSzer) setAktSzer(aktKat.szerek[0]);
    if (aktKat && aktSzer && !aktKat.szerek.includes(aktSzer)) setAktSzer(aktKat.szerek[0]);
  }, [aktKat, aktSzer]);

  // Kiválasztott fókusz versenyző
  const fokuszVzo = fokuszId ? versenyzok.find(v => v.id === fokuszId) : null;

  // Eredmény keresés
  const getE = (indulo, szer) => {
    if (indulo.csepel) {
      return eredmenyek.find(e => e.versenyzo_id === indulo.csepel_id && e.verseny_id === verseny.id && e.szer === szer);
    }
    return eredmenyek.find(e => e.kulso_id === indulo.forrasId && e.verseny_id === verseny.id && e.szer === szer);
  };

  // Élő rangsor az aktuális kategóriában és szeren
  const elorangsor = useMemo(() => {
    if (!aktKat || !aktSzer) return [];
    return aktKat.indulok.map(i => {
      const e = getE(i, aktSzer);
      return { ...i, ossz: e?.ossz || null };
    })
    .filter(i => i.ossz !== null)
    .sort((a,b) => b.ossz - a.ossz)
    .map((i, idx) => ({ ...i, helyezes: idx + 1 }));
  }, [aktKat, aktSzer, eredmenyek]);

  // Összetett rangsor (minden szer megvan)
  const osszetettRangsor = useMemo(() => {
    if (!aktKat) return [];
    return aktKat.indulok.map(i => {
      const eredmenyek_sajat = aktKat.szerek.map(sz => getE(i, sz));
      const kesz = eredmenyek_sajat.filter(e => e?.ossz).length;
      const osszetett = eredmenyek_sajat.reduce((s, e) => s + (e?.ossz || 0), 0);
      return { ...i, kesz, osszSzam: aktKat.szerek.length, osszetett, mindenKesz: kesz === aktKat.szerek.length };
    }).sort((a,b) => {
      if (a.mindenKesz && !b.mindenKesz) return -1;
      if (!a.mindenKesz && b.mindenKesz) return 1;
      return b.osszetett - a.osszetett;
    }).map((i, idx) => ({ ...i, helyezes: i.mindenKesz ? idx + 1 : null }));
  }, [aktKat, eredmenyek]);

  const fokuszHelyezes = fokuszVzo && aktSzer
    ? elorangsor.find(r => r.csepel_id === fokuszVzo.id)
    : null;

  const csepeliInduloIds = aktKat?.indulok.filter(i => i.csepel).map(i => i.csepel_id) || [];
  const aktKatCsepeliek = versenyzok.filter(v => csepeliInduloIds.includes(v.id));

  // Export handler
  function kezelExport() {
    if (!aktKat) return;
    const adatok = aktKat.indulok.map(i => {
      const eredmenyek_sajat = {};
      aktKat.szerek.forEach(sz => {
        const e = getE(i, sz);
        if (e) eredmenyek_sajat[sz] = e;
      });
      const osszetett = Object.values(eredmenyek_sajat).reduce((s, e) => s + (e.ossz || 0), 0);
      return { ...i, eredmenyek: eredmenyek_sajat, osszetett };
    }).sort((a,b) => b.osszetett - a.osszetett).map((i, idx) => ({ ...i, helyezes: idx + 1 }));

    exportCSV(adatok, verseny, aktKat.label, aktKat.szerek);
  }

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="flex items-center gap-3">
        <button onClick={onVissza} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={20}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-500 uppercase">{verseny.kiiras}</div>
          <div className="font-black text-slate-900 truncate">{verseny.nev}</div>
        </div>
        <button onClick={kezelExport}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          title="Export CSV">
          <FileDown size={18}/>
        </button>
        {onSzerkeszt && (
          <button onClick={onSzerkeszt}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            title="Verseny szerkesztése">
            <Edit3 size={18}/>
          </button>
        )}
      </div>

      {/* Startlista betöltés gomb (ha üres) */}
      {kategoriak.length === 0 && (
        <div className="p-6 rounded-2xl bg-white border-2 border-dashed border-blue-300 text-center">
          <ClipboardList size={32} className="mx-auto mb-2 text-blue-500"/>
          <div className="font-black text-slate-900 mb-1">Még nincs startlista</div>
          {onStartlistaBetolt ? (
            <>
              <div className="text-sm text-slate-500 mb-4">JSON import vagy kézi bevitel</div>
              <button onClick={() => setStartModal(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">
                Startlista betöltése
              </button>
            </>
          ) : (
            <div className="text-sm text-slate-500">Az edző még nem töltötte be a startlistát.</div>
          )}
        </div>
      )}

      {kategoriak.length > 0 && (
        <>
          {/* Kategória váltó */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {kategoriak.map(k => (
              <button key={k.kulcs} onClick={() => setAktKategoria(k.kulcs)}
                className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap ${aktKategoria===k.kulcs ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                {k.label}
              </button>
            ))}
            {onStartlistaBetolt && (
              <button onClick={() => setStartModal(true)}
                className="px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1">
                <Plus size={12}/> Kategória
              </button>
            )}
          </div>

          {/* Nézet váltó */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setNezet("startlista")}
              className={`flex-1 py-2 rounded-lg text-xs font-black ${nezet==="startlista" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              <List size={14} className="inline mr-1"/> Startlista
            </button>
            <button onClick={() => setNezet("osszetett")}
              className={`flex-1 py-2 rounded-lg text-xs font-black ${nezet==="osszetett" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
              <Trophy size={14} className="inline mr-1"/> Összetett
            </button>
          </div>

          {/* Fókusz versenyző választó (csepeliek) */}
          {aktKatCsepeliek.length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <div className="text-[10px] font-black text-red-600 uppercase tracking-wider mb-1.5">
                Fókuszban
              </div>
              <div className="flex gap-2 flex-wrap">
                {aktKatCsepeliek.map(v => (
                  <button key={v.id} onClick={() => onFokuszValt(v.id === fokuszId ? null : v.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 ${v.id === fokuszId ? "bg-red-600 text-white" : "bg-white border border-red-200 text-red-700"}`}>
                    <Star size={10} className={v.id === fokuszId ? "fill-white" : "fill-red-600"}/>
                    {v.nev.split(" ")[0]}
                  </button>
                ))}
              </div>
              {fokuszVzo && fokuszHelyezes && nezet === "startlista" && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-xs text-red-700">
                    <span className="font-black">{fokuszVzo.nev}</span> — jelenleg{" "}
                    <span className="font-black text-base">{fokuszHelyezes.helyezes}. hely</span>{" "}
                    <span className="font-mono font-bold">({fokuszHelyezes.ossz.toFixed(3)})</span>{" "}
                    {SZER_META[aktSzer]?.emoji} {SZER_META[aktSzer]?.label}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STARTLISTA NÉZET */}
          {nezet === "startlista" && aktKat && (
            <>
              {/* Szer tabok */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {aktKat.szerek.map(sz => {
                  const m = SZER_META[sz] || SZER_META.labda;
                  const kesz = aktKat.indulok.filter(i => !!getE(i, sz)).length;
                  return (
                    <button key={sz} onClick={() => setAktSzer(sz)}
                      className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 ${aktSzer===sz ? `${m.bg} ${m.text} border-2 ${m.border}` : "bg-white border border-slate-200 text-slate-500"}`}>
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-70">{kesz}/{aktKat.indulok.length}</span>
                    </button>
                  );
                })}
              </div>

              {/* Startlista rajtsorrendben */}
              <div className="space-y-1.5">
                {aktKat.indulok.map(i => {
                  const e = getE(i, aktSzer);
                  const rank = elorangsor.find(r => r.rajtszam === i.rajtszam && r.nev === i.nev);
                  const fokusz = fokuszId && i.csepel_id === fokuszId;
                  return (
                    <div key={i.forrasId}
                      className={`p-3 rounded-xl flex items-center gap-3 ${fokusz ? "bg-red-50 border-2 border-red-300" : i.csepel ? "bg-white border border-red-100" : "bg-white border border-slate-200"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${i.csepel ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {i.rajtszam}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 text-sm truncate">{i.nev}</span>
                          {i.csepel && <Star size={11} className="text-red-600 fill-red-600 shrink-0"/>}
                        </div>
                        <div className="text-[11px] text-slate-500">{i.klub}</div>
                      </div>
                      {e ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-mono font-black text-slate-900 text-sm">{e.ossz.toFixed(3)}</div>
                            {rank && (
                              <div className={`text-[10px] font-black ${getHelyezesSzin(rank.helyezes).text}`}>
                                {getHelyezesSzin(rank.helyezes).label}
                              </div>
                            )}
                          </div>
                          {onRogzit && (
                            <button onClick={() => setModal({ indulo: i, szer: aktSzer, meglevo: e })}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                              <Edit3 size={12}/>
                            </button>
                          )}
                        </div>
                      ) : (
                        onRogzit ? (
                          <button onClick={() => setModal({ indulo: i, szer: aktSzer })}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-700">
                            Rögzít
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">még nincs</span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ÖSSZETETT NÉZET */}
          {nezet === "osszetett" && aktKat && (
            <div className="space-y-1.5">
              {osszetettRangsor.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Még nincs rögzített eredmény.
                </div>
              )}
              {osszetettRangsor.map(r => {
                const fokusz = fokuszId && r.csepel_id === fokuszId;
                const sz = r.helyezes ? getHelyezesSzin(r.helyezes) : null;
                return (
                  <div key={r.forrasId}
                    className={`p-3 rounded-xl flex items-center gap-3 ${fokusz ? "bg-red-50 border-2 border-red-300" : "bg-white border border-slate-200"}`}>
                    {r.helyezes ? (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${sz.bg} ${sz.text}`}>
                        {sz.label}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black bg-amber-50 text-amber-700">
                        {r.kesz}/{r.osszSzam}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-sm truncate">{r.nev}</span>
                        {r.csepel && <Star size={11} className="text-red-600 fill-red-600 shrink-0"/>}
                      </div>
                      <div className="text-[11px] text-slate-500">{r.klub}</div>
                    </div>
                    <div className="font-mono font-black text-slate-900">{r.osszetett.toFixed(3)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modal && (
        <EredmenyModal
          indulo={modal.indulo}
          szer={modal.szer}
          meglevo={modal.meglevo}
          onClose={() => setModal(null)}
          onSave={(adat) => {
            onRogzit({
              versenyzo_id: modal.indulo.csepel_id,
              kulso_id: modal.indulo.csepel ? null : modal.indulo.forrasId,
              verseny_id: verseny.id,
              szer: modal.szer,
              ...adat
            });
          }}
        />
      )}

      {startModal && (
        <StartlistaModal verseny={verseny}
          onClose={() => setStartModal(false)}
          onSave={(kategoriak) => {
            onStartlistaBetolt(verseny.id, kategoriak);
            setStartModal(false);
          }}/>
      )}
    </div>
  );
}

// ============================================================================
// VERSENYZŐ PROFIL - éves eredmények, érmek
// ============================================================================

// ============================================================================
// FEJLŐDÉSI GRAFIKON (szerenkénti + összetett idővonal)
// ============================================================================

function FejlodesGrafikon({ versenyAdat, versenyzo }) {
  const [mod, setMod] = useState("szer"); // "szer" | "osszetett"

  // Adat előkészítése: versenyek időrendben, szerenkénti pontok
  const adatok = useMemo(() => {
    return versenyAdat
      .slice()
      .sort((a, b) => a.verseny.datum.localeCompare(b.verseny.datum))
      .map(({ verseny, pontok }) => {
        const pont = { datum: verseny.datum.slice(5), nev: verseny.nev };
        let osszetett = 0;
        pontok.forEach(p => {
          pont[p.szer] = p.ossz;
          osszetett += p.ossz;
        });
        pont.osszetett = osszetett > 0 ? osszetett : null;
        return pont;
      });
  }, [versenyAdat]);

  // Milyen szerek fordulnak elő?
  const hasznaltSzerek = useMemo(() => {
    const set = new Set();
    adatok.forEach(a => {
      Object.keys(a).forEach(k => {
        if (SZER_META[k]) set.add(k);
      });
    });
    return Array.from(set);
  }, [adatok]);

  if (adatok.length < 2) {
    return (
      <div className="p-4 rounded-2xl bg-white border border-slate-200">
        <div className="flex items-center gap-2 text-slate-500">
          <TrendingUp size={16}/>
          <span className="text-xs font-black uppercase tracking-wider">Fejlődés</span>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Legalább 2 verseny kell a grafikonhoz. Jelenleg: {adatok.length}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-600"/>
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">Fejlődés</span>
        </div>
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
          <button onClick={() => setMod("szer")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-black ${mod === "szer" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
            Szerenként
          </button>
          <button onClick={() => setMod("osszetett")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-black ${mod === "osszetett" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
            Összetett
          </button>
        </div>
      </div>

      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={adatok} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
            <XAxis dataKey="datum" tick={{ fontSize: 10, fill: "#64748b" }}/>
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }}/>
            <Tooltip
              contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload;
                return p ? `${p.nev} (${label})` : label;
              }}
            />
            {mod === "szer" ? (
              hasznaltSzerek.map(sz => (
                <Line key={sz} type="monotone" dataKey={sz}
                  name={SZER_META[sz].label}
                  stroke={SZER_META[sz].szin}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: SZER_META[sz].szin }}
                  connectNulls={true}/>
              ))
            ) : (
              <Line type="monotone" dataKey="osszetett" name="Összetett"
                stroke="#C8102E" strokeWidth={3}
                dot={{ r: 5, fill: "#C8102E" }}
                connectNulls={true}/>
            )}
            {mod === "szer" && <Legend iconType="line" wrapperStyle={{ fontSize: 10 }}/>}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// GYORS RÖGZÍTÉS MODAL (visszamenőleges eredmények, versenyző profilból)
// ============================================================================

const SZER_LISTA = ["karika", "labda", "buzogany", "szalag", "kotel", "szabad"];

function GyorsRogzitModal({ versenyzo, versenyek, onClose, onMent }) {
  // 1. Verseny választás
  const [valasztottVersenyId, setValasztottVersenyId] = useState("uj");

  // 2. Új verseny adatok (ha "uj")
  const [ujNev, setUjNev] = useState("");
  const [ujHelyszin, setUjHelyszin] = useState("");
  const [ujDatum, setUjDatum] = useState("");
  const [ujKiiras, setUjKiiras] = useState("Régiós Bajnokság");

  // 3. Kategória (verseny időpontjában, NEM a profil aktuális kategóriája)
  const [kategoriaKulcs, setKategoriaKulcs] = useState(
    `${versenyzo.besorolas}-${versenyzo.korosztaly}`
  );

  // 4. Versenyforma
  const [forma, setForma] = useState("egyeni_osszetett");

  // 5. Szerek + pontok
  const [valasztottSzerek, setValasztottSzerek] = useState(["karika", "labda"]);
  const [pontok, setPontok] = useState({}); // {karika: "21.600", labda: "20.900"}

  // 6. Helyezés szerenként + összetett
  const [helyezesek, setHelyezesek] = useState({}); // {karika: 2, labda: 3, _osszetett: 2}

  function toggleSzer(sz) {
    setValasztottSzerek(prev =>
      prev.includes(sz) ? prev.filter(x => x !== sz) : [...prev, sz]
    );
  }

  const menthet = valasztottSzerek.length > 0 && valasztottSzerek.every(sz => pontok[sz]) &&
    (valasztottVersenyId !== "uj" || (ujNev.trim() && ujHelyszin.trim() && ujDatum));

  function mentes() {
    if (!menthet) return;
    let versenyAdat;
    if (valasztottVersenyId === "uj") {
      versenyAdat = {
        uj: true,
        nev: ujNev.trim(),
        helyszin: ujHelyszin.trim(),
        datum: ujDatum,
        kiiras: ujKiiras,
        tipus: "B",
        forma: "egyeni",
        statusz: "lezart",
      };
    } else {
      versenyAdat = { uj: false, id: parseInt(valasztottVersenyId) };
    }

    const eredmenyLista = valasztottSzerek.map(sz => ({
      szer: sz,
      ossz: parseFloat(pontok[sz]),
      D: null, A: null, E: null, P: null,
    }));

    const ermLista = [];
    valasztottSzerek.forEach(sz => {
      const h = parseInt(helyezesek[sz]);
      if (h && h > 0) {
        ermLista.push({ forma: "szerenkenti", szer: sz, helyezes: h, kategoria: kategoriaLabel(kategoriaKulcs) });
      }
    });
    const ho = parseInt(helyezesek._osszetett);
    if (ho && ho > 0) {
      ermLista.push({ forma: "egyeni_osszetett", helyezes: ho, kategoria: kategoriaLabel(kategoriaKulcs) });
    }

    onMent({
      versenyzo_id: versenyzo.id,
      verseny: versenyAdat,
      kategoria_kulcs: kategoriaKulcs,
      forma,
      eredmenyek: eredmenyLista,
      ermek: ermLista,
    });
  }

  const osszVersenyek = versenyek.filter(v => v.statusz === "lezart" || v.statusz === "folyamatban");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
              Gyors eredmény rögzítés
            </div>
            <div className="font-black text-slate-900 text-lg leading-tight">{versenyzo.nev}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Régebbi verseny pótlása — a verseny-időpontbeli kategóriával
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* 1. VERSENY */}
          <div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
              1. Verseny
            </div>
            <select value={valasztottVersenyId} onChange={e => setValasztottVersenyId(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl font-semibold text-slate-900">
              <option value="uj">➕ Új verseny létrehozása</option>
              {osszVersenyek.map(v => (
                <option key={v.id} value={v.id}>{v.nev} · {v.datum}</option>
              ))}
            </select>

            {valasztottVersenyId === "uj" && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                <input type="text" value={ujNev} onChange={e => setUjNev(e.target.value)}
                  placeholder="Verseny neve *"
                  className="w-full p-2.5 border border-blue-200 rounded-lg font-semibold text-sm"/>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={ujHelyszin} onChange={e => setUjHelyszin(e.target.value)}
                    placeholder="Helyszín *"
                    className="p-2.5 border border-blue-200 rounded-lg font-semibold text-sm"/>
                  <input type="date" value={ujDatum} onChange={e => setUjDatum(e.target.value)}
                    className="p-2.5 border border-blue-200 rounded-lg font-semibold text-sm"/>
                </div>
                <select value={ujKiiras} onChange={e => setUjKiiras(e.target.value)}
                  className="w-full p-2.5 border border-blue-200 rounded-lg font-semibold text-sm">
                  <option>Magyar Bajnokság</option>
                  <option>Régiós Bajnokság</option>
                  <option>Magyar Kupa</option>
                  <option>Mesterfokú Bajnokság</option>
                  <option>Berczik Sára Emlékverseny</option>
                  <option>Berczik Sára Emlékkupa</option>
                  <option>Ovi-suli Bajnokság</option>
                  <option>Diákolimpia</option>
                  <option>Nemzetközi</option>
                  <option>Egyéb</option>
                </select>
              </div>
            )}
          </div>

          {/* 2. KATEGÓRIA AKKORRA */}
          <div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
              2. Kategória a verseny időpontjában
            </div>
            <select value={kategoriaKulcs} onChange={e => setKategoriaKulcs(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl font-semibold text-slate-900">
              <option value="BNK-kisgyermek">BNK Kisgyermek</option>
              <option value="VSK1-gyermek-fiatal">VSK I Gyermek (fiatalabb)</option>
              <option value="VSK1-gyermek-idos">VSK I Gyermek (idősebb)</option>
              <option value="VSK2-gyermek-fiatal">VSK II Gyermek (fiatalabb)</option>
              <option value="VSK2-gyermek-idos">VSK II Gyermek (idősebb)</option>
              <option value="VSK1-serdulo">VSK I Serdülő</option>
              <option value="VSK2-serdulo">VSK II Serdülő</option>
              <option value="SZK-serdulo">SZK Serdülő</option>
              <option value="VSK1-junior">VSK I Junior</option>
              <option value="VSK2-junior">VSK II Junior</option>
              <option value="SZK-junior">SZK Junior</option>
              <option value="VSK1-felnott">VSK I Felnőtt</option>
              <option value="VSK2-felnott">VSK II Felnőtt</option>
              <option value="SZK-felnott">SZK Felnőtt</option>
            </select>
            <div className="text-[11px] text-slate-500 mt-1">
              A versenyző jelenleg: <span className="font-bold">{BESOROLASOK[versenyzo.besorolas]?.label} {KOROSZTALYOK[versenyzo.korosztaly]?.label}</span>
            </div>
          </div>

          {/* 3. SZEREK + PONTOK */}
          <div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
              3. Szerek és pontszámok
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {SZER_LISTA.map(sz => {
                const m = SZER_META[sz];
                const aktiv = valasztottSzerek.includes(sz);
                return (
                  <button key={sz} onClick={() => toggleSzer(sz)}
                    className={`py-2 rounded-xl font-black text-xs border-2 flex items-center justify-center gap-1 ${aktiv ? `${m.bg} ${m.text} ${m.border}` : "bg-white border-slate-200 text-slate-400"}`}>
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
            {valasztottSzerek.length > 0 && (
              <div className="space-y-2">
                {valasztottSzerek.map(sz => {
                  const m = SZER_META[sz];
                  return (
                    <div key={sz} className={`p-2.5 rounded-xl ${m.bg} border ${m.border} flex items-center gap-2`}>
                      <span className="text-lg">{m.emoji}</span>
                      <span className={`font-black text-xs ${m.text} w-20`}>{m.label}</span>
                      <input type="number" step="0.001" value={pontok[sz] || ""}
                        onChange={e => setPontok(p => ({...p, [sz]: e.target.value}))}
                        placeholder="Össz."
                        className="flex-1 p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm bg-white"/>
                      <input type="number" min="1" max="99" value={helyezesek[sz] || ""}
                        onChange={e => setHelyezesek(h => ({...h, [sz]: e.target.value}))}
                        placeholder="Hely."
                        className="w-16 p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm bg-white"/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. ÖSSZETETT HELYEZÉS */}
          <div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
              4. Összetett helyezés <span className="text-slate-400 font-semibold">(opcionális)</span>
            </div>
            <input type="number" min="1" max="99" value={helyezesek._osszetett || ""}
              onChange={e => setHelyezesek(h => ({...h, _osszetett: e.target.value}))}
              placeholder="pl. 2 (második hely)"
              className="w-full p-3 border border-slate-200 rounded-xl font-mono font-bold"/>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
            Mégse
          </button>
          <button onClick={mentes} disabled={!menthet}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
            Rögzítés
          </button>
        </div>
      </div>
    </div>
  );
}

function VersenyzoProfil({ v, versenyek, eredmenyek, ermek, onVissza, onFrissit, onGyorsRogzit }) {
  const [szerkeszt, setSzerkeszt] = useState(false);
  const [editBes, setEditBes] = useState(v.besorolas);
  const [editKor, setEditKor] = useState(v.korosztaly);
  const [editEv, setEditEv]   = useState(v.szuletesi_ev);

  useEffect(() => {
    setEditBes(v.besorolas);
    setEditKor(v.korosztaly);
    setEditEv(v.szuletesi_ev);
  }, [v]);

  function mentes() {
    onFrissit && onFrissit(v.id, { besorolas: editBes, korosztaly: editKor, szuletesi_ev: parseInt(editEv) || v.szuletesi_ev });
    setSzerkeszt(false);
  }

  const sajatErmek = ermek.filter(e => e.versenyzo_id === v.id);
  const ermSum = {
    arany: sajatErmek.filter(e => e.helyezes === 1).length,
    ezust: sajatErmek.filter(e => e.helyezes === 2).length,
    bronz: sajatErmek.filter(e => e.helyezes === 3).length,
    egyeb: sajatErmek.filter(e => e.helyezes > 3).length,
  };

  // Versenyek, ahol versenyzett
  const versenyAdat = versenyek.map(verseny => {
    const vErmek = sajatErmek.filter(e => e.verseny_id === verseny.id);
    const vPontok = eredmenyek.filter(e => e.versenyzo_id === v.id && e.verseny_id === verseny.id);
    return { verseny, ermek: vErmek, pontok: vPontok };
  }).filter(x => x.ermek.length > 0 || x.pontok.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVissza} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={20}/>
        </button>
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 uppercase">Versenyző profil</div>
        </div>
      </div>

      {/* Profil fejléc */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 flex items-center gap-4">
        <Avatar v={v} size="xl"/>
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-900 text-xl leading-tight">{v.nev}</div>
          <div className="text-xs text-slate-500 mt-0.5">{v.szuletesi_ev} · edző: {v.edzo}</div>
          <div className="flex items-center gap-1.5 mt-2">
            <BesorolasBadge b={v.besorolas}/>
            <KorosztalyBadge k={v.korosztaly}/>
          </div>
        </div>
        {onFrissit && (
          <button onClick={() => setSzerkeszt(true)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            title="Besorolás / korosztály módosítása">
            <Edit3 size={16}/>
          </button>
        )}
      </div>

      {/* Szerkesztő modal */}
      {szerkeszt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                  Besorolás módosítása
                </div>
                <div className="font-black text-slate-900 text-lg">{v.nev}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Éves átsoroláshoz (pl. VSK II → VSK I, vagy korosztály váltás)
                </div>
              </div>
              <button onClick={() => setSzerkeszt(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Besorolás</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {Object.keys(BESOROLASOK).map(k => (
                    <button key={k} onClick={() => setEditBes(k)}
                      className={`py-2 rounded-xl font-black text-sm border-2 ${editBes === k ? `${BESOROLASOK[k].bg} ${BESOROLASOK[k].text} ${BESOROLASOK[k].border}` : "bg-white border-slate-200 text-slate-500"}`}>
                      {BESOROLASOK[k].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Korosztály</label>
                <div className="grid grid-cols-5 gap-1.5 mt-1">
                  {Object.keys(KOROSZTALYOK).map(k => (
                    <button key={k} onClick={() => setEditKor(k)}
                      className={`py-2 rounded-xl font-black text-[11px] border-2 ${editKor === k ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-500"}`}>
                      {KOROSZTALYOK[k].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Születési év</label>
                <input type="number" value={editEv} onChange={e => setEditEv(e.target.value)}
                  min="1990" max="2025"
                  className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"/>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setSzerkeszt(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
                Mégse
              </button>
              <button onClick={mentes}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gyors rögzítés gomb */}
      {onGyorsRogzit && (
        <button onClick={onGyorsRogzit}
          className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 shadow-sm">
          <Plus size={18}/>
          Régebbi eredmény hozzáadása
        </button>
      )}

      {/* Éremösszesítő */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 rounded-2xl bg-yellow-50 border border-yellow-200 text-center">
          <div className="text-2xl">🥇</div>
          <div className="text-2xl font-black text-yellow-800 font-mono">{ermSum.arany}</div>
          <div className="text-[10px] font-bold text-yellow-700 uppercase">Arany</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-center">
          <div className="text-2xl">🥈</div>
          <div className="text-2xl font-black text-slate-700 font-mono">{ermSum.ezust}</div>
          <div className="text-[10px] font-bold text-slate-600 uppercase">Ezüst</div>
        </div>
        <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-center">
          <div className="text-2xl">🥉</div>
          <div className="text-2xl font-black text-orange-800 font-mono">{ermSum.bronz}</div>
          <div className="text-[10px] font-bold text-orange-700 uppercase">Bronz</div>
        </div>
        <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
          <div className="text-2xl">📍</div>
          <div className="text-2xl font-black text-blue-800 font-mono">{ermSum.egyeb}</div>
          <div className="text-[10px] font-bold text-blue-700 uppercase">Egyéb</div>
        </div>
      </div>

      {/* Fejlődési grafikon */}
      <FejlodesGrafikon versenyAdat={versenyAdat} versenyzo={v}/>

      {/* Versenyek szerinti bontás */}
      <div>
        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Versenyek</div>
        <div className="space-y-2">
          {versenyAdat.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
              Még nincs versenyeredmény.
            </div>
          )}
          {versenyAdat.map(({verseny, ermek, pontok}) => (
            <div key={verseny.id} className="p-3 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-black text-slate-900 text-sm">{verseny.nev}</div>
                  <div className="text-[11px] text-slate-500">{verseny.datum} · {verseny.helyszin}</div>
                </div>
              </div>
              {ermek.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ermek.map((e, i) => {
                    const sz = getHelyezesSzin(e.helyezes);
                    return (
                      <div key={i} className={`px-2 py-1 rounded-lg text-[11px] font-bold ${sz.bg} ${sz.text} border ${sz.border} inline-flex items-center gap-1`}>
                        <span>{sz.label}</span>
                        {e.szer ? SZER_META[e.szer]?.label : "Összetett"}
                      </div>
                    );
                  })}
                </div>
              )}
              {pontok.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {pontok.map((p, i) => (
                    <div key={i} className="p-1.5 rounded-lg bg-slate-50 text-center">
                      <div className="text-[10px] text-slate-500">{SZER_META[p.szer]?.label}</div>
                      <div className="font-mono font-black text-slate-900 text-xs">{p.ossz.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FŐ KOMPONENS
// ============================================================================

// ============================================================================
// BELÉPÉS (edző / szülő szerepkör választás)
// ============================================================================

function LoginScreen({ versenyzok, szulok, onBelep }) {
  const [szerepValaszt, setSzerepValaszt] = useState(null); // null | "edzo" | "szulo"

  const edzok = useMemo(() => {
    const set = new Set();
    versenyzok.forEach(v => v.edzo && set.add(v.edzo));
    return Array.from(set);
  }, [versenyzok]);

  function belepEdzo(nev) {
    onBelep({ tipus: "edzo", nev });
  }
  function belepSzulo(szulo) {
    onBelep({ tipus: "szulo", szulo_id: szulo.id, nev: szulo.nev, gyerek_ids: szulo.gyerek_ids });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&display=swap');
        * { font-family: 'Space Grotesk', system-ui, sans-serif; }
      `}</style>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-white font-black text-3xl mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg,#C8102E,#003DA5)" }}>
            C
          </div>
          <div className="font-black text-white text-2xl">Csepel RG Pontregiszter</div>
          <div className="text-slate-400 text-sm mt-1 font-semibold">Válassz profilt a folytatáshoz</div>
        </div>

        {!szerepValaszt && (
          <div className="space-y-3">
            <button onClick={() => setSzerepValaszt("edzo")}
              className="w-full p-5 rounded-3xl bg-white hover:bg-slate-50 text-left flex items-center gap-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#C8102E,#003DA5)" }}>
                <Shield size={24} className="text-white"/>
              </div>
              <div className="flex-1">
                <div className="font-black text-slate-900 text-lg">Edző vagyok</div>
                <div className="text-sm text-slate-500">Teljes hozzáférés, mindent láthatok és rögzíthetek</div>
              </div>
              <ChevronRight className="text-slate-400"/>
            </button>

            <button onClick={() => setSzerepValaszt("szulo")}
              className="w-full p-5 rounded-3xl bg-white hover:bg-slate-50 text-left flex items-center gap-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600">
                <Users size={24} className="text-white"/>
              </div>
              <div className="flex-1">
                <div className="font-black text-slate-900 text-lg">Szülő vagyok</div>
                <div className="text-sm text-slate-500">Saját gyerek eredményei, verseny követése</div>
              </div>
              <ChevronRight className="text-slate-400"/>
            </button>
          </div>
        )}

        {szerepValaszt === "edzo" && (
          <div className="space-y-3">
            <button onClick={() => setSzerepValaszt(null)}
              className="text-slate-400 text-sm font-semibold flex items-center gap-1 hover:text-white">
              <ArrowLeft size={14}/> Vissza
            </button>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mt-4 mb-2">Válassz edzőt</div>
            {edzok.map(nev => {
              const sajat = versenyzok.filter(v => v.edzo === nev);
              return (
                <button key={nev} onClick={() => belepEdzo(nev)}
                  className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 text-left flex items-center gap-3 shadow-xl">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white"
                    style={{ background: "linear-gradient(135deg,#C8102E,#003DA5)" }}>
                    {nev.split(" ").map(x => x[0]).join("").slice(0,2)}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-slate-900">{nev}</div>
                    <div className="text-xs text-slate-500">{sajat.length} versenyző</div>
                  </div>
                  <ChevronRight className="text-slate-400"/>
                </button>
              );
            })}
          </div>
        )}

        {szerepValaszt === "szulo" && (
          <div className="space-y-3">
            <button onClick={() => setSzerepValaszt(null)}
              className="text-slate-400 text-sm font-semibold flex items-center gap-1 hover:text-white">
              <ArrowLeft size={14}/> Vissza
            </button>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mt-4 mb-2">Válassz családot</div>
            {szulok.map(sz => {
              const gyerekek = sz.gyerek_ids.map(gid => versenyzok.find(v => v.id === gid)).filter(Boolean);
              return (
                <button key={sz.id} onClick={() => belepSzulo(sz)}
                  className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 text-left flex items-center gap-3 shadow-xl">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white bg-gradient-to-br from-amber-500 to-orange-600">
                    {sz.nev.split(" ").map(x => x[0]).join("").slice(0,2)}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-slate-900 text-sm">{sz.nev}</div>
                    <div className="text-xs text-slate-500">
                      {gyerekek.map(g => g.nev.split(" ")[0]).join(", ")}
                    </div>
                  </div>
                  <ChevronRight className="text-slate-400"/>
                </button>
              );
            })}
            {szulok.length === 0 && (
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 text-center text-sm text-slate-300">
                Még nincs rögzített szülői fiók.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PontRegiszter() {
  // Állapot
  const [versenyzok, setVersenyzok] = useState(CSEPEL_VERSENYZOK);
  const [versenyek, setVersenyek] = useState(VERSENYEK);
  const [nevezesek, setNevezesek] = useState(NEVEZESEK_MINTA);
  const [kulsok, setKulsok] = useState(KULSO_INDULOK);
  const [eredmenyek, setEredmenyek] = useState(EREDMENYEK_MINTA);
  const [ermek, setErmek] = useState(EREM_MINTA);

  // Belépett felhasználó (edző vagy szülő)
  const [user, setUser] = useState(null);

  // Navigáció
  const [nezet, setNezet] = useState("fooldal"); // fooldal | verseny | profil
  const [aktVerseny, setAktVerseny] = useState(null);
  const [aktVersenyzo, setAktVersenyzo] = useState(null);
  const [fokuszId, setFokuszId] = useState(1); // alapból Völgyesi Noémi
  const [versenyModal, setVersenyModal] = useState(null); // null | {} | {...verseny}
  const [gyorsRogzitVzo, setGyorsRogzitVzo] = useState(null);

  // Gyors rögzítés (visszamenőleges eredmények)
  function kezelGyorsRogzit(adat) {
    let verseny_id;
    if (adat.verseny.uj) {
      // Új verseny létrehozása
      const ujId = Math.max(0, ...versenyek.map(v => v.id)) + 1;
      verseny_id = ujId;
      setVersenyek(prev => [...prev, { ...adat.verseny, id: ujId }]);
    } else {
      verseny_id = adat.verseny.id;
    }

    // Eredmények mentése
    const ujEredmenyek = adat.eredmenyek.map(e => ({
      versenyzo_id: adat.versenyzo_id,
      verseny_id,
      szer: e.szer,
      ossz: e.ossz,
      D: e.D, A: e.A, E: e.E, P: e.P,
    }));
    setEredmenyek(prev => {
      // duplikátumok kiszűrése (ugyanaz a versenyző + verseny + szer → felülírás)
      const filtered = prev.filter(p =>
        !(p.versenyzo_id === adat.versenyzo_id && p.verseny_id === verseny_id
          && ujEredmenyek.some(u => u.szer === p.szer))
      );
      return [...filtered, ...ujEredmenyek];
    });

    // Érmek mentése
    const ujErmek = adat.ermek.map(e => ({
      versenyzo_id: adat.versenyzo_id,
      verseny_id,
      forma: e.forma,
      szer: e.szer,
      helyezes: e.helyezes,
      kategoria: e.kategoria,
    }));
    setErmek(prev => {
      const filtered = prev.filter(p =>
        !(p.versenyzo_id === adat.versenyzo_id && p.verseny_id === verseny_id
          && ujErmek.some(u => u.forma === p.forma && u.szer === p.szer))
      );
      return [...filtered, ...ujErmek];
    });

    setGyorsRogzitVzo(null);
  }

  function mentVerseny(adat) {
    if (adat.id) {
      setVersenyek(prev => prev.map(v => v.id === adat.id ? { ...v, ...adat } : v));
      if (aktVerseny?.id === adat.id) setAktVerseny({ ...aktVerseny, ...adat });
    } else {
      const ujId = Math.max(0, ...versenyek.map(v => v.id)) + 1;
      const uj = { ...adat, id: ujId };
      setVersenyek(prev => [...prev, uj]);
    }
    setVersenyModal(null);
  }

  // Rögzítés kezelő
  function rogzitEredmeny(adat) {
    setEredmenyek(prev => {
      const idx = prev.findIndex(e => {
        if (e.verseny_id !== adat.verseny_id || e.szer !== adat.szer) return false;
        if (adat.versenyzo_id) return e.versenyzo_id === adat.versenyzo_id;
        return e.kulso_id === adat.kulso_id;
      });
      if (idx >= 0) {
        const masolat = [...prev];
        masolat[idx] = { ...masolat[idx], ...adat };
        return masolat;
      }
      return [...prev, adat];
    });
  }

  // Startlista betöltés (PDF vagy kézi eredménye)
  function startlistaBetolt(verseny_id, kategoriak) {
    let maxId = Math.max(0, ...kulsok.map(k => k.id), ...nevezesek.map(n => n.id));
    const ujKulsok = [];
    const ujNevezesek = [];

    kategoriak.forEach(kat => {
      const kulcs = kat.kategoria_kulcs || gyartKategoriaKulcs(kat.kategoria);
      kat.indulok.forEach(i => {
        maxId++;
        // Ha Csepel RG klub → csepeli, egyébként külső
        const csepeli = versenyzok.find(v =>
          v.nev.toLowerCase() === i.nev.toLowerCase() ||
          (i.klub || "").toLowerCase().includes("csepel")
        );
        if (csepeli && (i.klub || "").toLowerCase().includes("csepel")) {
          ujNevezesek.push({
            id: maxId, verseny_id, versenyzo_id: csepeli.id,
            forma: "egyeni_osszetett", kategoria_kulcs: kulcs,
            csapat_id: null, rajtszam: i.rajtszam,
            szerek: kat.szerek
          });
        } else {
          ujKulsok.push({
            id: maxId, verseny_id, nev: i.nev, klub: i.klub || "",
            kategoria_kulcs: kulcs, rajtszam: i.rajtszam,
            szerek: kat.szerek
          });
        }
      });
    });

    setKulsok(prev => [...prev, ...ujKulsok]);
    setNevezesek(prev => [...prev, ...ujNevezesek]);
  }

  function gyartKategoriaKulcs(cimke) {
    // Próbál felismerni a Vision API válaszából
    const s = (cimke || "").toLowerCase();
    const bes = s.includes("vsk i") && !s.includes("ii") ? "VSK1"
              : s.includes("vsk ii") || s.includes("vsk2") ? "VSK2"
              : s.includes("szk") ? "SZK" : "BNK";
    const kor = s.includes("kisgyermek") ? "kisgyermek"
              : s.includes("gyermek") ? "gyermek"
              : s.includes("serdülő") || s.includes("serdulo") ? "serdulo"
              : s.includes("junior") ? "junior"
              : s.includes("felnőtt") || s.includes("felnott") ? "felnott" : "gyermek";
    const evf = s.includes("idős") || s.includes("idos") ? "-idos"
              : s.includes("fiatal") ? "-fiatal" : "";
    return `${bes}-${kor}${evf}`;
  }

  // Ha nincs bejelentkezve, login képernyő
  if (!user) {
    return (
      <LoginScreen versenyzok={versenyzok} szulok={SZULOK} onBelep={setUser}/>
    );
  }

  // Szülői nézetben kiszűrt versenyzők a főoldalra (saját gyerekek)
  const lathato_versenyzok = user.tipus === "szulo"
    ? versenyzok.filter(v => user.gyerek_ids?.includes(v.id))
    : versenyzok;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&display=swap');
        * { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .active\\:scale-98:active { transform: scale(0.98); }
      `}</style>

      {/* Fix fejléc */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm"
            style={{ background: user.tipus === "szulo" ? "linear-gradient(135deg,#f59e0b,#ea580c)" : "linear-gradient(135deg,#C8102E,#003DA5)" }}>
            {user.tipus === "szulo" ? user.nev.split(" ").map(x=>x[0]).join("").slice(0,2) : "C"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-slate-900 text-sm leading-tight truncate">
              {user.tipus === "edzo" ? user.nev : user.nev}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded ${user.tipus === "edzo" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"} font-black text-[9px]`}>
                {user.tipus === "edzo" ? "EDZŐ" : "SZÜLŐ"}
              </span>
              <span>· v0.7</span>
            </div>
          </div>
          <button onClick={() => { setUser(null); setNezet("fooldal"); setAktVerseny(null); setAktVersenyzo(null); }}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Kilépés">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* Fő tartalom */}
      <div className="max-w-xl mx-auto px-4 py-5 pb-20">
        {nezet === "fooldal" && (
          <Fooldal
            versenyzok={lathato_versenyzok}
            versenyek={versenyek}
            eredmenyek={eredmenyek}
            ermek={ermek}
            onValasztVersenyzo={(v) => { setAktVersenyzo(v); setNezet("profil"); }}
            onValasztVerseny={(v) => { setAktVerseny(v); setNezet("verseny"); }}
            onUjVerseny={user.tipus === "edzo" ? () => setVersenyModal({}) : null}
          />
        )}

        {nezet === "verseny" && aktVerseny && (
          <VersenyNezet
            verseny={aktVerseny}
            versenyzok={versenyzok}
            nevezesek={nevezesek}
            kulsok={kulsok}
            eredmenyek={eredmenyek}
            fokuszId={user.tipus === "szulo" ? (user.gyerek_ids?.[0] || fokuszId) : fokuszId}
            onFokuszValt={setFokuszId}
            onRogzit={user.tipus === "edzo" ? rogzitEredmeny : null}
            onVissza={() => { setAktVerseny(null); setNezet("fooldal"); }}
            onStartlistaBetolt={user.tipus === "edzo" ? startlistaBetolt : null}
            onSzerkeszt={user.tipus === "edzo" ? () => setVersenyModal(aktVerseny) : null}
            onExport={() => {}}
            user={user}
          />
        )}

        {nezet === "profil" && aktVersenyzo && (
          <VersenyzoProfil
            v={versenyzok.find(x => x.id === aktVersenyzo.id) || aktVersenyzo}
            versenyek={versenyek}
            eredmenyek={eredmenyek}
            ermek={ermek}
            onVissza={() => { setAktVersenyzo(null); setNezet("fooldal"); }}
            onFrissit={user.tipus === "edzo" ? (id, adat) => {
              setVersenyzok(prev => prev.map(v => v.id === id ? { ...v, ...adat } : v));
            } : null}
            onGyorsRogzit={user.tipus === "edzo" ? () => setGyorsRogzitVzo(
              versenyzok.find(x => x.id === aktVersenyzo.id) || aktVersenyzo
            ) : null}
          />
        )}
      </div>

      {/* Verseny létrehozás / szerkesztés modal */}
      {versenyModal !== null && (
        <VersenyModal
          verseny={versenyModal.id ? versenyModal : null}
          onClose={() => setVersenyModal(null)}
          onSave={mentVerseny}
        />
      )}

      {/* Gyors rögzítés modal */}
      {gyorsRogzitVzo && (
        <GyorsRogzitModal
          versenyzo={gyorsRogzitVzo}
          versenyek={versenyek}
          onClose={() => setGyorsRogzitVzo(null)}
          onMent={kezelGyorsRogzit}
        />
      )}
    </div>
  );
}
