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

const APP_VERSION = 'v6';

export default function App() {
  const { user, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isForcingSync, setIsForcingSync] = useState(false);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);

  // ── Vérification version : vide le cache local si le code a changé ──
  const [versionChecked, setVersionChecked] = useState(false);
  useEffect(() => {
    const cached = localStorage.getItem('app_version');
    if (cached !== APP_VERSION) {
      try {
        const req = indexedDB.deleteDatabase('agripoulet-pro');
        req.onsuccess = () => {};
        req.onerror = () => {};
      } catch (_) {}
      localStorage.setItem('app_version', APP_VERSION);
      setTimeout(() => window.location.reload(), 50);
    } else {
      setVersionChecked(true);
    }
  }, []);

  // ── Hook : Synchronisation Firestore + Offline Queue ──
  const isOnline = useOnlineStatus();

  const {
    isSyncing,
    syncError,
    hasPendingSync,
    pendingSyncCount,
  } = useSyncManager({ user, data, isInitialLoading, isOnline, isAdmin: userRole === 'admin' || userRole === 'super_admin' });

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
          getUserRole(user.uid, user.email || undefined, user.displayName || undefined),
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

  // ── Helper console + forceSync avec retour visuel ──
  const handleForceSync = useCallback(async () => {
    if (!user || !data || isForcingSync) return;
    setIsForcingSync(true);
    try {
      const ok = await storageService.forceSync(user.uid, data);
      if (ok) setSyncFlash('✅ Sync réussie');
      else {
        try {
          const { setDoc } = await import('firebase/firestore');
          const { doc } = await import('firebase/firestore');
          const { db } = await import('./services/firebaseConfig');
          await setDoc(doc(db, 'sharedData', 'singleton'), data);
          setSyncFlash('✅ Sync directe réussie');
        } catch (directErr: any) {
          setSyncFlash('❌ ' + (directErr?.message || 'Erreur inconnue'));
        }
      }
    } catch (e: any) {
      setSyncFlash('❌ ' + (e?.message || 'Erreur'));
    } finally {
      setIsForcingSync(false);
    }
  }, [user, data, isForcingSync]);

  useEffect(() => {
    if (syncFlash) {
      const t = setTimeout(() => setSyncFlash(null), 2500);
      return () => clearTimeout(t);
    }
  }, [syncFlash]);

  useEffect(() => {
    if (user && data) {
      (window as any).forceSyncToServer = handleForceSync;
    }
  }, [user, data, handleForceSync]);

  // ── État local : saison ──
  const [seasonOffset, setSeasonOffset] = useState(data?.settings.seasonOffset || 0);
  useEffect(() => {
    if (data?.settings.seasonOffset !== undefined) {
      setSeasonOffset(data.settings.seasonOffset);
    }
  }, [data?.settings.seasonOffset]);
  const season = useCurrentSeason(seasonOffset);

  // ── Blocage du rendu tant que la version n'est pas vérifiée ──
  if (!versionChecked) return null;

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
        {syncFlash && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl z-50 transition-all duration-300">
            {syncFlash}
          </div>
        )}
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
          onForceSync={handleForceSync}
          isForcingSync={isForcingSync}
        />
        <main className="flex-1 p-4 pb-24 overflow-y-auto scroll-smooth">
          {data && activeTab === 'dashboard' && <DashboardView data={data} onTabChange={setActiveTab} permissions={userPermissions} />}
          {data && activeTab === 'dashboard' && <ProductionGoals data={data} />}
          {data && activeTab === 'production' && userPermissions.includes('production.view') && (
            <ProductionView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'stock' && userPermissions.includes('stock.view') && (
            <StockView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'ventes' && userPermissions.includes('ventes.view') && (
            <VentesView data={data} setData={updateData} onTabChange={setActiveTab} permissions={userPermissions} />
          )}
          {data && activeTab === 'clients' && userPermissions.includes('clients.view') && (
            <ClientsView data={data} setData={updateData} />
          )}
          {data && activeTab === 'echeances' && userPermissions.includes('ventes.view') && (
            <EcheancesView data={data} />
          )}
          {data && activeTab === 'reservations' && (userPermissions.includes('reservations.create') || userPermissions.includes('reservations.edit')) && (
            <ReservationView data={data} setData={updateData} />
          )}
          {data && activeTab === 'rapport' && userPermissions.includes('rapports.view') && (
            <RapportView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {data && activeTab === 'facturier' && userPermissions.includes('ventes.facturier') && (
            <FacturierView data={data} setData={updateData} onBack={() => setActiveTab('dashboard')} darkMode={data.settings.darkMode} />
          )}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} permissions={userPermissions} />

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
