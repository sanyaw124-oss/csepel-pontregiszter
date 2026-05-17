// ═══════════════════════════════════════════════════════════════════
// PONTREGISZTER v0.9.25 — FEJLŐDÉSI GRAFIKON
// Versenyző profilon: Recharts vonalgrafikon
// Toggle: Szerenként ⇄ Összetett
// Adatforrás: results (csepeli) + historical_results (régebbi)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Loader, BarChart3 } from 'lucide-react';

const COLORS = {
  blueDark: '#1e3a8a',
  red: '#BE123C',
  gray200: '#e5e7eb'
};

// Szer-színek (RG hagyomány szerint)
const SZER_SZIN = {
  'karika':    '#DC2626', // piros
  'labda':     '#2563EB', // kék
  'buzogany':  '#16A34A', // zöld
  'szalag':    '#EAB308', // sárga
  'kotel':     '#A855F7', // lila
  'szabad':    '#64748B'  // szürke
};

const SZER_LABEL = {
  'karika':   'Karika',
  'labda':    'Labda',
  'buzogany': 'Buzogány',
  'szalag':   'Szalag',
  'kotel':    'Kötél',
  'szabad':   'Szabad'
};

// Magyar dátumformátum (rövid)
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// Verseny név rövidítése grafikon X tengelyhez
function shortenName(name, max = 16) {
  if (!name) return '';
  if (name.length <= max) return name;
  return name.substring(0, max - 1) + '…';
}

