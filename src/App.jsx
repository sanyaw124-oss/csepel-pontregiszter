import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Calendar, Settings, LogOut, User,
  Check, AlertCircle, Eye, EyeOff,
  Shield, Crown, Award, BookOpen, Heart, Star, Trophy, ArrowLeft, ChevronRight, MessageCircle, Lock,
  BarChart3, Loader, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { CSEPEL_SC_LOGO, CSEPEL_RG_LOGO } from './logos';
import { AdminView, CompetitorsView as CompetitorsViewComponent, ParentProfileView } from './admin';
import { CompetitionsView } from './competitions';
import { TrainingView } from './training';
import { EventsView, UpcomingEventsWidget } from './events';
import { CoachNotesView } from './coach-notes';
import MySelfBlock from './competitor-dashboard';
import CompetitorProfileView from './competitor-profile';
import CompetitorTreasureView from './competitor-treasure';
import { formatCompetitorName, HU_COLLATOR, huSortByNickname } from './names';
import { usePridePhotoUrl } from './pridePhoto';

// ═══════════════════════════════════════════════════════════════════
// SUPABASE KLIENS
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://rujshnadnolvvrtkfbvd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UXpW2tHx49xChYR6nhtGkA_7SKCgUcM';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // 🎯 v0.9.48: lock no-op. A gotrue-js Web Lock-ja ("Lock not released
    // within 5000ms") régi tárolt token mellett 5s+-ig akadt, ettől a
    // profil-query 10s-ig timeout-olt, retry × 3 ≈ 21s belépés (inkognitóban
    // nincs régi token → nincs lock-harc → gyors volt). A lock-ot azonnal
    // feloldó függvénnyel felülírjuk: a fn() rögtön lefut, nincs várakozás.
    // Trade-off: több egyidejű tab esetén elvi token-refresh race, de a klub
    // use-case-ében (egy tab) ez nem reális kockázat.
    lock: async (name, acquireTimeout, fn) => await fn()
  }
});

// ═══════════════════════════════════════════════════════════════════
// KLUB SZÍNPALETTA
// ═══════════════════════════════════════════════════════════════════

