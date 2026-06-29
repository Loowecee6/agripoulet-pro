import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Bell, LogOut, X, Syringe, AlertTriangle, CreditCard, Settings, Moon, Sun, Users, KeyRound } from 'lucide-react';
import { User, Sale } from '../../types';
import { ConnectionStatus } from './ConnectionStatus';
import type { NotificationEvent } from '../../services/notificationService';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  notifications: Sale[];
  overdueCount: number;
  notificationEvents?: NotificationEvent[];
  isSyncing: boolean;
  isOnline: boolean;
  hasPendingSync: boolean;
  pendingSyncCount: number;
  syncError?: string | null;
  onOpenNotifSettings?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenUserManagement?: () => void;
  onClaimAdmin?: (code: string) => Promise<boolean>;
  currentSeason?: {
    icon: string;
    label: string;
    temperature: string;
    monthsLabel: string;
  };
  seasonWarning?: string | null;
  onSeasonOffsetChange?: (offset: number) => void;
  seasonOffset?: number;
  onForceSync?: () => void;
  isForcingSync?: boolean;
}

const notifIcons: Record<string, React.ReactNode> = {
  vaccination: <Syringe className="w-3.5 h-3.5" />,
  mortalite: <AlertTriangle className="w-3.5 h-3.5" />,
  credit: <CreditCard className="w-3.5 h-3.5" />,
};

const severityColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  danger: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  warning: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
};