export function CompetitorProgressChart({ supabase, competitorId }) {
  const [results, setResults] = useState(null);
  const [historical, setHistorical] = useState(null);
  const [error, setError] = useState(null);
  // Alap: összetett nézet (egyszerűbb, áttekinthetőbb)
  const [mode, setMode] = useState('osszetett'); // 'osszetett' | 'szerenkent'

  const load = useCallback(async () => {
    setError(null);
    try {
      // 1) Egyéni szer-eredmények (csak lezárt versenyekből)
      const { data: resData, error: resErr } = await supabase
        .from('results')
        .select(`
          apparatus, score_total,
          startlist_entry:startlist_entries!inner(
            competitor_id,
            competition_category:competition_categories!inner(
              competition_day:competition_days!inner(
                competition_id,
                competition:competitions!inner(id, name, start_date, is_finalized)
              )
            )
          )
        `)
        .eq('startlist_entry.competitor_id', competitorId);

      if (resErr) throw resErr;

      // 2) Régebbi (historical) eredmények
      const { data: histData, error: histErr } = await supabase
        .from('historical_results')
        .select('id, competition_name, competition_date, apparatus, score_total, score_osszetett')
        .eq('competitor_id', competitorId)
        .order('competition_date', { ascending: true });

      if (histErr) throw histErr;

      setResults(resData || []);
      setHistorical(histData || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
      setHistorical([]);
    }
  }, [supabase, competitorId]);

  useEffect(() => { load(); }, [load]);

  // Adat összeállítása: minden versenyhez egy pont, szerekkel
  const chartData = useMemo(() => {
    if (!results || !historical) return null;

    // Map<competitionKey, { name, date, szerek: {karika, labda, ...}, osszetett }>
    const map = new Map();

    // results → csak finalized versenyek
    for (const r of results) {
      const comp = r.startlist_entry?.competition_category?.competition_day?.competition;
      if (!comp || !comp.is_finalized) continue;
      const key = `live-${comp.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: comp.name,
          date: comp.start_date,
          szerek: {},
          osszetett: 0
        });
      }
      const entry = map.get(key);
      const apparatus = (r.apparatus || '').toLowerCase();
      if (apparatus && r.score_total != null) {
        // Ha többször szerepelne ugyanaz a szer (pl. javítás), a legmagasabbat tartjuk
        const prev = entry.szerek[apparatus] || 0;
        if (r.score_total > prev) entry.szerek[apparatus] = r.score_total;
      }
    }

    // historical → mindegyik bejön
    for (const h of historical) {
      const key = `hist-${h.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: h.competition_name,
          date: h.competition_date,
          szerek: {},
          osszetett: h.score_osszetett || 0
        });
      }
      const entry = map.get(key);
      const apparatus = (h.apparatus || '').toLowerCase();
      if (apparatus && h.score_total != null) {
        entry.szerek[apparatus] = h.score_total;
      }
      // Ha az összetett be van adva, írjuk be
      if (h.score_osszetett != null && h.score_osszetett > 0) {
        entry.osszetett = h.score_osszetett;
      }
    }

    // Összetett számítása (ha még nincs): szerek összege
    const arr = Array.from(map.values()).map(e => {
      let osszetett = e.osszetett;
      if (!osszetett || osszetett === 0) {
        osszetett = Object.values(e.szerek).reduce((s, v) => s + (v || 0), 0);
      }
      return {
        ...e,
        osszetett: Math.round(osszetett * 100) / 100,
        // X tengely címke
        label: shortenName(e.name) + '\n' + formatDateShort(e.date)
      };
    });

    // Dátum szerint növekvő
    arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return arr;
  }, [results, historical]);

  // Mely szerek szerepeltek egyáltalán
  const usedSzerek = useMemo(() => {
    if (!chartData) return [];
    const s = new Set();
    chartData.forEach(d => Object.keys(d.szerek).forEach(k => s.add(k)));
    // Hagyományos sorrend
    return ['karika', 'labda', 'buzogany', 'szalag', 'kotel', 'szabad']
      .filter(k => s.has(k));
  }, [chartData]);

  // Render
  if (chartData === null) {
    return (
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: COLORS.gray200 }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5" style={{ color: COLORS.blueDark }} />
          <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>Fejlődési grafikon</h3>
        </div>
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: COLORS.gray200 }}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5" style={{ color: COLORS.blueDark }} />
          <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>Fejlődési grafikon</h3>
        </div>
        <div className="text-sm text-red-600">Hiba: {error}</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: COLORS.gray200 }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5" style={{ color: COLORS.blueDark }} />
          <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>Fejlődési grafikon</h3>
        </div>
        <div className="text-center py-6 text-sm text-gray-500 italic">
          Még nincs elég eredmény a grafikonhoz.
        </div>
      </div>
    );
  }

  // Custom tooltip — verseny név + dátum + pontok
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border rounded-lg shadow-md p-3 text-sm" style={{ borderColor: COLORS.gray200 }}>
        <div className="font-semibold mb-1" style={{ color: COLORS.blueDark }}>{data.name}</div>
        <div className="text-xs text-gray-500 mb-2">{formatDateShort(data.date)}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
            <span>{p.name}: <strong>{(p.value != null ? p.value.toFixed(2) : '—')}</strong></span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: COLORS.gray200 }}>
      {/* Fejléc + toggle */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color: COLORS.blueDark }} />
          <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>Fejlődési grafikon</h3>
          <span className="text-xs text-gray-500">({chartData.length} verseny)</span>
        </div>

        {/* Mód kapcsoló */}
        <div className="inline-flex border rounded-lg overflow-hidden" style={{ borderColor: COLORS.gray200 }}>
          <button
            type="button"
            onClick={() => setMode('osszetett')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'osszetett'
                ? 'text-white'
                : 'text-gray-700 bg-white hover:bg-gray-50'
            }`}
            style={mode === 'osszetett' ? { backgroundColor: COLORS.red } : {}}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Összetett
          </button>
          <button
            type="button"
            onClick={() => setMode('szerenkent')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'szerenkent'
                ? 'text-white'
                : 'text-gray-700 bg-white hover:bg-gray-50'
            }`}
            style={mode === 'szerenkent' ? { backgroundColor: COLORS.blueDark } : {}}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Szerenként
          </button>
        </div>
      </div>

      {/* Grafikon */}
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748B' }}
              angle={-25}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748B' }}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            {mode === 'osszetett' ? (
              <Line
                type="monotone"
                dataKey="osszetett"
                name="Összetett"
                stroke={COLORS.red}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLORS.red }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ) : (
              <>
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 5 }}
                  iconType="line"
                />
                {usedSzerek.map(sz => (
                  <Line
                    key={sz}
                    type="monotone"
                    dataKey={`szerek.${sz}`}
                    name={SZER_LABEL[sz] || sz}
                    stroke={SZER_SZIN[sz] || '#888'}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SZER_SZIN[sz] || '#888' }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lábléc info */}
      <div className="text-xs text-gray-500 mt-2 italic">
        {mode === 'osszetett'
          ? 'Az összetett pontszám alakulása versenyről versenyre.'
          : 'Minden szer külön vonal — váltogasd a "Csak ezt" funkcióval a legenda kattintásával.'}
      </div>
    </div>
  );
}