const COLORS = {
  blue: '#1e3a8a',         // sötét tengerészkék (Csepel kék)
  blueDark: '#0c1e4a',     // mélykék (szöveg)
  blueLight: '#3b82f6',    // világoskék
  blueBg: '#eff6ff',       // halvány kék háttér
  red: '#dc2626',          // élénk piros (Csepel piros)
  redDark: '#991b1b',      // sötétpiros
  redLight: '#fee2e2',     // halvány piros háttér (csepeli kiemelés)
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827'
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const ROLES = {
  ADMIN: 'admin',
  SZULO_ADMIN: 'szulo_admin',
  VEZETOEDZO: 'vezetoedzo',
  EDZO: 'edzo',
  SEGEDEDZO: 'segededzo',
  SZULO: 'szulo',
  VERSENYZO: 'versenyzo'
};

const ROLE_LABELS = {
  admin: 'Admin',
  szulo_admin: 'Szülő-admin',
  vezetoedzo: 'Vezetőedző',
  edzo: 'Edző',
  segededzo: 'Segédedző',
  szulo: 'Szülő',
  versenyzo: 'Versenyző'
};

const ROLE_ICONS = {
  admin: Shield,
  szulo_admin: Shield,
  vezetoedzo: Crown,
  edzo: Award,
  segededzo: BookOpen,
  szulo: Heart,
  versenyzo: Star
};

// Helper: van-e admin jogosultsága a usernek?
const hasAdminRights = (role) =>
  ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(role);

// Helper: van-e edzői jogosultsága? (admin, szulo_admin, vagy bármely edző szerep)
const hasStaffRights = (role) => 
  ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(role);

// Helper: szülő-jogosultság (látja a saját gyerekét)
const hasParentRights = (role) => role === 'szulo' || role === 'szulo_admin';

// ═══════════════════════════════════════════════════════════════════
// MAGYAR ABC RENDEZÉS HELPER-ek
// v0.9.37: korábban a .order('full_name') PostgreSQL byte-szintű
// rendezést használt, ami magyar betűknél (ő, ű, á, é) ROSSZ sorrendet adott.
// Mindenhol localeCompare('hu')-t kell használni.
// Becenév-elsődlegesség: ha van becenév, az alapján rendezünk, különben a full_name alapján.
// ═══════════════════════════════════════════════════════════════════

// v0.9.49: a közös HU_COLLATOR / huSortByNickname / névformázás a names.js-ben

// Verseny-besorolás kódjának egységesítése: a versenyek modulja 'mrgsz_reg' / 'klub'
// kódot ír, az áttekintő statisztika 'mrgsz_regional' / 'club' kulccsal számol (v0.9.49)
const normImportance = (imp) => (imp === 'mrgsz_reg' ? 'mrgsz_regional' : imp === 'klub' ? 'club' : imp);

// Csepeli-e a csapat? Ugyanaz a szabály, mint a versenyek modul CsepeliTeamResultsSection-jében
const isCsepeliTeamName = (name) => (name || '').toLowerCase().includes('csepel');

// Magyar abc sortolás full_name szerint
const huSortByName = (a, b) => HU_COLLATOR.compare(a?.full_name || '', b?.full_name || '');

// Exportáljuk hogy más fájlok is használhassák
export { HU_COLLATOR, huSortByName, huSortByNickname };

// ═══════════════════════════════════════════════════════════════════
// AUTH HOOK
// ═══════════════════════════════════════════════════════════════════

// 🔬 MÉRÉSI HELPER (v0.9.42-MÉRÉS) - globális időbélyeg, oldalbetöltéskor indul
const __MEASURE_START = Date.now();
const M = (msg) => {
  const t = Date.now() - __MEASURE_START;
  console.log(`[T+${t}ms] ${msg}`);
};

function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    M(`🟡 loadProfile START userId=${userId?.slice(0,8)}`);
    // v0.9.37: korábban 5s timeout volt + nincs retry, ezért időnként 
    // (különösen mobil hálózaton) hibára futott. Most: 10s timeout + 1 retry.
    // Supabase lock-warning ("Lock not released within 5000ms") jelezheti, 
    // hogy a token refresh zavar a párhuzamos query-vel.
    const fetchWithTimeout = async (timeoutMs) => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`timeout (${timeoutMs / 1000}s)`)), timeoutMs)
      );
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return Promise.race([queryPromise, timeoutPromise]);
    };

    try {
      let result;
      try {
        M(`  ⏳ loadProfile query #1 START`);
        // 1. próbálkozás: 10s timeout
        result = await fetchWithTimeout(10000);
        M(`  ✅ loadProfile query #1 OK`);
      } catch (firstErr) {
        // ha timeout vagy hálózati hiba, várunk 500ms-t és retry
        M(`  ❌ loadProfile query #1 FAIL: ${firstErr.message}`);
        console.warn('Profil 1. próbálkozás sikertelen, retry...', firstErr.message);
        await new Promise(r => setTimeout(r, 500));
        M(`  ⏳ loadProfile query #2 START (retry)`);
        result = await fetchWithTimeout(10000);
        M(`  ✅ loadProfile query #2 OK`);
      }

      const { data, error } = result;
      if (error) throw error;
      setProfile(data);
      setError(null);
      M(`🟢 loadProfile DONE (setProfile called)`);
    } catch (err) {
      M(`🔴 loadProfile FINAL FAIL: ${err.message}`);
      console.error('Profil betöltési hiba:', err);
      setError('A profil betöltése nem sikerült. Próbáld a Frissítés gombot, vagy várj egy kis ideig és tölts újra. (Részletek: ' + err.message + ')');
    }
  }, []);

  useEffect(() => {
    M(`🔵 useEffect MOUNT (subscribe to onAuthStateChange)`);
    let mounted = true;
    let eventCount = 0;
    // 🎯 v0.9.43: utoljára betöltött userId nyomon követése, hogy ne fusson
    // dupla loadProfile ugyanarra a user-re (mért: 3-4 párhuzamos query → lock konkurencia)
    let loadedUserId = null;

    // Csak az onAuthStateChange-t használjuk - az INITIAL_SESSION event-et 
    // is meghívja, így nincs lock-konkurencia két párhuzamos auth hívással.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        eventCount++;
        M(`📡 onAuthStateChange #${eventCount} event=${event} hasSession=${!!currentSession}`);
        if (!mounted) {
          M(`  ⏭️  skipped (unmounted)`);
          return;
        }
        
        setSession(currentSession);
        const newUserId = currentSession?.user?.id || null;
        
        // 🎯 SIGNED_OUT: profil törlése
        if (event === 'SIGNED_OUT' || !newUserId) {
          setProfile(null);
          loadedUserId = null;
          M(`  🚪 signed out / no session → setProfile(null)`);
        }
        // 🎯 Csak ÚJ user esetén tölt profilt (nem ugyanarra a userre 3x)
        else if (newUserId !== loadedUserId) {
          M(`  🆕 new user → loadProfile (prev=${loadedUserId?.slice(0,8) || 'null'})`);
          loadedUserId = newUserId;
          await loadProfile(newUserId);
        }
        // 🎯 TOKEN_REFRESHED, INITIAL_SESSION ugyanarra a userre: skip
        else {
          M(`  ⏭️  same user (${newUserId.slice(0,8)}), event=${event} → skip loadProfile`);
        }
        
        // Loading kikapcsolása az első event után
        if (mounted) setLoading(false);
        M(`📡 onAuthStateChange #${eventCount} DONE`);
      }
    );

    // Biztonsági timeout: ha 5 másodpercen belül nem érkezett auth event,
    // AKTÍVAN lekérjük a sessiont (getSession), mielőtt login képernyőt mutatnánk.
    // 🎯 v0.9.53: lejárt access token + érvényes refresh token esetén a gotrue-nak
    // előbb refresh-elnie kell, mire INITIAL_SESSION event jön — ez tovább tarthat
    // mint a timeout, ezért korábban hibásan login képernyő villant fel ("F5 kell").
    // Most a timeout lejártakor explicit getSession() kikényszeríti a refresh-t.
    // A v0.9.48 lock no-op miatt a getSession már nem okoz lock-konkurenciát.
    // Ha getSession ad sessiont → helyreáll; ha nem → login (mint eddig).
    const safetyTimeout = setTimeout(async () => {
      if (!mounted) return;
      M(`⏰ safetyTimeout fired (5s) - getSession fallback`);
      try {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (fallbackSession?.user?.id) {
          M(`  ✅ getSession recovered session (${fallbackSession.user.id.slice(0,8)})`);
          setSession(fallbackSession);
          if (fallbackSession.user.id !== loadedUserId) {
            loadedUserId = fallbackSession.user.id;
            await loadProfile(fallbackSession.user.id);
          }
        } else {
          M(`  ⚪ getSession: nincs session → login`);
        }
      } catch (err) {
        M(`  🔴 getSession fallback FAIL: ${err.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 5000);

    // ÚJ: Visibility change figyelés - telefon-lezárás / háttér után
    // Amikor visszatér az oldal a háttérből, újratöltjük a profilt.
    // FONTOS: NEM hívunk getSession()-t, mert az lock-konkurenciát okoz!
    // A Supabase saját onAuthStateChange-je magától refresh-eli a sessiont.
    let lastVisibilityRefresh = Date.now();
    let visibilityCount = 0;
    const handleVisibilityChange = async () => {
      visibilityCount++;
      M(`👁️  visibilitychange #${visibilityCount} state=${document.visibilityState}`);
      if (!mounted) return;
      if (document.visibilityState === 'visible') {
        // Csak akkor frissítünk ha legalább 30 másodperc telt el
        // (elkerüljük hogy gyors váltogatáskor sok query menjen)
        const now = Date.now();
        const elapsed = now - lastVisibilityRefresh;
        if (elapsed < 30000) {
          M(`  ⏭️  skipped (only ${elapsed}ms since last)`);
          return;
        }
        lastVisibilityRefresh = now;
        M(`  ✓ would refresh (but currently no-op in code)`);
        
        try {
          // Csak a profilt töltjük újra ha van session
          // (a session frissítést a Supabase saját autoRefreshToken kezeli)
          if (mounted) {
            // Új session érték az onAuthStateChange-ből jön ha lejárt
            // Itt csak a profilt frissítjük ha van user
          }
        } catch (err) {
          console.error('Visibility change handler hiba:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    // 🎯 v0.9.47: a signIn KIZÁRÓLAG hitelesít. A session/profil/loading
    // beállítását az onAuthStateChange SIGNED_IN event-je végzi — egyszer.
    // Korábban (v0.9.46) a signIn is hívott setSession+loadProfile+setLoading-ot,
    // ezzel PÁRHUZAMOS loadProfile futott (signIn + SIGNED_IN event egyszerre).
    // A párhuzamos query + régi token autoRefresh = gotrue lock-konkurencia →
    // 10s timeout × retry × 3 ≈ 21s belépés normál böngészőben (inkognitóban
    // nincs régi token, ezért volt gyors). A signIn most nem nyúl a state-hez.
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return { session, profile, loading, error, signIn, signOut, setError };
}

const AuthContext = React.createContext(null);

function useAuthContext() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider');
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════
// DATA RELOAD KEY - csendes adat-frissítés tab visszatéréskor
// ═══════════════════════════════════════════════════════════════════

// Ez a Context biztosítja az egész app számára egy kulcsot, ami akkor 
// változik, amikor a tab visszatér a háttérből vagy hálózat helyreáll.
// A komponensek dependency-ként használhatják, hogy újra lekérjék az 
// ADATAIKAT (de nem az UI-állapotukat - úgyhogy formok nem vesznek el).
const DataReloadContext = React.createContext({ key: 0, reload: () => {} });

function useDataReload() {
  return React.useContext(DataReloadContext);
}

function DataReloadProvider({ children }) {
  const [key, setKey] = useState(0);
  
  const reload = useCallback(() => {
    setKey(k => k + 1);
  }, []);
  
  useEffect(() => {
    let lastReload = Date.now();
    
    const handleVisibilityChange = () => {
      // Csak akkor reload, ha a tab visszanyer fókuszt és legalább 10 másodperc telt el
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastReload > 10000) {
          lastReload = now;
          setKey(k => k + 1);
        }
      }
    };
    
    const handleOnline = () => {
      // Ha visszajön az internet, frissítünk
      const now = Date.now();
      if (now - lastReload > 5000) {
        lastReload = now;
        setKey(k => k + 1);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  return (
    <DataReloadContext.Provider value={{ key, reload }}>
      {children}
    </DataReloadContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-SAVE HOOK - űrlapok automatikus mentése localStorage-ba
// ═══════════════════════════════════════════════════════════════════

// Használat:
//   const [form, setForm] = useAutoSavedState('competitor-form', { name: '', age: 0 });
// 
// A form állapota minden változáskor mentődik a localStorage-ba.
// Ha az oldal újratöltődik, az adat visszajön. 
// Ha a felhasználó megment, törölni kell: clearAutoSave('competitor-form').
function useAutoSavedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem('autosave:' + key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Csak akkor használjuk a mentett verziót, ha 24 órán belül van
        if (parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000) {
          delete parsed._savedAt;
          return parsed;
        }
      }
    } catch (e) {
      console.error('AutoSave restore hiba:', e);
    }
    return defaultValue;
  });
  
  useEffect(() => {
    try {
      const toSave = { ...state, _savedAt: Date.now() };
      localStorage.setItem('autosave:' + key, JSON.stringify(toSave));
    } catch (e) {
      console.error('AutoSave write hiba:', e);
    }
  }, [key, state]);
  
  return [state, setState];
}

// eslint-disable-next-line no-unused-vars
function clearAutoSave(key) {
  try {
    localStorage.removeItem('autosave:' + key);
  } catch (e) {
    console.error('AutoSave clear hiba:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTION STATUS
// ═══════════════════════════════════════════════════════════════════

function useConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return online;
}

// ═══════════════════════════════════════════════════════════════════
// CLUB BANNER — szimmetrikus, átlógó logókkal + Caveat szlogen
// ═══════════════════════════════════════════════════════════════════

function ClubBanner() {
  return (
    <>
      {/* Caveat font betöltése a Google Fonts-ból */}
      <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      
      {/* DESKTOP fejléc (sm: és nagyobb) — szimmetrikus átlógó */}
      <div className="hidden sm:block w-full overflow-hidden shadow-md relative">
        <div style={{ backgroundColor: COLORS.blue, height: '90px' }}></div>
        <div style={{ backgroundColor: COLORS.red, height: '90px' }}></div>
        
        <div className="absolute inset-0 flex items-center justify-between gap-4 px-6 lg:px-10">
          {/* BAL: Csepel SC pajzs + Pontregiszter */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div 
              className="flex-shrink-0 bg-white rounded-lg p-1.5"
              style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)', border: '2px solid white' }}
            >
              <img src={CSEPEL_SC_LOGO} alt="Csepel SC" className="h-20 w-20 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-extrabold text-3xl tracking-wide leading-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Pontregiszter
              </h1>
              <div className="text-white text-sm mt-1 opacity-95" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                Csepel SC · Ritmikus Gimnasztika
              </div>
            </div>
          </div>
          
          {/* KÖZÉP: Csepeli RG Klub logó */}
          <div 
            className="flex-shrink-0 bg-white rounded-lg p-3"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)', border: '2px solid white' }}
          >
            <img src={CSEPEL_RG_LOGO} alt="Csepeli RG Klub" className="h-24 object-contain" />
          </div>
          
          {/* JOBB: szlogen Caveat fonttal */}
          <div className="flex-1 text-right">
            <div 
              style={{ 
                fontFamily: "'Caveat', cursive", color: 'white',
                fontSize: 'clamp(22px, 2.4vw, 44px)', fontWeight: 700, lineHeight: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.35)', letterSpacing: '0.5px', whiteSpace: 'nowrap'
              }}
            >
              „Ügyesen, Okosan, Mosoly"
            </div>
          </div>
        </div>
      </div>
      
      {/* MOBILE fejléc (sm alatt) — két soros, kompakt */}
      <div className="sm:hidden w-full overflow-hidden shadow-md">
        {/* Felső sor: kék háttér, logók + cím */}
        <div 
          style={{ backgroundColor: COLORS.blue }}
          className="px-3 py-2 flex items-center gap-2"
        >
          <div 
            className="flex-shrink-0 bg-white rounded p-0.5"
            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: '1.5px solid white' }}
          >
            <img src={CSEPEL_SC_LOGO} alt="Csepel SC" className="h-12 w-12 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-extrabold text-lg leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              Pontregiszter
            </h1>
            <div className="text-white text-[10px] opacity-95 leading-tight">
              Csepel SC · Ritmikus Gimnasztika
            </div>
          </div>
          <div 
            className="flex-shrink-0 bg-white rounded p-1"
            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)', border: '1.5px solid white' }}
          >
            <img src={CSEPEL_RG_LOGO} alt="Csepeli RG Klub" className="h-10 object-contain" />
          </div>
        </div>
        
        {/* Alsó sor: piros háttér, szlogen */}
        <div 
          style={{ backgroundColor: COLORS.red }}
          className="px-3 py-1.5 text-center"
        >
          <div 
            style={{ 
              fontFamily: "'Caveat', cursive", color: 'white',
              fontSize: '22px', fontWeight: 700, lineHeight: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)', letterSpacing: '0.3px'
            }}
          >
            „Ügyesen, Okosan, Mosoly"
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════

function LoginScreen() {
  const { signIn, error, setError } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email és jelszó kötelező');
      return;
    }
    setSubmitting(true);
    await signIn(email.trim(), password);
    setSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !submitting) handleLogin();
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.blueBg }}
    >
      <ClubBanner />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-200">
          <h2 
            className="text-xl font-bold mb-1 text-center"
            style={{ color: COLORS.blueDark }}
          >
            Belépés
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">v0.8 · 2025–2028 ciklus</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 border rounded-lg outline-none transition-all"
                style={{ borderColor: COLORS.gray200 }}
                onFocus={(e) => e.target.style.borderColor = COLORS.blue}
                onBlur={(e) => e.target.style.borderColor = COLORS.gray200}
                placeholder="email@example.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jelszó
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-2 pr-10 border rounded-lg outline-none"
                  style={{ borderColor: COLORS.gray200 }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.blue}
                  onBlur={(e) => e.target.style.borderColor = COLORS.gray200}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm p-3 rounded-lg border"
                   style={{ 
                     backgroundColor: COLORS.redLight, 
                     borderColor: COLORS.red, 
                     color: COLORS.redDark 
                   }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white shadow hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.blue }}
            >
              {submitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Belépés...
                </>
              ) : 'Belépés'}
            </button>
          </div>

          <div className="mt-6 text-xs text-center text-gray-500">
            Ha nincs még fiókod, kérd az adminisztrátortól.
          </div>
        </div>
        <div className="mt-6 text-center">
          <div 
            style={{ 
              fontFamily: "'Caveat', cursive",
              color: COLORS.red || '#BE123C',
              fontSize: '28px',
              fontWeight: 700,
              lineHeight: 1
            }}
          >
            „Ügyesen, Okosan, Mosoly"
          </div>
          <div className="text-xs text-gray-500 mt-1">Csepel SC · Ritmikus Gimnasztika</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════════════