export const Header = ({ user, onLogout, notifications, overdueCount, notificationEvents = [], isSyncing, isOnline, hasPendingSync, pendingSyncCount, syncError, onOpenNotifSettings, darkMode, onToggleDarkMode, onOpenUserManagement, onClaimAdmin, currentSeason, seasonWarning, onSeasonOffsetChange, seasonOffset = 0, onForceSync, isForcingSync }: HeaderProps) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSeasonControl, setShowSeasonControl] = useState(false);
  const [showClaimAdmin, setShowClaimAdmin] = useState(false);
  const [claimAdminCode, setClaimAdminCode] = useState('');
  const [claimAdminError, setClaimAdminError] = useState('');
  const [claimAdminLoading, setClaimAdminLoading] = useState(false);
  const seasonControlRef = useRef<HTMLDivElement>(null);

  // Fermer le popover saison au clic extérieur
  useEffect(() => {
    if (!showSeasonControl) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (seasonControlRef.current && !seasonControlRef.current.contains(e.target as Node)) {
        setShowSeasonControl(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSeasonControl]);

  const dangerCount = notificationEvents.filter(e => e.severity === 'danger').length;
  const totalNotifCount = notifications.length + notificationEvents.filter(e => e.severity === 'danger' || e.severity === 'warning').length;
  return (
    <header className="bg-orange-600 text-white shadow-lg sticky top-0 z-40">
      {syncError && (
        <div className="bg-red-600 text-white text-[10px] font-bold px-4 py-1.5 flex items-center gap-2 justify-center animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}
      <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-none">AgriPoulet Pro</h1>
              <ConnectionStatus
                isOnline={isOnline}
                isSyncing={isSyncing}
                hasPendingSync={hasPendingSync}
                pendingCount={pendingSyncCount}
              />
              {(hasPendingSync || user.role === 'admin' || user.role === 'super_admin') && onForceSync && (
                <button
                  onClick={onForceSync}
                  disabled={isForcingSync || isSyncing}
                  className="text-[10px] bg-white/15 hover:bg-white/25 disabled:opacity-50 rounded-lg px-1.5 py-0.5 transition-colors"
                  title="Forcer la synchronisation vers le serveur"
                >
                  {isForcingSync ? 'Sync…' : 'Sync'}
                </button>
              )}
              {currentSeason && (
                <div className="group relative">
                  <button
                    onClick={() => setShowSeasonControl(!showSeasonControl)}
                    className="text-[10px] cursor-pointer hover:bg-white/10 rounded-lg px-1 py-0.5 transition-colors"
                    title={`${currentSeason.label} (${currentSeason.monthsLabel}) — ${currentSeason.temperature}${seasonOffset !== 0 ? ` · décalage: ${seasonOffset}j` : ''}`}
                  >
                    {currentSeason.icon}
                  </button>
                  {seasonWarning && (
                    <div className="absolute top-full left-0 mt-1 bg-red-600 text-white text-[8px] rounded-lg px-2 py-1 whitespace-nowrap shadow-lg z-50 hidden group-hover:block">
                      {seasonWarning}
                    </div>
                  )}
                  {/* Contrôle de décalage saisonnier */}
                  {showSeasonControl && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-3 z-50 min-w-[180px]">
                      <div className="text-[9px] font-bold text-gray-700 dark:text-gray-300 mb-2">
                        🌍 Décalage saisonnier
                      </div>
                      <div className="text-[8px] text-gray-400 mb-2">
                        Ajustez si les saisons sont décalées (changement climatique)
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSeasonOffsetChange?.(seasonOffset - 7)}
                          disabled={seasonOffset <= -90}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm active:scale-90 transition-transform ${seasonOffset <= -90 ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                          title="Avancer les saisons de 7 jours"
                        >
                          −
                        </button>
                        <div className="flex-1 text-center">
                          <div className="text-sm font-black text-gray-800 dark:text-white">
                            {seasonOffset > 0 ? `+${seasonOffset}` : seasonOffset}
                          </div>
                          <div className="text-[7px] text-gray-400 uppercase tracking-wider">jours</div>
                        </div>
                        <button
                          onClick={() => onSeasonOffsetChange?.(seasonOffset + 7)}
                          disabled={seasonOffset >= 90}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm active:scale-90 transition-transform ${seasonOffset >= 90 ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                          title="Retarder les saisons de 7 jours"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onSeasonOffsetChange?.(0)}
                          className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-[9px] font-bold active:scale-90 transition-transform ml-1"
                          title="Réinitialiser"
                        >
                          ↺
                        </button>
                      </div>
                      <div className="text-[7px] text-gray-400 mt-2 text-center">
                        {seasonOffset > 0
                          ? `Saisons décalées de ${seasonOffset}j plus tard`
                          : seasonOffset < 0
                            ? `Saisons décalées de ${Math.abs(seasonOffset)}j plus tôt`
                            : 'Calendrier traditionnel'
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-orange-200 text-[10px] mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {user.name} ({user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrateur' : user.role === 'manager' ? 'Gestionnaire' : 'Consultation'})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="p-2 hover:bg-white/10 rounded-full" onClick={() => setShowNotifs(!showNotifs)}>
              <Bell className="w-5 h-5" />
              {totalNotifCount > 0 && (
                <span className={`absolute top-1 right-1 w-4 h-4 text-[10px] flex items-center justify-center rounded-full font-bold ${
                  dangerCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                }`}>
                  {totalNotifCount > 9 ? '9+' : totalNotifCount}
                </span>
              )}
            </button>
          </div>
          {onToggleDarkMode && (
            <button onClick={onToggleDarkMode} className="p-2 hover:bg-white/10 rounded-full">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          {(user.role === 'super_admin' || user.role === 'admin') && onOpenUserManagement && (
            <button onClick={onOpenUserManagement} className="p-2 hover:bg-white/10 rounded-full" title="Gérer les utilisateurs">
              <Users className="w-5 h-5" />
            </button>
          )}
          {(user.role !== 'super_admin' && user.role !== 'admin') && onClaimAdmin && (
            <button onClick={() => setShowClaimAdmin(true)} className="p-2 hover:bg-white/10 rounded-full" title="Réclamer le rôle Admin">
              <KeyRound className="w-5 h-5" />
            </button>
          )}
          <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>
      {showNotifs && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-2xl z-50 p-4 animate-in slide-in-from-top duration-200" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <div className="flex justify-between items-center mb-3 sticky top-0 bg-white z-10">
            <h3 className="text-gray-900 font-bold text-sm">Notifications</h3>
            <div className="flex items-center gap-1">
              {onOpenNotifSettings && (
                <button
                  onClick={onOpenNotifSettings}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                  title="Paramètres notifications"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setShowNotifs(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          </div>

          {/* ── Rappels & Alertes ── */}
          {notificationEvents.length > 0 && (
            <div className="mb-4">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Rappels & Alertes
              </div>
              <div className="space-y-1.5">
                {notificationEvents.map(event => {
                  const colors = severityColors[event.severity] || severityColors.info;
                  return (
                    <div key={event.id} className={`p-3 rounded-xl border ${colors.bg} ${colors.border}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colors.dot}`}>
                          {notifIcons[event.type] || <Bell className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold ${colors.text}`}>{event.title}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{event.body}</div>
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${colors.dot}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Échéances de crédit ── */}
          <div className="mb-3">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" /> Échéances de crédit
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-xs">
                <CreditCard className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                Aucune échéance à venir
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex gap-2 mb-3">
                  {overdueCount > 0 && (
                    <div className="flex-1 bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
                      <div className="text-lg font-black text-red-600">{overdueCount}</div>
                      <div className="text-[8px] text-red-500 uppercase font-black tracking-wider">En retard</div>
                    </div>
                  )}
                  {notifications.length - overdueCount > 0 && (
                    <div className="flex-1 bg-orange-50 rounded-xl p-2.5 text-center border border-orange-100">
                      <div className="text-lg font-black text-orange-600">{notifications.length - overdueCount}</div>
                      <div className="text-[8px] text-orange-500 uppercase font-black tracking-wider">À venir</div>
                    </div>
                  )}
                </div>

                {/* Credit list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(() => {
                    const now = new Date();
                    const sorted = [...notifications].sort((a, b) => {
                      const aOverdue = a.dueDate && new Date(a.dueDate) < now ? 1 : 0;
                      const bOverdue = b.dueDate && new Date(b.dueDate) < now ? 1 : 0;
                      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
                      return (a.dueDate || '').localeCompare(b.dueDate || '');
                    });
                    return sorted.map(n => {
                      const dueDate = n.dueDate ? new Date(n.dueDate) : null;
                      const isOverdue = dueDate && dueDate < now;
                      const diffDays = dueDate
                        ? isOverdue
                          ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
                          : Math.ceil((dueDate.getTime() - now.getTime()) / 86400000)
                        : null;
                      return (
                        <div key={n.id} className={`p-3 rounded-xl flex justify-between items-center ${
                          isOverdue
                            ? 'bg-red-50 border border-red-100'
                            : 'bg-orange-50 border border-orange-100'
                        }`}>
                          <div className="text-xs">
                            <div className={`font-bold ${isOverdue ? 'text-red-900' : 'text-orange-900'}`}>{n.clientNom}</div>
                            <div className={`text-[9px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                              {isOverdue
                                ? `🔴 ${diffDays}j de retard`
                                : `🟡 Échéance J-${diffDays}`
                              }
                            </div>
                          </div>
                          <div className={`font-black text-sm ${isOverdue ? 'text-red-900' : 'text-orange-900'}`}>
                            {n.total.toLocaleString('fr-FR')} F
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>

          {notificationEvents.length === 0 && notifications.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Aucune notification
            </div>
          )}
        </div>
      )}

      {/* Modal réclamation admin */}
      {showClaimAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowClaimAdmin(false); setClaimAdminCode(''); setClaimAdminError(''); }} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Réclamer le rôle Admin</h3>
            <p className="text-xs text-gray-500 mb-4">Entrez le code secret administrateur pour obtenir les droits complets.</p>
            {claimAdminError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-xs font-bold mb-3">{claimAdminError}</div>
            )}
            <input
              type="password"
              inputMode="numeric"
              value={claimAdminCode}
              onChange={(e) => { setClaimAdminCode(e.target.value); setClaimAdminError(''); }}
              placeholder="Code secret (4 chiffres)"
              className="w-full p-4 border-2 border-orange-200 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-orange-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowClaimAdmin(false); setClaimAdminCode(''); setClaimAdminError(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs"
              >Annuler</button>
              <button
                disabled={!claimAdminCode || claimAdminLoading}
                onClick={async () => {
                  setClaimAdminLoading(true);
                  setClaimAdminError('');
                  try {
                    const ok = await onClaimAdmin!(claimAdminCode);
                    if (ok) {
                      window.location.reload();
                    } else {
                      setClaimAdminError('Code incorrect.');
                    }
                  } catch {
                    setClaimAdminError('Erreur lors de la vérification.');
                  } finally {
                    setClaimAdminLoading(false);
                  }
                }}
                className="flex-1 py-3 bg-orange-600 text-white rounded-2xl font-bold text-xs disabled:opacity-50"
              >
                {claimAdminLoading ? 'Vérification...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </header>
  );
};
