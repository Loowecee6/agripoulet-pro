// components/common/ActivityLogView.tsx
// Journal d'activité — consultation des actions utilisateurs

import React, { useState, useMemo } from 'react';
import { Clock, Filter, Search, ShieldCheck, UserCircle } from 'lucide-react';
import { formatDateWithTime } from '../../utils/dateFormat';
import { ActivityLogEntry, ActivityAction, User } from '../../types';
import { formatAction, filterLogByDays } from '../../services/activityLogger';

interface ActivityLogViewProps {
  log: ActivityLogEntry[];
  currentUser: User;
}

const ACTION_GROUPS: { label: string; actions: ActivityAction[] }[] = [
  { label: 'Production', actions: ['production.create', 'production.edit', 'production.delete', 'production.close', 'production.suivi', 'production.vaccination', 'production.expense'] },
  { label: 'Stock', actions: ['stock.create', 'stock.edit', 'stock.delete', 'stock.finalize'] },
  { label: 'Ventes', actions: ['ventes.create', 'ventes.edit', 'ventes.delete', 'ventes.payment'] },
  { label: 'Clients', actions: ['clients.create', 'clients.edit', 'clients.delete'] },
  { label: 'Réservations', actions: ['reservations.create', 'reservations.edit', 'reservations.delete'] },
  { label: 'Paramètres', actions: ['settings.edit', 'settings.password', 'users.create', 'users.edit', 'users.delete'] },
  { label: 'Sauvegardes', actions: ['backup.create', 'backup.restore', 'backup.delete'] },
  { label: 'Connexion', actions: ['login', 'logout'] },
];

const PERIODS = [
  { label: 'Aujourd\'hui', days: 1 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: 'Tout', days: 0 },
];

export const ActivityLogView = ({ log, currentUser }: ActivityLogViewProps) => {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(7);
  const [selectedGroup, setSelectedGroup] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    let result = period > 0 ? filterLogByDays(log, period) : [...log];

    // Filtre par groupe d'actions
    if (selectedGroup !== 'all') {
      const groupActions = ACTION_GROUPS.find(g => g.label === selectedGroup)?.actions || [];
      result = result.filter(e => groupActions.includes(e.action));
    }

    // Filtre texte
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q) ||
        formatAction(e.action).toLowerCase().includes(q)
      );
    }

    return result;
  }, [log, period, selectedGroup, search]);

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
              period === p.days
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
            selectedGroup === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter className="w-3 h-3 inline-block mr-1" />
          Toutes
        </button>
        {ACTION_GROUPS.map(g => (
          <button
            key={g.label}
            onClick={() => setSelectedGroup(g.label)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
              selectedGroup === g.label
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher dans le journal..."
          className="w-full pl-8 pr-3 py-2 text-xs border rounded-xl bg-gray-50 outline-none focus:border-orange-400 transition-colors"
        />
      </div>

      {/* Liste */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
            Aucune activité trouvée
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                entry.userId === currentUser.id ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
                <UserCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-800 truncate">{entry.userName}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                    entry.userRole === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                    entry.userRole === 'admin' ? 'bg-orange-100 text-orange-700' :
                    entry.userRole === 'manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {entry.userRole === 'super_admin' ? 'Super Admin' :
                     entry.userRole === 'admin' ? 'Admin' :
                     entry.userRole === 'manager' ? 'Manager' : 'Vue'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{entry.description}</div>
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <div className="text-[8px] text-gray-400 mt-0.5 font-mono">
                    {JSON.stringify(entry.details).slice(0, 80)}
                    {JSON.stringify(entry.details).length > 80 ? '...' : ''}
                  </div>
                )}
              </div>
              <div className="text-[8px] text-gray-400 shrink-0 text-right whitespace-nowrap">
                {formatDateWithTime(entry.date)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="text-[8px] text-gray-400 text-center pt-1">
        {filtered.length} entrée{filtered.length > 1 ? 's' : ''} • {
          log.length
        } total • max 500 entrées
      </div>
    </div>
  );
};