function LoadingScreen({ message = 'Betöltés...' }) {
  const [showReload, setShowReload] = useState(false);
  
  useEffect(() => {
    // 5 másodperc után megjelenik egy "Frissítés" gomb
    const t = setTimeout(() => setShowReload(true), 5000);
    return () => clearTimeout(t);
  }, []);
  
  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.blueBg }}
    >
      <ClubBanner />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 font-medium" style={{ color: COLORS.blue }}>
          <Loader className="w-5 h-5 animate-spin" />
          {message}
        </div>
        {showReload && (
          <button
            onClick={() => window.location.reload()}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-white"
            style={{ color: COLORS.blue }}
          >
            Frissítés
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Áttekintés', icon: BarChart3, roles: 'all' },
  { id: 'profile', label: 'Profil', icon: User, roles: [ROLES.VERSENYZO, ROLES.SZULO, ROLES.SZULO_ADMIN] },
  { id: 'treasure', label: 'Kincsesládám', icon: Trophy, roles: [ROLES.VERSENYZO] },
  { id: 'competitors', label: 'Versenyzők', icon: Users, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN, ROLES.VEZETOEDZO, ROLES.EDZO, ROLES.SEGEDEDZO, ROLES.VERSENYZO, ROLES.SZULO] },
  { id: 'competitions', label: 'Versenyek', icon: Calendar, roles: 'all' },
  { id: 'training', label: 'Edzések', icon: BookOpen, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN, ROLES.VEZETOEDZO, ROLES.EDZO, ROLES.SEGEDEDZO, ROLES.VERSENYZO] },
  { id: 'events', label: 'Üzenőfal', icon: MessageCircle, roles: 'all' },
  { id: 'coach-notes', label: 'Edzői napló', icon: Lock, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN, ROLES.VEZETOEDZO, ROLES.EDZO, ROLES.SEGEDEDZO, ROLES.SZULO] },
  { id: 'admin', label: 'Adminisztráció', icon: Settings, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN, ROLES.VEZETOEDZO, ROLES.EDZO] }
];

