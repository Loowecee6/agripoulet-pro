import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { AppData } from './types';
import { storageService } from './services/storageService';
import { offlineService } from './services/offlineService';
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
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { NotificationSettings } from './components/common/NotificationSettings';
import { getUserPermissions } from './utils/permissions';
import { UserManagement } from './components/common/UserManagement';
import { ProductionGoals } from './components/common/ProductionGoals';
import {
  checkAllNotifications,
  showLocalNotificationsFor,
  requestNotificationPermission,
  initFCM,
  getFCMToken,
  resetShownNotifications,
  type NotificationEvent,
} from './services/notificationService';

export default function App() {
  const { user, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBatchCount = useRef(0);
  const lastAutoBackup = useRef<string>('');
  const fcmInitedRef = useRef(false);

  // Track online/offline status
  const isOnline = useOnlineStatus();

  // Keep latest references for unmount/logout flush
  const latestDataRef = useRef<AppData | null>(null);
  const latestUserRef = useRef<typeof user>(null);
  const isDirtyRef = useRef(false);

  // Store last known online status for detecting transitions
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    latestDataRef.current = data;
    if (data && !isInitialLoading) {
      isDirtyRef.current = true;
    }
  }, [data, isInitialLoading]);

  useEffect(() => {
    latestUserRef.current = user;
  }, [user]);

  // Refresh pending sync count periodically
  const refreshPendingSync = useCallback(async () => {
    const count = await offlineService.getSyncQueue().then(q => q.length);
    setPendingSyncCount(count);
    setHasPendingSync(count > 0);
  }, []);

  // Process pending sync queue when coming back online
  const processSyncQueue = useCallback(async () => {
    if (!user) return;
    const queue = await offlineService.getSyncQueue();
    if (queue.length === 0) return;

    console.log('[App] Processing sync queue:', queue.length, 'operations');
    setIsSyncing(true);

    // Deduplicate: only process the latest snapshot per user
    const latestOp = queue[queue.length - 1];

    try {
      if (latestOp.type === 'saveData') {
        await storageService.forceSync(user.uid, latestOp.data);
      }
      // Clear all processed items
      for (const op of queue) {
        if (op.id) {
          await offlineService.removeFromSyncQueue(op.id);
        }
      }
    } catch (e) {
      console.error('[App] Sync failed:', e);
    }

    setIsSyncing(false);
    await refreshPendingSync();
  }, [user, refreshPendingSync]);

  // When coming back online, process the sync queue
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && user) {
      processSyncQueue();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, user, processSyncQueue]);

  // Check pending sync on mount and after data changes
  useEffect(() => {
    refreshPendingSync();
  }, [data, refreshPendingSync]);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsInitialLoading(false);
      isDirtyRef.current = false;
      return;
    }
    const init = async () => {
      setIsInitialLoading(true);
      const cloudData = await storageService.loadData(user.uid);
      setData(cloudData);
      prevBatchCount.current = cloudData.productionBatches.length;
      setIsInitialLoading(false);
      isDirtyRef.current = false;
    };
    init();
  }, [user]);

  // Auto-backup when significant changes occur
  useEffect(() => {
    if (!data || !user || isInitialLoading) return;
    const currentBatchCount = data.productionBatches.length;
    const dataKey = JSON.stringify({ batches: currentBatchCount, clients: data.clients.length, sales: data.sales.length });

    if (dataKey !== lastAutoBackup.current) {
      lastAutoBackup.current = dataKey;
      // Auto-backup when a new batch is added or removed
      if (currentBatchCount !== prevBatchCount.current) {
        const label = `Auto-backup ${new Date().toLocaleString('fr-FR')}`;
        storageService.createBackup(user.uid, data, label).catch(() => {});
        prevBatchCount.current = currentBatchCount;
      }
    }
  }, [data, user, isInitialLoading]);

  // Debounced save to Firestore
  useEffect(() => {
    if (!data || !user || isInitialLoading) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }

    pendingSaveRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await storageService.saveData(user.uid, data);
        isDirtyRef.current = false;
      } catch (e) {
        console.error('Failed to sync data:', e);
      } finally {
        setIsSyncing(false);
      }
    }, 1500); // 1.5s debounce to give the user time to type

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, [data, user, isInitialLoading]);

  // Flush any unsaved changes on unmount or logout
  useEffect(() => {
    return () => {
      const u = latestUserRef.current;
      const d = latestDataRef.current;
      if (u && d && isDirtyRef.current) {
        storageService.saveData(u.uid, d).catch(err => 
          console.error('Failed to sync data on unmount/logout:', err)
        );
      }
    };
  }, []);

  // ── Notifications ──
  const notifications = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    return data.sales.filter(s => s.isCredit && !s.isPaid && s.dueDate && new Date(s.dueDate) <= new Date(today.getTime() + 7 * 86400000));
  }, [data]);

  const overdueCount = useMemo(() => {
    if (!data) return 0;
    const today = new Date();
    return data.sales.filter(s => s.isCredit && !s.isPaid && s.dueDate && new Date(s.dueDate) < today).length;
  }, [data]);

  // Notification checker périodique
  useEffect(() => {
    if (!data || isInitialLoading) return;

    const check = () => {
      const events = checkAllNotifications(data);
      setNotificationEvents(events);
      // Passer data pour les push distants (si fcmToken et fcmPushFunctionUrl configurés)
      showLocalNotificationsFor(events, data);
    };

    check();
    const interval = setInterval(check, 60000); // Vérification toutes les minutes

    return () => clearInterval(interval);
  }, [data, isInitialLoading]);

  // Dark mode effect — placed BEFORE early returns to follow React's Rules of Hooks
  useEffect(() => {
    if (data?.settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [data?.settings.darkMode]);

  // Initialisation FCM au login + récupération du token
  useEffect(() => {
    if (!user || fcmInitedRef.current) return;
    fcmInitedRef.current = true;

    const init = async () => {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      await initFCM();

      // Récupérer le token FCM (nécessite VAPID key dans .env.local)
      // Utiliser functional updater pour éviter les problèmes de closure avec data
      const token = await getFCMToken();
      if (token) {
        setData(prev => {
          if (!prev || prev.fcmToken === token) return prev;
          return { ...prev, fcmToken: token };
        });
      }
    };
    init();

    return () => {
      resetShownNotifications();
    };
  }, [user]);

  const updateData = (newData: AppData) => setData(newData);

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

  const currentUser = user
    ? { id: user.uid, name: user.displayName || user.email || 'Utilisateur', role: 'admin' as const }
    : null;

  const userPermissions = currentUser ? getUserPermissions(currentUser.role) : [];

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

  const toggleDarkMode = () => {
    if (!data) return;
    setData({ ...data, settings: { ...data.settings, darkMode: !data.settings.darkMode } });
  };

  return (
    <div className={`min-h-screen ${data?.settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'} max-w-md mx-auto relative shadow-2xl flex flex-col ${data?.settings.darkMode ? 'border-gray-800' : 'border-x border-gray-100'} font-sans selection:bg-orange-100`}>        <Header
        user={currentUser}
        onLogout={signOutUser}
        notifications={notifications}
        overdueCount={overdueCount}
        notificationEvents={notificationEvents}
        isSyncing={isSyncing}
        isOnline={isOnline}
        hasPendingSync={hasPendingSync}
        pendingSyncCount={pendingSyncCount}
        onOpenNotifSettings={() => setShowNotifSettings(true)}
        darkMode={data?.settings.darkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenUserManagement={() => setShowUserManagement(true)}
      />
      <main className="flex-1 p-4 pb-24 overflow-y-auto scroll-smooth">              {data && activeTab === 'dashboard' && <DashboardView data={data} />}
              {data && activeTab === 'dashboard' && <ProductionGoals data={data} />}              {data && activeTab === 'production' && <ProductionView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />}
              {data && activeTab === 'stock' && <StockView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />}
              {data && activeTab === 'ventes' && <VentesView data={data} setData={updateData} />}
              {data && activeTab === 'clients' && <ClientsView data={data} setData={updateData} />}
              {data && activeTab === 'echeances' && <EcheancesView data={data} />}
              {data && activeTab === 'reservations' && <ReservationView data={data} setData={updateData} />}
              {data && activeTab === 'rapport' && <RapportView data={data} setData={updateData} user={currentUser} permissions={userPermissions} />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Notification Settings Modal */}
      {data && (
        <NotificationSettings
          prefs={data.settings.notifications || {
            enabled: true,
            vaccinationReminders: true,
            mortalityAlerts: true,
            creditDeadlines: true,
          }}
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
  );
}
