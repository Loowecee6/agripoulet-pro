import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { AppData, User, UserRole } from './types';
import { storageService } from './services/storageService';
import { useAuth } from './components/common/AuthProvider';
import { LoginScreen } from './components/common/LoginScreen';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ProductionView } from './components/views/ProductionView';
import { StockView } from './components/views/StockView';
import { VentesView } from './components/views/VentesView';
import { ClientsView } from './components/views/ClientsView';
import { RapportView } from './components/views/RapportView';
import { DashboardView } from './components/views/DashboardView';
import { ReservationView } from './components/views/ReservationView';
import { EcheancesView } from './components/views/EcheancesView';
import { FacturierView } from './components/views/FacturierView';
import { NotificationSettings } from './components/common/NotificationSettings';
import { getUserPermissions } from './utils/permissions';
import { UserManagement } from './components/common/UserManagement';
import { ProductionGoals } from './components/common/ProductionGoals';
import { useCurrentSeason } from './hooks/useCurrentSeason';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useSyncManager } from './hooks/useSyncManager';
import { useFCMNotifications } from './hooks/useFCMNotifications';
import { getUserRole } from './services/userService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const { user, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // ── Hook : Synchronisation Firestore + Offline Queue ──
  const isOnline = useOnlineStatus();

  const {
    isSyncing,
    syncError,
    hasPendingSync,
    pendingSyncCount,
  } = useSyncManager({ user, data, isInitialLoading, isOnline });

  // ── Hook : Auto-backup automatique ──
  useAutoBackup(data, user, isInitialLoading);

  // ── Hook : Notifications FCM + Vérifications ──
  const {
    notificationEvents,
    notifications,
    overdueCount,
  } = useFCMNotifications({ user, data, isInitialLoading, setData });

  // ── Chargement initial des données + rôle ──
  useEffect(() => {
    if (!user) {
      setData(null);
      setIsInitialLoading(false);
      return;
    }
    const init = async () => {
      setIsInitialLoading(true);
      try {
        const [cloudData, role] = await Promise.all([
          storageService.loadData(user.uid),
          getUserRole(user.uid),
        ]);
        setData(cloudData);
        setUserRole(role);
      } catch (err) {
        console.error('Erreur chargement initial:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    init();
  }, [user]);

  // ── État local : saison ──
  const [seasonOffset, setSeasonOffset] = useState(data?.settings.seasonOffset || 0);

  useEffect(() => {
    if (data?.settings.seasonOffset !== undefined) {
      setSeasonOffset(data.settings.seasonOffset);
    }
  }, [data?.settings.seasonOffset]);

  const season = useCurrentSeason(seasonOffset);

  // ── Helpers ──
  const updateData = (newData: AppData) => setData(newData);

  const currentUser = user
    ? ({ id: user.uid, name: user.displayName || user.email || 'Utilisateur', role: userRole || 'viewer' } as User)
    : null;

  const userPermissions = currentUser ? getUserPermissions(currentUser.role) : [];

  const updateNotificationPrefs = (prefs: AppData['settings']['notifications']) => {
    if (!data) return;
    setData({
      ...data,
      settings: {
        ...data.settings,
        notifications: prefs,
      },
    });
  };

  const handleSeasonOffsetChange = (newOffset: number) => {
    const clamped = Math.max(-90, Math.min(90, newOffset));
    setSeasonOffset(clamped);
    if (!data) return;
    setData({
      ...data,
      settings: {
        ...data.settings,
        seasonOffset: clamped,
      },
    });
  };

  const toggleDarkMode = () => {
    if (!data) return;
    setData({ ...data, settings: { ...data.settings, darkMode: !data.settings.darkMode } });
  };

  // ── États d'interface ──
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
        <p className="text-orange-900 font-bold animate-pulse">Initialisation du Cloud...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
        <p className="text-orange-900 font-bold animate-pulse">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className={`min-h-screen ${data?.settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'} max-w-md mx-auto relative shadow-2xl flex flex-col ${data?.settings.darkMode ? 'border-gray-800' : 'border-x border-gray-100'} font-sans selection:bg-orange-100`}
      >
        <Header
          user={currentUser}
          onLogout={signOutUser}
          notifications={notifications}
          overdueCount={overdueCount}
          notificationEvents={notificationEvents}
          isSyncing={isSyncing}
          isOnline={isOnline}
          hasPendingSync={hasPendingSync}
          pendingSyncCount={pendingSyncCount}
          syncError={syncError}
          onOpenNotifSettings={() => setShowNotifSettings(true)}
          darkMode={data?.settings.darkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenUserManagement={() => setShowUserManagement(true)}
          currentSeason={season.active || undefined}
          seasonWarning={season.data?.warning || null}
          onSeasonOffsetChange={handleSeasonOffsetChange}
          seasonOffset={seasonOffset}
        />
        <main className="flex-1 p-4 pb-24 overflow-y-auto scroll-smooth">
          {data && activeTab === 'dashboard' && <DashboardView data={data} onTabChange={setActiveTab} />}
          {data && activeTab === 'dashboard' && <ProductionGoals data={data} />}
          {data && activeTab === 'production' && (
            <ProductionView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'stock' && (
            <StockView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'ventes' && <VentesView data={data} setData={updateData} onTabChange={setActiveTab} />}
          {data && activeTab === 'clients' && <ClientsView data={data} setData={updateData} />}
          {data && activeTab === 'echeances' && <EcheancesView data={data} />}
          {data && activeTab === 'reservations' && <ReservationView data={data} setData={updateData} />}
          {data && activeTab === 'rapport' && (
            <RapportView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'facturier' && (
            <FacturierView data={data} onBack={() => setActiveTab('dashboard')} darkMode={data.settings.darkMode} />
          )}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Notification Settings Modal */}
        {data && (
          <NotificationSettings
            prefs={
              data.settings.notifications || {
                enabled: true,
                vaccinationReminders: true,
                mortalityAlerts: true,
                creditDeadlines: true,
              }
            }
            onSave={updateNotificationPrefs}
            isOpen={showNotifSettings}
            onClose={() => setShowNotifSettings(false)}
          />
        )}

        {/* User Management Modal */}
        {data && currentUser && (
          <UserManagement
            data={data}
            setData={setData}
            currentUser={currentUser}
            isOpen={showUserManagement}
            onClose={() => setShowUserManagement(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