function AppShell() {
  const { profile, signOut } = useAuthContext();
  const { key: dataReloadKey, reload: reloadData } = useDataReload();
  const online = useConnectionStatus();
  const [activeView, setActiveView] = useState('dashboard');
  // v0.9.59: a Frissítés gomb a nyitott oldalt teljesen újratölti (újramountolja),
  // mert sok doboz nem figyel a dataReloadKey-re. Az automatikus (fülváltás / net
  // visszajön) frissítés ettől független, félig kitöltött űrlap nem vész el.
  const [manualReloadKey, setManualReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshPage = () => {
    setRefreshing(true);
    reloadData();
    setManualReloadKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  };

  const visibleNavItems = NAV_ITEMS.filter(item =>
    item.roles === 'all' || item.roles.includes(profile.role)
  );

  const RoleIcon = ROLE_ICONS[profile.role];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.gray50 }}>
      {!online && (
        <div 
          className="text-center text-xs py-1 px-2 flex items-center justify-center gap-1 text-white"
          style={{ backgroundColor: COLORS.red }}
        >
          <WifiOff className="w-3 h-3" />
          Nincs internetkapcsolat — a változtatások nem mentődnek
        </div>
      )}

      <ClubBanner />

      {/* User info bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <RoleIcon className="w-4 h-4" style={{ color: COLORS.blue }} />
            <span className="font-medium" style={{ color: COLORS.blueDark }}>
              {profile.full_name}
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">
              {ROLE_LABELS[profile.role]}
              {profile.titulus ? ` · ${profile.titulus}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refreshPage}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1 text-sm"
              title="Az oldal adatainak újratöltése"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Frissítés</span>
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1 text-sm"
              title="Kijelentkezés"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Kijelentkezés</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2 flex">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={{
                  borderColor: isActive ? COLORS.blue : 'transparent',
                  color: isActive ? COLORS.blue : COLORS.gray700
                }}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main key={manualReloadKey} className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Áttekintés: VERSENYZŐ → saját vidám, MÁS → klubos áttekintés */}
        {/* Áttekintés: MINDENKINEK ugyanaz (versenyzőnek is - személyes blokk felül) */}
        {activeView === 'dashboard' && (
          <DashboardView setActiveView={setActiveView} />
        )}

        {/* Profil: szülő → ParentProfileView, versenyző → CompetitorProfileView (Én vagyok!) */}
        {activeView === 'profile' && hasParentRights(profile.role) && (
          <ParentProfileView supabase={supabase} parentUserId={profile.id} userRole={profile.role} dataReloadKey={dataReloadKey} />
        )}
        {activeView === 'profile' && profile.role === 'versenyzo' && (
          <CompetitorProfileView supabase={supabase} profile={profile} />
        )}

        {/* Kincsesládám: CSAK versenyző */}
        {activeView === 'treasure' && profile.role === 'versenyzo' && (
          <CompetitorTreasureView supabase={supabase} profile={profile} />
        )}

        {activeView === 'competitors' && <CompetitorsViewComponent supabase={supabase} userRole={profile.role} profile={profile} dataReloadKey={dataReloadKey} />}
        {activeView === 'competitions' && <CompetitionsView supabase={supabase} userRole={profile.role} dataReloadKey={dataReloadKey} />}
        {activeView === 'training' && <TrainingView supabase={supabase} userRole={profile.role} profile={profile} dataReloadKey={dataReloadKey} />}
        {activeView === 'events' && <EventsView supabase={supabase} userRole={profile.role} />}
        {activeView === 'coach-notes' && <CoachNotesView supabase={supabase} userRole={profile.role} profile={profile} />}
        {activeView === 'admin' && <AdminView supabase={supabase} userRole={profile.role} dataReloadKey={dataReloadKey} />}
      </main>

      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-center">
        <div 
          style={{ 
            fontFamily: "'Caveat', cursive",
            color: COLORS.red,
            fontSize: '20px',
            fontWeight: 700,
            lineHeight: 1
          }}
        >
          „Ügyesen, Okosan, Mosoly"
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Pontregiszter v0.9.62 · Csepel RG Klub · MRGSZ 2025–2028
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function DashboardView({ setActiveView }) {
  const { profile } = useAuthContext();
  const { key: dataReloadKey } = useDataReload();
  const [stats, setStats] = useState({ competitors: null, competitions: null, parents: null, provisional: null });
  const [provisionalCompetitors, setProvisionalCompetitors] = useState(null);  // ÚJ: ideiglenes profilok lista
  const [myChildren, setMyChildren] = useState(null);  // ÚJ: saját gyerekek (szulo_admin)
  const [error, setError] = useState(null);
  
  const isParentLike = profile.role === 'szulo' || profile.role === 'szulo_admin';
  const isAdminLike = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(profile.role);

  useEffect(() => {
    let mounted = true;
    
    const loadStats = async () => {
      try {
        // Helper: biztonságos lekérdezés AbortError védelemmel + agresszív retry
        // 3x retry: 100ms, 300ms, 700ms
        const safeQuery = async (queryFn) => {
          const delays = [0, 100, 300, 700];
          let lastErr = null;
          for (let i = 0; i < delays.length; i++) {
            if (delays[i] > 0) {
              await new Promise(r => setTimeout(r, delays[i]));
            }
            try {
              const result = await queryFn();
              // Ha a result-ban is van error mező
              if (result && result.error) {
                const errMsg = result.error.message || '';
                if (errMsg.includes('AbortError') || errMsg.includes('Lock broken') || errMsg.includes('aborted')) {
                  lastErr = result.error;
                  continue;
                }
                return result;
              }
              return result;
            } catch (err) {
              lastErr = err;
              if (err.name === 'AbortError' || (err.message || '').includes('Lock broken')) {
                continue;
              }
              return { error: err };
            }
          }
          return { error: lastErr || { message: 'lekérés sikertelen retry után' } };
        };

        // SEQUENTIAL lekérdezés - egyik a másik után, ne támadjon össze a Supabase auth
        const compResult = await safeQuery(() => supabase
          .from('competitors')
          .select('id', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count ?? 0, error }))
        );
        
        if (!mounted) return;
        
        const competitionsResult = await safeQuery(() => supabase
          .from('competitions')
          .select('id', { count: 'exact', head: true })
          .gte('end_date', new Date().toISOString().split('T')[0])
          .then(({ count, error }) => ({ count: count ?? 0, error }))
        );
        
        if (!mounted) return;
        
        const parentsResult = await safeQuery(() => supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['szulo', 'szulo_admin'])
          .then(({ count, error }) => ({ count: count ?? 0, error }))
        );
        
        if (!mounted) return;
        
        const provResult = await safeQuery(() => supabase
          .from('competitors')
          .select('*')
          .eq('is_provisional', true)
          .eq('is_active', true)
          .order('full_name')
          .then(({ data, error }) => ({ data: data ?? [], error }))
        );
        
        if (!mounted) return;
        
        // Csak akkor frissítjük az állapotot, ha a query sikeres volt (NEM nullázunk hibára!)
        setStats(prev => ({
          competitors: compResult.error ? (prev?.competitors ?? null) : compResult.count,
          competitions: competitionsResult.error ? (prev?.competitions ?? null) : competitionsResult.count,
          parents: parentsResult.error ? (prev?.parents ?? null) : parentsResult.count,
          provisional: provResult.error ? (prev?.provisional ?? 0) : (provResult.data?.length ?? 0)
        }));
        
        if (!provResult.error) {
          setProvisionalCompetitors(provResult.data);
        }
        
        // Csak NEM-transient hibák jelennek meg
        const errors = [];
        const isTransientError = (err) => 
          err && err.message && (
            err.message.includes('AbortError') || 
            err.message.includes('Lock broken') ||
            err.message.includes('aborted') ||
            err.message.includes('lekérés sikertelen')
          );
        
        if (compResult.error && !isTransientError(compResult.error)) errors.push('Versenyzők: ' + compResult.error.message);
        if (competitionsResult.error && !isTransientError(competitionsResult.error)) errors.push('Versenyek: ' + competitionsResult.error.message);
        if (parentsResult.error && !isTransientError(parentsResult.error)) errors.push('Szülők: ' + parentsResult.error.message);
        
        if (errors.length > 0) setError(errors.join(' · '));
        else setError(null);
      } catch (err) {
        // AbortError NEM mutatjuk a felhasználónak
        if (mounted && err.name !== 'AbortError' && !(err.message || '').includes('Lock broken')) {
          setError('Statisztikák betöltése sikertelen: ' + err.message);
        }
      }
    };

    // ÚJ: szülő/szülő-admin esetén töltjük a saját gyerekeket
    const loadMyChildren = async () => {
      if (!isParentLike) return;
      try {
        const { data: links } = await supabase
          .from('parent_child_links')
          .select('competitor_id')
          .eq('parent_user_id', profile.id);
        
        if (!links || links.length === 0) {
          if (mounted) setMyChildren([]);
          return;
        }
        
        const childIds = links.map(l => l.competitor_id);
        const { data: kids } = await supabase
          .from('competitors')
          .select('*')
          .in('id', childIds)
          .order('full_name');
        
        if (mounted) setMyChildren((kids || []).slice().sort(huSortByNickname));
      } catch (err) {
        console.error('Gyerekek betöltése hiba:', err);
      }
    };
    
    loadStats();
    loadMyChildren();
    
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setStats(prev => ({
          competitors: prev.competitors ?? 0,
          competitions: prev.competitions ?? 0,
          parents: prev.parents ?? 0
        }));
      }
    }, 8000);
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [dataReloadKey, isParentLike, profile.id]);

  const isVersenyzo = profile.role === 'versenyzo';

  return (
    <div>
      {/* Üdvözlés - NEM versenyzőnek (versenyzőnek a MySelfBlock-on belül van) */}
      {!isVersenyzo && (
        <>
          <h2 className="text-2xl font-bold mb-1" style={{ color: COLORS.blueDark }}>
            Üdv, {profile.full_name}!
          </h2>
          <p className="text-gray-600 mb-6">
            {ROLE_LABELS[profile.role]}
            {profile.titulus ? ` · ${profile.titulus}` : ''}
          </p>
        </>
      )}

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm flex gap-2 border"
             style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* SAJÁT BLOKK - CSAK VERSENYZŐNEK (rózsaszín-lila, RG-s, vidám) */}
      {isVersenyzo && (
        <MySelfBlock supabase={supabase} profile={profile} />
      )}

      {/* v0.9.51: a klub csapatindulója — mindenkinek, csak kattintásra szól */}
      <AnthemPlayer />

      {/* HERO + Születésnap + Események - MINDENKINEK */}
      <NextCompetitionHero />
      <BirthdayWidget supabase={supabase} />
      <div className="mb-4">
        <UpcomingEventsWidget 
          supabase={supabase}
          onOpenEvents={() => setActiveView('events')}
        />
      </div>

      {/* ÚJ: szülő/szülő-admin saját gyerekek */}
      {/* v0.9.61: értesítés az új edzői napló bejegyzésekről (szülőnek) */}
      {isParentLike && myChildren && myChildren.length > 0 && (
        <CoachNotesNotice profileId={profile.id} kids={myChildren}
                          onOpen={() => setActiveView('coach-notes')} />
      )}

      {isParentLike && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2" style={{ color: COLORS.blueDark }}>
            <Heart className="w-5 h-5" style={{ color: COLORS.red }} />
            Saját gyerek(ek)
          </h3>
          {myChildren === null ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <Loader className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : myChildren.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm text-sm text-gray-500 italic">
              Még nincs hozzád rendelt gyermek. Az adminisztrátor tudja hozzárendelni.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myChildren.map(c => (
                <button 
                  key={c.id}
                  onClick={() => setActiveView('profile')}
                  className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold" style={{ color: COLORS.blueDark }}>
                    ★ {formatCompetitorName(c)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {c.kategoria} · {c.korosztaly} · született {c.birth_year}
                  </div>
                  <div className="text-xs text-blue-600 mt-2">
                    Profil megnyitása →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Klub áttekintés - MINDENKINEK (admin, edző, szülő) */}
      <>
          <h3 className="font-semibold text-lg mb-3 mt-2" style={{ color: COLORS.blueDark }}>
            Klub áttekintés
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Versenyzők" value={stats.competitors} accent="blue" />
            <StatCard icon={Calendar} label="Aktív versenyek" value={stats.competitions} accent="red" />
            <StatCard icon={Heart} label="Szülő fiókok" value={stats.parents} accent="blue" />
          </div>
          
          {/* Legutóbbi csepeli sikerek + Klub büszkesége */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <RecentSuccessesWidget />
            <ClubPrideWidget />
          </div>
          
          {/* Helyezések táblázat */}
          <div className="mt-4">
            <ClubRankingsWidget />
          </div>
      </>

      {/* Ideiglenes profilok - csak admin */}
      {isAdminLike && stats.provisional > 0 && provisionalCompetitors && (
        <div className="mt-4 border-2 rounded-lg overflow-hidden" style={{ borderColor: '#f59e0b' }}>
          <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2"
               style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            <AlertCircle className="w-4 h-4" />
            Ideiglenes profilok ({stats.provisional}) — admin/edző ellenőrzésére várnak
          </div>
          <div className="space-y-1 p-2 bg-amber-50">
            {provisionalCompetitors.slice(0, 5).map(c => {
              const age = c.birth_year ? (new Date().getFullYear() - c.birth_year) : null;
              return (
                <div key={c.id} className="bg-white border rounded p-2 flex items-center justify-between"
                     style={{ borderColor: '#fbbf24' }}>
                  <div>
                    <div className="font-medium text-sm" style={{ color: COLORS.blueDark }}>
                      {formatCompetitorName(c)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.kategoria} · {c.korosztaly}{age ? ` · ${age} éves` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-amber-700">⚠ Ideiglenes</span>
                </div>
              );
            })}
            {provisionalCompetitors.length > 5 && (
              <div className="text-xs text-amber-700 italic px-1">
                ... és {provisionalCompetitors.length - 5} további a Versenyzők menüben
              </div>
            )}
          </div>
        </div>
      )}

      {/* RG sportszer hirdetés banner - nem-versenyzőknek, a tartalom alján */}
      <a
        href="https://www.rgsportaruhaz.hu"
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-6 rounded-lg overflow-hidden border hover:opacity-95 transition-opacity"
        style={{ borderColor: COLORS.gray200 }}
      >
        <img
          src="/rg-bolt-banner.png"
          alt="RG Sportáruház - Pastorelli FIG hivatalos partner"
          className="w-full h-auto block"
        />
      </a>

      {/* Admin info dobozok - csak admin/szülő-admin */}
      {isAdminLike && (
        <>
      <div 
        className="mt-6 rounded-lg p-4 flex gap-3 border"
        style={{ 
          backgroundColor: '#f0fdf4', 
          borderColor: '#86efac',
          color: '#14532d'
        }}
      >
        <Wifi className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold mb-1">
            Supabase felhős kapcsolat aktív ✓
          </div>
          <div>
            Az adatok a felhőben tárolódnak, valós időben szinkronizálnak minden eszköz között.
          </div>
        </div>
      </div>

      {/* v0.9.44: Fejlesztési ütemterv doboz eltávolítva (nem releváns a klubnak) */}
      </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEXT COMPETITION HERO — soron következő verseny kiemelt doboza
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// BIRTHDAY WIDGET — születésnapok 8 nap előtte + 8 nap utána
// ═══════════════════════════════════════════════════════════════════

function BirthdayWidget({ supabase }) {
  const [birthdays, setBirthdays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('competitors')
          .select('id, full_name, nickname, birth_date')
          .eq('is_active', true)
          .eq('is_provisional', false)
          .not('birth_date', 'is', null);
        
        if (!active) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = today.getFullYear();
        
        const items = [];
        (data || []).forEach(c => {
          if (!c.birth_date) return;
          const birth = new Date(c.birth_date);
          const month = birth.getMonth();
          const day = birth.getDate();
          
          let bd = new Date(currentYear, month, day);
          bd.setHours(0, 0, 0, 0);
          let diff = Math.round((bd - today) / (1000 * 60 * 60 * 24));
          
          if (diff < -8) {
            bd = new Date(currentYear + 1, month, day);
            bd.setHours(0, 0, 0, 0);
            diff = Math.round((bd - today) / (1000 * 60 * 60 * 24));
          }
          
          if (diff >= -8 && diff <= 8) {
            const yearsOld = bd.getFullYear() - birth.getFullYear();
            items.push({
              id: c.id,
              name: formatCompetitorName(c),
              diff,
              yearsOld,
              dateStr: `${String(month + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`
            });
          }
        });
        
        items.sort((a, b) => {
          if (a.diff === 0 && b.diff !== 0) return -1;
          if (b.diff === 0 && a.diff !== 0) return 1;
          if (a.diff >= 0 && b.diff < 0) return -1;
          if (b.diff >= 0 && a.diff < 0) return 1;
          if (a.diff >= 0 && b.diff >= 0) return a.diff - b.diff;
          return b.diff - a.diff;
        });
        
        if (active) setBirthdays(items);
      } catch (err) {
        console.error('BirthdayWidget:', err);
        if (active) setBirthdays([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  if (loading) return null;
  if (!birthdays || birthdays.length === 0) return null;

  const hasToday = birthdays.some(b => b.diff === 0);
  
  const diffLabel = (b) => {
    if (b.diff === 0) return `MA ${b.yearsOld} éves lett 🎉`;
    if (b.diff === 1) return `HOLNAP ${b.yearsOld} éves lesz`;
    if (b.diff === -1) return `Tegnap ${b.yearsOld} éves lett`;
    if (b.diff > 0) return `${b.diff} nap múlva ${b.yearsOld} éves lesz`;
    return `${Math.abs(b.diff)} napja ${b.yearsOld} éves lett`;
  };

  return (
    <div 
      className="rounded-xl p-4 mb-4 shadow-sm relative overflow-hidden"
      style={{ 
        background: hasToday 
          ? 'linear-gradient(135deg, #FBCFE8 0%, #FEF3C7 50%, #BFDBFE 100%)' 
          : 'linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)',
        border: '2px solid #fbbf24'
      }}
    >
      {/* Háttér confetti dekoráció (csak ha MA) */}
      {hasToday && (
        <>
          <div className="absolute top-2 right-20 text-2xl opacity-60 pointer-events-none select-none">🎈</div>
          <div className="absolute bottom-2 right-32 text-xl opacity-50 pointer-events-none select-none">✨</div>
          <div className="absolute top-12 right-4 text-lg opacity-50 pointer-events-none select-none">🎊</div>
        </>
      )}
      
      <div className="flex items-center gap-4 relative">
        {/* Torta-kép (ChatGPT-vel rajzolt RG-s illusztráció) */}
        <img 
          src="/birthday-cake.png" 
          alt=""
          className="flex-shrink-0 select-none pointer-events-none"
          style={{ width: '96px', height: '96px', objectFit: 'contain' }}
        />
        
        {/* Szöveges tartalom */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold mb-2 text-lg" style={{ color: '#831843' }}>
            {hasToday ? '🎉 Boldog születésnapot! 🎉' : '🎂 Születésnapok'}
          </h3>
          
          <div className="space-y-1.5">
            {birthdays.map((b, idx) => {
              // Színes paletták: körforgó vidám színek
              const colors = [
                { bg: '#FCE7F3', text: '#9D174D', emoji: '🌸' },  // rózsaszín
                { bg: '#DBEAFE', text: '#1E40AF', emoji: '⭐' },  // kék
                { bg: '#D1FAE5', text: '#065F46', emoji: '🌟' },  // zöld
                { bg: '#FEF3C7', text: '#92400E', emoji: '✨' },  // sárga
                { bg: '#EDE9FE', text: '#5B21B6', emoji: '💫' },  // lila
                { bg: '#FFEDD5', text: '#9A3412', emoji: '🌈' }   // narancs
              ];
              const palette = colors[idx % colors.length];
              const isToday = b.diff === 0;
              const isPast = b.diff < 0;
              
              return (
                <div 
                  key={b.id} 
                  className="rounded-lg px-2.5 py-1.5 flex items-center gap-2 flex-wrap text-sm"
                  style={{ 
                    backgroundColor: isToday ? '#FFFFFF' : isPast ? '#F9FAFB' : palette.bg,
                    border: isToday ? '2px solid #BE123C' : '1px solid rgba(0,0,0,0.05)',
                    opacity: isPast ? 0.75 : 1
                  }}
                >
                  <span className="text-lg flex-shrink-0">
                    {isToday ? '🎂' : isPast ? '🌸' : palette.emoji}
                  </span>
                  <span 
                    className="font-semibold"
                    style={{ color: isToday ? '#BE123C' : isPast ? '#6B7280' : palette.text }}
                  >
                    {b.name}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: isToday ? '#BE123C' : isPast ? '#9CA3AF' : palette.text, opacity: isToday ? 1 : 0.85 }}
                  >
                    — {diffLabel(b)}
                  </span>
                  <span className="text-xs opacity-50 ml-auto">{b.dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextCompetitionHero() {
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('competitions')
          .select('id, name, importance, start_date, end_date, arrival_info, arrival_time, venue:venues(name, city)')
          .gte('end_date', today)
          .order('start_date', { ascending: true })
          .limit(1);
        if (error) throw error;
        if (active) setComp((data && data[0]) || null);
      } catch (err) {
        console.error('NextCompetitionHero:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading || !comp) return null;

  const today = new Date();
  const startDate = new Date(comp.start_date);
  const diffDays = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
  
  const isLive = comp.start_date <= today.toISOString().split('T')[0] && comp.end_date >= today.toISOString().split('T')[0];
  
  let dayLabel = '';
  if (isLive) dayLabel = '📍 ÉLŐ MOST';
  else if (diffDays === 0) dayLabel = '🎯 MA';
  else if (diffDays === 1) dayLabel = '🌅 HOLNAP';
  else if (diffDays > 0) dayLabel = `📅 ${diffDays} NAP MÚLVA`;

  const importanceLabels = {
    'fig': 'FIG nemzetközi', 'nemzetkozi': 'Nemzetközi verseny', 'mrgsz_mb': 'Magyar Bajnokság',
    'mrgsz_regional': 'Regionális verseny', 'mrgsz_reg': 'Regionális verseny', 'diakolimpia': 'Diákolimpia',
    'club': 'Klubverseny', 'klub': 'Klubverseny', 'egyeb': 'Egyéb verseny'
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
  };

  return (
    <div 
      className="rounded-xl p-4 sm:p-5 mb-4 text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #BE123C 100%)' }}
    >
      <div className="text-xs opacity-90 mb-1 font-semibold tracking-wide">
        🏆 SORON KÖVETKEZŐ VERSENY · {dayLabel}
      </div>
      <div className="text-xl sm:text-2xl font-bold mb-1 leading-tight">{comp.name}</div>
      <div className="text-sm opacity-95 flex flex-wrap gap-x-3 gap-y-1">
        <span>📌 {importanceLabels[comp.importance] || comp.importance}</span>
        <span>📅 {formatDate(comp.start_date)}</span>
        {comp.venue && <span>📍 {comp.venue.name}{comp.venue.city ? `, ${comp.venue.city}` : ''}</span>}
      </div>
      {(comp.arrival_time || comp.arrival_info) && (
        <div className="mt-2 pt-2 border-t border-white/20 text-sm">
          {comp.arrival_time && <span className="font-semibold">⏰ Találkozó: {comp.arrival_time}</span>}
          {comp.arrival_info && <div className="text-xs opacity-95 mt-1">{comp.arrival_info}</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SLOGAN HERO — kiemelt klub szlogen
// ═══════════════════════════════════════════════════════════════════

function SloganHero() {
  return (
    <div 
      className="rounded-xl p-4 mb-4 text-center"
      style={{ 
        background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)',
        borderLeft: `4px solid ${COLORS.red}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div 
        style={{ 
          fontFamily: "'Caveat', cursive", color: COLORS.red,
          fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700,
          lineHeight: 1, letterSpacing: '0.5px'
        }}
      >
        „Ügyesen, Okosan, Mosoly"
      </div>
      <div className="text-xs sm:text-sm text-amber-800 mt-2 opacity-90">
        Csepel SC · Ritmikus Gimnasztika · MRGSZ
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZŐI NAPLÓ ÉRTESÍTŐ (v0.9.61) — a szülő Áttekintésén, ha az utolsó megnézés
// (profiles.coach_notes_seen_at) óta új bejegyzés jött valamelyik gyerekéhez.
// Az Edzői napló megnyitása vagy a „Láttam” gomb nullázza.
// ═══════════════════════════════════════════════════════════════════

function CoachNotesNotice({ profileId, kids, onOpen }) {
  const [counts, setCounts] = useState(null); // [{ child, count }]

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles').select('coach_notes_seen_at').eq('id', profileId).maybeSingle();
        const since = prof?.coach_notes_seen_at;
        if (!since) { if (active) setCounts([]); return; }
        const ids = kids.map(c => c.id);
        const { data: notes } = await supabase
          .from('coach_notes').select('competitor_id').in('competitor_id', ids).gt('created_at', since);
        const per = {};
        (notes || []).forEach(n => { per[n.competitor_id] = (per[n.competitor_id] || 0) + 1; });
        if (active) setCounts(kids.filter(c => per[c.id]).map(c => ({ child: c, count: per[c.id] })));
      } catch (err) {
        console.error('CoachNotesNotice:', err);
        if (active) setCounts([]);
      }
    })();
    return () => { active = false; };
  }, [profileId, kids]);

  const markSeen = async () => {
    setCounts([]);
    await supabase.from('profiles').update({ coach_notes_seen_at: new Date().toISOString() }).eq('id', profileId);
  };

  if (!counts || counts.length === 0) return null;
  const total = counts.reduce((s, x) => s + x.count, 0);

  return (
    <div className="mb-4 rounded-xl border-2 p-4 flex items-start gap-3 flex-wrap shadow-sm"
         style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b' }}>
      <div className="text-2xl">📝</div>
      <div className="flex-1 min-w-[180px]">
        <div className="font-semibold" style={{ color: '#92400e' }}>
          {total} új edzői bejegyzés
        </div>
        <div className="text-sm text-amber-900 mt-0.5">
          {counts.map((x, i) => (
            <span key={x.child.id}>{i > 0 && ' · '}{formatCompetitorName(x.child)} ({x.count})</span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={onOpen} className="px-3 py-1.5 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#d97706' }}>
          Megnyitom
        </button>
        <button onClick={markSeen} className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: '#f59e0b', color: '#92400e' }}>
          Láttam
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CSAPATINDULÓ (v0.9.51) — „Ügyesen, Okosan, Mosoly” (Völgyesi Sándor)
// A fájl a weboldal része (public/zene), nem a Supabase-tárhelyé.
// Csak kattintásra szól; letöltés gomb nincs (a böngésző menüjéből elrejtve).
// ═══════════════════════════════════════════════════════════════════

const ANTHEM_URL = '/zene/csapatindulo.mp3?v=2'; // ?v=2: új borító (a böngésző ne a régit adja)
const ANTHEM_COVER_SMALL = '/zene/borito.jpg';
const ANTHEM_COVER_BIG = '/zene/borito_nagy.jpg';

// v0.9.52: kattintásra felugró ablak nagy borítóval. Az ablak bezárása után
// a zene tovább szól (az audio elem a lejátszás indulása után a helyén marad).
function AnthemPlayer() {
  const [started, setStarted] = useState(false);  // egyszer elindult → audio elem él
  const [open, setOpen] = useState(false);        // felugró ablak látszik
  const noMenu = e => e.preventDefault();

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openPlayer = () => { setStarted(true); setOpen(true); };

  return (
    <>
      <button
        type="button"
        onClick={openPlayer}
        className="mb-4 w-full rounded-xl border p-3 flex items-center gap-3 shadow-sm text-left"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #b91c1c 100%)', borderColor: COLORS.blue }}
      >
        <img src={ANTHEM_COVER_SMALL} alt="" width="56" height="56" draggable="false" onContextMenu={noMenu}
             className="rounded-lg shadow flex-shrink-0" style={{ width: 56, height: 56 }} />
        <div className="text-white flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide opacity-80">Csapatindulónk</div>
          <div className="font-bold truncate">„Ügyesen, Okosan, Mosoly”</div>
        </div>
        <span className="px-4 py-2 rounded-full bg-white font-semibold text-sm shadow flex-shrink-0"
              style={{ color: COLORS.blueDark }}>
          {started ? '♪ Megnyitás' : '▶ Lejátszás'}
        </span>
      </button>

      {started && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', display: open ? 'flex' : 'none' }}
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={ANTHEM_COVER_BIG} alt="Csepel RG csapatinduló" draggable="false" onContextMenu={noMenu}
                   className="w-full block" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
              <button onClick={() => setOpen(false)} aria-label="Bezárás"
                      className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 text-white text-lg leading-none">
                ✕
              </button>
            </div>
            <div className="p-3">
              <div className="font-bold text-center mb-2" style={{ color: COLORS.blueDark }}>
                „Ügyesen, Okosan, Mosoly”
              </div>
              <audio
                src={ANTHEM_URL}
                controls
                autoPlay
                controlsList="nodownload noplaybackrate"
                onContextMenu={noMenu}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RECENT SUCCESSES — legutóbbi csepeli sikerek (1-3. hely)
// ═══════════════════════════════════════════════════════════════════

function RecentSuccessesWidget() {
  const [successes, setSuccesses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: comps } = await supabase
          .from('competitions')
          .select('id, name, start_date, importance')
          .eq('is_finalized', true)
          .order('start_date', { ascending: false })
          .limit(20);

        if (!comps || comps.length === 0) {
          if (active) { setSuccesses([]); setLoading(false); }
          return;
        }

        const compMap = {};
        comps.forEach(c => { compMap[c.id] = c; });

        const { data: teams } = await supabase
          .from('competition_teams')
          .select('name, placement, competition_id')
          .in('competition_id', comps.map(c => c.id))
          .not('placement', 'is', null)
          .lte('placement', 3);

        const items = [];
        (teams || []).forEach(t => {
          const comp = compMap[t.competition_id];
          if (!comp) return;
          // v0.9.49: csak csepeli csapat (a versenyek modul szabálya: a névben „csepel”)
          if (!isCsepeliTeamName(t.name)) return;
          items.push({
            type: 'team', placement: t.placement, name: t.name,
            competitionName: comp.name, date: comp.start_date
          });
        });

        items.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return a.placement - b.placement;
        });

        if (active) setSuccesses(items.slice(0, 6));
      } catch (err) {
        console.error('RecentSuccesses:', err);
        if (active) setSuccesses([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const medalEmoji = (p) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}.`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4" style={{ color: '#B45309' }} />
        <h3 className="font-semibold text-sm" style={{ color: COLORS.blueDark }}>
          🏆 Legutóbbi csepeli sikerek
        </h3>
      </div>
      
      {loading && (
        <div className="text-center py-4"><Loader className="w-4 h-4 animate-spin text-gray-400 inline" /></div>
      )}
      
      {!loading && successes && successes.length === 0 && (
        <div className="text-xs text-gray-500 italic py-2">
          Még nincsenek véglegesített eredmények.
        </div>
      )}
      
      {!loading && successes && successes.length > 0 && (
        <div className="space-y-1.5">
          {successes.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-base flex-shrink-0">{medalEmoji(s.placement)}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium" style={{ color: '#BE123C' }}>
                  {s.name}
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  · {s.competitionName} (csapat)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLUB PRIDE — klub büszkesége (admin manuálisan szerkeszthető)
// ═══════════════════════════════════════════════════════════════════

function ClubPrideWidget() {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Bejegyzések + kapcsolt versenyzők
        const { data: prides } = await supabase
          .from('club_pride')
          .select(`
            *,
            competitors:club_pride_competitors(
              display_order,
              competitor:competitors(id, full_name, nickname)
            )
          `)
          .eq('is_active', true)
          .order('display_order');
        if (active) setItems(prides || []);
      } catch (err) {
        console.error('ClubPride:', err);
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Auto-váltás 6 másodpercenként, ha több mint 1 elem van
  useEffect(() => {
    if (!items || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items]);

  const formatCompName = formatCompetitorName;

  const current = items && items.length > 0 ? items[currentIdx] : null;
  const photoUrl = usePridePhotoUrl(supabase, current?.photo_path); // v0.9.52
  const competitors = current?.competitors
    ?.map(c => c.competitor)
    .filter(Boolean)
    .sort(huSortByNickname) || [];

  return (
    <div 
      className="rounded-xl p-4 shadow-sm relative"
      style={{ 
        background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)',
        border: '1px solid #f59e0b',
        minHeight: '160px'
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4" style={{ color: '#92400e' }} />
        <h3 className="font-semibold text-sm flex-1" style={{ color: '#92400e' }}>
          ⭐ Klub büszkesége
        </h3>
        {items && items.length > 1 && (
          <span className="text-xs text-amber-700">
            {currentIdx + 1} / {items.length}
          </span>
        )}
      </div>
      
      {loading && (
        <div className="text-center py-6"><Loader className="w-4 h-4 animate-spin text-amber-400 inline" /></div>
      )}
      
      {!loading && items && items.length === 0 && (
        <div className="text-xs text-amber-800 italic py-2">
          Még nincs felvett klubbüszkeség.
        </div>
      )}
      
      {!loading && current && (
        <div className="text-sm" style={{ animation: 'fadeIn 0.5s ease-in' }}>
          {photoUrl && (
            <div
              role="img"
              aria-label={current.title}
              onContextMenu={e => e.preventDefault()}
              className="w-full rounded-lg mb-2 shadow-sm"
              style={{ aspectRatio: '16 / 9', backgroundImage: `url("${photoUrl}")`, backgroundSize: 'cover',
                       backgroundPosition: 'center', border: '1px solid #fbbf24' }}
            />
          )}
          <div className="font-semibold text-amber-900 flex items-center gap-1.5 text-base">
            {current.icon && <span>{current.icon}</span>}
            <span>{current.title}</span>
          </div>
          {current.description && (
            <div className="text-xs text-amber-800 mt-1 leading-snug">
              {current.description}
            </div>
          )}
          {competitors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {competitors.map(c => (
                <span 
                  key={c.id} 
                  className="inline-flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded text-xs font-medium"
                  style={{ color: '#92400e', border: '1px solid #fbbf24' }}
                >
                  ★ {formatCompName(c)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Léptető gombok és indikátorok */}
      {items && items.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIdx(prev => (prev - 1 + items.length) % items.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-1 shadow"
            style={{ color: '#92400e' }}
            aria-label="Előző"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => setCurrentIdx(prev => (prev + 1) % items.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-1 shadow"
            style={{ color: '#92400e' }}
            aria-label="Következő"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className="rounded-full transition-all"
                style={{
                  width: idx === currentIdx ? '16px' : '6px',
                  height: '6px',
                  backgroundColor: idx === currentIdx ? '#92400e' : '#fbbf24'
                }}
                aria-label={`${idx + 1}. bejegyzés`}
              />
            ))}
          </div>
        </>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const accentColor = accent === 'red' ? COLORS.red : COLORS.blue;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: accentColor }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-2xl font-bold" style={{ color: COLORS.blueDark }}>
        {value === null ? <Loader className="w-5 h-5 animate-spin text-gray-400" /> : value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLUB RANKINGS WIDGET — helyezési táblázat klubszintű (v0.9.8)
// 1-8. helyezésig, kategóriánként (FIG / MB / Regionális / Diákolimpia / Klub)
// ═══════════════════════════════════════════════════════════════════

function ClubRankingsWidget() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [rankings, setRankings] = useState(null);
  const [competitionCount, setCompetitionCount] = useState({ total: 0, byImportance: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const IMPORTANCE_ROWS = [
    { key: 'fig', label: 'FIG nemzetközi' },
    { key: 'nemzetkozi', label: 'Nemzetközi' }, // v0.9.56
    { key: 'mrgsz_mb', label: 'MRGSZ Magyar Bajnokság' },
    { key: 'mrgsz_regional', label: 'MRGSZ Regionális' },
    { key: 'diakolimpia', label: 'Diákolimpia' },
    { key: 'club', label: 'Klubverseny / Kisverseny' }
  ];

  // Elérhető évek dinamikusan a competitions táblából
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('competitions')
          .select('start_date')
          .eq('is_finalized', true);
        if (!active) return;
        
        const yearSet = new Set();
        const currentYear = new Date().getFullYear();
        yearSet.add(currentYear); // mindig legyen idei év
        (data || []).forEach(c => {
          if (c.start_date) {
            const y = parseInt(c.start_date.slice(0, 4), 10);
            if (!isNaN(y)) yearSet.add(y);
          }
        });
        // v0.9.59: az utólag rögzített eredmények évei is
        const { data: hy } = await supabase.from('historical_results').select('year');
        if (!active) return;
        (hy || []).forEach(h => { if (h.year) yearSet.add(h.year); });
        
        const years = Array.from(yearSet).sort((a, b) => b - a); // csökkenő
        setAvailableYears(years);
      } catch (err) {
        console.error('Available years load error:', err);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        // Idei versenyek lekérdezése — CSAK véglegesített (is_finalized = true)
        const { data: comps, error: compErr } = await supabase
          .from('competitions')
          .select('id, importance, start_date, is_finalized')
          .gte('start_date', yearStart)
          .lte('start_date', yearEnd)
          .eq('is_finalized', true);
        if (compErr) throw compErr;

        const allCompIds = (comps || []).map(c => c.id);
        const compImportanceMap = {};
        const countByImp = {};
        (comps || []).forEach(c => {
          // v0.9.49: a versenyek modulja 'mrgsz_reg' / 'klub' kódot ír, itt 'mrgsz_regional' / 'club' a kulcs
          const imp = normImportance(c.importance);
          compImportanceMap[c.id] = imp;
          countByImp[imp] = (countByImp[imp] || 0) + 1;
        });

        // Klub-csapat eredmények (csapat versenyek)
        let teamPlacements = [];
        if (allCompIds.length > 0) {
          const { data: teams, error: tErr } = await supabase
            .from('competition_teams')
            .select('competition_id, placement, name')
            .in('competition_id', allCompIds)
            .not('placement', 'is', null);
          if (tErr) throw tErr;
          // v0.9.49: csak a csepeli csapatok helyezései számítanak
          teamPlacements = (teams || []).filter(t => isCsepeliTeamName(t.name));
        }

        // Egyéni eredmények csak csepeli versenyzőkre, csak véglegesített kategóriákban
        // results → competition_categories → competition_days → competitions
        // startlist_entries.competitor_id != null (csak csepeli)
        let individualPlacements = [];
        if (allCompIds.length > 0) {
          const { data: dayData, error: dErr } = await supabase
            .from('competition_days')
            .select('id, competition_id')
            .in('competition_id', allCompIds);
          if (dErr) throw dErr;
          const dayMap = {};
          (dayData || []).forEach(d => { dayMap[d.id] = d.competition_id; });

          const dayIds = (dayData || []).map(d => d.id);
          if (dayIds.length > 0) {
            const { data: catData, error: cErr } = await supabase
              .from('competition_categories')
              .select('id, competition_day_id, type, is_finalized')
              .in('competition_day_id', dayIds)
              .eq('type', 'egyeni');
            if (cErr) throw cErr;

            const catMap = {};
            (catData || []).forEach(c => { catMap[c.id] = dayMap[c.competition_day_id]; });
            const categoryIds = (catData || []).map(c => c.id);

            if (categoryIds.length > 0) {
              const { data: entries, error: eErr } = await supabase
                .from('startlist_entries')
                .select('id, competition_category_id, competitor_id, apparatus, did_not_start')
                .in('competition_category_id', categoryIds)
                .not('competitor_id', 'is', null);
              if (eErr) throw eErr;

              const entryToCompMap = {};
              (entries || []).forEach(e => {
                entryToCompMap[e.id] = catMap[e.competition_category_id];
              });

              const entryIds = (entries || []).map(e => e.id);
              if (entryIds.length > 0) {
                const { data: results, error: rErr } = await supabase
                  .from('results')
                  .select('startlist_entry_id, score_total, score_e, score_d, score_a, placement')
                  .in('startlist_entry_id', entryIds);
                if (rErr) throw rErr;

                // Helyezések számítása kategóriánként
                // Csoportosítás kategóriánként, majd rendezés
                // v0.9.59: a mentett (hivatalos / lezáráskor beírt) helyezés az irányadó;
                // ahol nincs, ott szerenként számolunk (mint a pontozó és a lezárás)
                const resultsByCategory = {};
                (results || []).forEach(r => {
                  const entry = entries.find(e => e.id === r.startlist_entry_id);
                  if (!entry || entry.did_not_start) return;
                  if (r.placement) {
                    if (r.placement <= 8) {
                      individualPlacements.push({ placement: r.placement, competition_id: entryToCompMap[r.startlist_entry_id] });
                    }
                    return;
                  }
                  if (r.score_total === null || r.score_total === undefined) return;
                  const catId = `${entry.competition_category_id}__${entry.apparatus || '__none__'}`;
                  if (!resultsByCategory[catId]) resultsByCategory[catId] = [];
                  resultsByCategory[catId].push({ ...r, _entry: entry });
                });

                Object.entries(resultsByCategory).forEach(([catId, catResults]) => {
                  // Rendezés tie-break: Total → E → D → A
                  catResults.sort((a, b) => {
                    if (Math.abs((b.score_total || 0) - (a.score_total || 0)) > 0.001) return (b.score_total || 0) - (a.score_total || 0);
                    if (Math.abs((b.score_e || 0) - (a.score_e || 0)) > 0.001) return (b.score_e || 0) - (a.score_e || 0);
                    if (Math.abs((b.score_d || 0) - (a.score_d || 0)) > 0.001) return (b.score_d || 0) - (a.score_d || 0);
                    return (b.score_a || 0) - (a.score_a || 0);
                  });
                  catResults.forEach((r, idx) => {
                    const placement = idx + 1;
                    if (placement <= 8) {
                      individualPlacements.push({
                        placement,
                        competition_id: entryToCompMap[r.startlist_entry_id]
                      });
                    }
                  });
                });
              }
            }
          }
        }

        // v0.9.59: utólag rögzített (korábbi) eredmények az adott évből — egyéni
        // (szerek + összetett) és EKCS (együttes csapat). A csapat eredményét minden
        // csapattag külön rögzíti, ezért csapatonként csak EGYSZER számoljuk.
        const histIndividual = []; // { placement, imp }
        const histTeam = [];       // { placement, imp }
        const histComps = new Set();
        {
          const { data: hist, error: hErr } = await supabase
            .from('historical_results')
            .select('year, competition_date, competition_name, competition_type, importance, team_name, results')
            .eq('year', year);
          if (hErr) throw hErr;
          const seenTeams = new Set();
          (hist || []).forEach(h => {
            const imp = normImportance(h.importance);
            const r = h.results || {};
            const compKey = `${(h.competition_name || '').trim().toLowerCase()}|${h.competition_date || h.year}|${imp}`;
            let counted = false;
            if (h.competition_type === 'egyeni') {
              ['szabad', 'karika', 'labda', 'buzogany', 'szalag', 'kotel', 'osszetett'].forEach(k => {
                const pl = r[k]?.placement;
                if (pl >= 1 && pl <= 8) { histIndividual.push({ placement: pl, imp }); counted = true; }
              });
            } else if (h.competition_type === 'egyuttes') {
              const pl = r.csapat?.placement;
              if (pl >= 1 && pl <= 8) {
                const teamKey = `${compKey}|${(h.team_name || '').trim().toLowerCase()}|${pl}`;
                if (!seenTeams.has(teamKey)) { seenTeams.add(teamKey); histTeam.push({ placement: pl, imp }); }
                counted = true;
              }
            }
            if (counted && !histComps.has(compKey)) {
              histComps.add(compKey);
              countByImp[imp] = (countByImp[imp] || 0) + 1;
            }
          });
        }

        // Számolás: kategóriánként + típus szerint
        const result = {};
        IMPORTANCE_ROWS.forEach(r => {
          result[r.key] = { individual: {}, team: {} };
          for (let i = 1; i <= 8; i++) {
            result[r.key].individual[i] = 0;
            result[r.key].team[i] = 0;
          }
        });

        individualPlacements.forEach(ip => {
          const imp = compImportanceMap[ip.competition_id];
          if (!imp || !result[imp]) return;
          if (ip.placement >= 1 && ip.placement <= 8) {
            result[imp].individual[ip.placement]++;
          }
        });

        teamPlacements.forEach(tp => {
          const imp = compImportanceMap[tp.competition_id];
          if (!imp || !result[imp]) return;
          if (tp.placement >= 1 && tp.placement <= 8) {
            result[imp].team[tp.placement]++;
          }
        });

        histIndividual.forEach(h => { if (result[h.imp]) result[h.imp].individual[h.placement]++; });
        histTeam.forEach(h => { if (result[h.imp]) result[h.imp].team[h.placement]++; });

        if (!active) return;
        setRankings(result);
        setCompetitionCount({
          total: (comps || []).length + histComps.size,
          historical: histComps.size,
          byImportance: countByImp
        });
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [year]);

  // Helyezés render
  const renderPlacements = (placementMap) => {
    const items = [];
    for (let i = 1; i <= 8; i++) {
      if (placementMap[i] > 0) {
        items.push({ place: i, count: placementMap[i] });
      }
    }
    if (items.length === 0) return <span style={{ color: '#9CA3AF' }}>—</span>;

    const getStyle = (place) => {
      // 1. arany, 2. ezüst, 3. bronz, 4-8 halvány szürke
      if (place === 1) return { bg: '#FAEEDA', color: '#854F0B', icon: '🥇' };
      if (place === 2) return { bg: '#F1EFE8', color: '#444441', icon: '🥈' };
      if (place === 3) return { bg: '#FAECE7', color: '#712B13', icon: '🥉' };
      return { bg: '#F9FAFB', color: '#6B7280', icon: null };
    };

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
        {items.map(({ place, count }) => {
          const s = getStyle(place);
          return (
            <span
              key={place}
              style={{
                backgroundColor: s.bg,
                color: s.color,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              {count}×{s.icon || `${place}.`}
            </span>
          );
        })}
      </div>
    );
  };

  const importanceLabel = (key) => {
    if (key === 'fig') return 'FIG';
    if (key === 'nemzetkozi') return 'Nemz.';
    if (key === 'mrgsz_mb') return 'MB';
    if (key === 'mrgsz_regional') return 'Reg.';
    if (key === 'diakolimpia') return 'Diák';
    if (key === 'club') return 'Klub';
    return key;
  };

  const compSummary = () => {
    const parts = [];
    IMPORTANCE_ROWS.forEach(r => {
      const cnt = competitionCount.byImportance[r.key] || 0;
      if (cnt > 0) parts.push(`${cnt} ${importanceLabel(r.key)}`);
    });
    return parts.length > 0 ? parts.join(' · ') : 'nincs verseny';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: '#B45309' }} />
            <h3 className="font-semibold text-sm" style={{ color: COLORS.blueDark }}>
              Egyéni helyezések {year}
            </h3>
          </div>
          {!loading && (
            <div className="text-xs text-gray-500 mt-0.5">
              {competitionCount.total > 0 
                ? `${competitionCount.total} verseny${competitionCount.historical ? ` (ebből ${competitionCount.historical} utólag rögzített)` : ''}: ${compSummary()}`
                : 'Még nincs véglegesített verseny ebben az évben'}
            </div>
          )}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="text-xs border border-gray-300 rounded px-2 py-1"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-4">
          <Loader className="w-4 h-4 animate-spin text-gray-400 inline" />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 p-2 bg-red-50 rounded">{error}</div>
      )}

      {!loading && !error && rankings && (
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #E5E7EB' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#6B7280', fontSize: '12px' }}>Verseny</th>
              <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500, color: '#6B7280', fontSize: '12px' }}>Egyéni</th>
              <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500, color: '#6B7280', fontSize: '12px' }}>Csapat</th>
            </tr>
          </thead>
          <tbody>
            {IMPORTANCE_ROWS.map(row => (
              <tr key={row.key} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                <td style={{ padding: '8px 4px' }}>{row.label}</td>
                <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                  {renderPlacements(rankings[row.key].individual)}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                  {renderPlacements(rankings[row.key].team)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlaceholderView({ title, message }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold mb-2" style={{ color: COLORS.blueDark }}>{title}</h2>
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  const auth = useAuth();
  
  if (auth.loading) return <LoadingScreen message="Csatlakozás..." />;

  return (
    <AuthContext.Provider value={auth}>
      <DataReloadProvider>
        {auth.session && auth.profile ? <AppShell /> : <LoginScreen />}
      </DataReloadProvider>
    </AuthContext.Provider>
  );
}
