// ═══════════════════════════════════════════════════════════════════
// Edzői bejegyzések (v0.9.80) — Sándor + Kata 2026.10.15: az edzőknek az
// „Edzői napló” menü helyett egy közös hely, alatta: Edzői napló, Klub
// büszkesége (eddig az Adminisztrációban), Üzenőfal. A szülő továbbra is az
// „Edzői napló” menüt látja (a gyereke bejegyzései).
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Lock, Star, MessageCircle } from 'lucide-react';
import { CoachNotesView } from './coach-notes';
import { AdminClubPride } from './admin';
import { EventsView } from './events';

const PRIDE_EDITORS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];

export function CoachPostsView({ supabase, userRole, profile }) {
  const [tab, setTab] = useState('notes');
  const tabs = [
    { id: 'notes', label: 'Edzői napló', icon: Lock },
    ...(PRIDE_EDITORS.includes(userRole) ? [{ id: 'pride', label: 'Klub büszkesége', icon: Star }] : []),
    { id: 'events', label: 'Üzenőfal', icon: MessageCircle }
  ];
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold" style={{ color: '#1e3a8a' }}>Edzői bejegyzések</h2>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className="px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: tab === id ? 'white' : 'transparent', color: tab === id ? '#1D4ED8' : '#374151',
                           boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'notes' && <CoachNotesView supabase={supabase} userRole={userRole} profile={profile} />}
      {tab === 'pride' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"><AdminClubPride supabase={supabase} /></div>
      )}
      {tab === 'events' && <EventsView supabase={supabase} userRole={userRole} />}
    </div>
  );
}
