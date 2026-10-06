// ═══════════════════════════════════════════════════════════════════
// Statisztika menü az edzőknek (v0.9.67) — Sándor 2026.10.06: „edzőnézetben
// egy statisztika rész, ahol mindent célzottan le tudnak kérdezni, és pdf
// generálás előtt tudnak írni edzői értékelést”.
//   - Versenyző: kiválasztás → edzői értékelés (mentés a gyerekhez) →
//     évösszefoglaló PDF (az értékeléssel), statisztika, kitűzők
//   - Klub: edzéslátogatás, érmek korosztályonként, legtöbbet fejlődők —
//     korosztály / kategória szerint szűrve
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search, User, Users } from 'lucide-react';
import { formatCompetitorName, huSortByNickname } from './names';
import { CompetitorStatsPanel } from './stats';
import { BadgesPanel } from './badges';
import { EvaluationEditor } from './evaluation';
import { SeasonSummaryButton } from './seasonSummary';
import { ClubStatsWidget } from './clubStats';

const WRITERS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];

export function StatsView({ supabase, userRole }) {
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState('competitor');
  const [competitors, setCompetitors] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [year, setYear] = useState(currentYear);
  const [evalVersion, setEvalVersion] = useState(0);

  useEffect(() => {
    supabase.from('competitors')
      .select('id, full_name, nickname, kategoria, korosztaly, birth_year')
      .eq('is_active', true).eq('is_club_member', true)
      .then(({ data }) => setCompetitors([...(data || [])].sort(huSortByNickname)));
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return competitors;
    return competitors.filter(c => `${c.full_name} ${c.nickname || ''} ${c.korosztaly || ''} ${c.kategoria || ''}`.toLowerCase().includes(q));
  }, [competitors, search]);

  const selected = competitors.find(c => c.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#1e3a8a' }}>
        <BarChart3 className="w-6 h-6" /> Statisztika
      </h2>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['competitor', 'Versenyző', User], ['club', 'Klub', Users]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className="px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: tab === id ? 'white' : 'transparent', color: tab === id ? '#1D4ED8' : '#374151',
                           boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'club' && <ClubStatsWidget supabase={supabase} />}

      {tab === 'competitor' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-3 flex flex-wrap gap-2 items-center" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Keresés név, korosztály, kategória…"
                     className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded" />
            </div>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                    className="text-sm px-2 py-1.5 border border-gray-300 rounded bg-white min-w-[220px]">
              <option value="">— válassz versenyzőt ({filtered.length}) —</option>
              {filtered.map(c => (
                <option key={c.id} value={c.id}>{formatCompetitorName(c)}{c.korosztaly ? ` · ${c.korosztaly}` : ''}</option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))} className="text-sm px-2 py-1.5 border border-gray-300 rounded bg-white">
              {[0, 1, 2, 3, 4].map(d => currentYear - d).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {!selected ? (
            <div className="text-sm text-gray-500 italic px-1">Válassz versenyzőt a statisztikájához, az edzői értékeléshez és az évösszefoglalóhoz.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-lg font-bold" style={{ color: '#1e3a8a' }}>
                {formatCompetitorName(selected)}
                <span className="text-sm font-normal text-gray-500"> · {selected.kategoria || ''} {selected.korosztaly || ''}</span>
              </div>

              {WRITERS.includes(userRole) && (
                <EvaluationEditor supabase={supabase} competitorId={selected.id} year={year}
                                  onSaved={() => setEvalVersion(v => v + 1)} />
              )}
              <SeasonSummaryButton key={`${selected.id}_${evalVersion}`} supabase={supabase} competitor={selected} defaultYear={year} />
              <CompetitorStatsPanel key={`s_${selected.id}`} supabase={supabase} competitorId={selected.id} />
              <BadgesPanel key={`b_${selected.id}`} supabase={supabase} competitorId={selected.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
