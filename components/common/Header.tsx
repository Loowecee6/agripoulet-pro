import React, { useState } from 'react';
import { ClipboardList, ShieldCheck, Bell, LogOut, X, Syringe, AlertTriangle, CreditCard, Settings, Moon, Sun, Users } from 'lucide-react';
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
  onOpenNotifSettings?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenUserManagement?: () => void;
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

export const Header = ({ user, onLogout, notifications, overdueCount, notificationEvents = [], isSyncing, isOnline, hasPendingSync, pendingSyncCount, onOpenNotifSettings, darkMode, onToggleDarkMode, onOpenUserManagement }: HeaderProps) => {
  const [showNotifs, setShowNotifs] = useState(false);

  const dangerCount = notificationEvents.filter(e => e.severity === 'danger').length;
  const totalNotifCount = notifications.length + notificationEvents.filter(e => e.severity === 'danger' || e.severity === 'warning').length;
  return (
    <header className="bg-orange-600 text-white p-4 shadow-lg sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-none">AgriPoulet Pro</h1>
              <ConnectionStatus
                isOnline={isOnline}
                isSyncing={isSyncing}
                hasPendingSync={hasPendingSync}
                pendingCount={pendingSyncCount}
              />
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
    </header>
  );
};
