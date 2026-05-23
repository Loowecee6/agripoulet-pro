import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AppData } from './types';
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

export default function App() {
  const { user, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('production');
  const [data, setData] = useState<AppData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBatchCount = useRef(0);
  const lastAutoBackup = useRef<string>('');

  // Keep latest references for unmount/logout flush
  const latestDataRef = useRef<AppData | null>(null);
  const latestUserRef = useRef<typeof user>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    latestDataRef.current = data;
    if (data && !isInitialLoading) {
      isDirtyRef.current = true;
    }
  }, [data, isInitialLoading]);

  useEffect(() => {
    latestUserRef.current = user;
  }, [user]);

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
      setSyncError(false);
      try {
        await storageService.saveData(user.uid, data);
        isDirtyRef.current = false;
      } catch (e) {
        console.error('Failed to sync data:', e);
        setSyncError(true);
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

  const notifications = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    return data.sales.filter(s => s.isCredit && !s.isPaid && s.dueDate && new Date(s.dueDate) <= new Date(today.getTime() + 2 * 86400000));
  }, [data]);

  const updateData = (newData: AppData) => setData(newData);

  const currentUser = user
    ? { id: user.uid, name: user.displayName || user.email || 'Utilisateur', role: 'admin' as const }
    : null;

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

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative shadow-2xl flex flex-col border-x border-gray-100 font-sans selection:bg-orange-100">
      <Header user={currentUser} onLogout={signOutUser} notifications={notifications} isSyncing={isSyncing} syncError={syncError} />
      <main className="flex-1 p-4 pb-24 overflow-y-auto scroll-smooth">
        {data && activeTab === 'production' && <ProductionView data={data} setData={updateData} user={currentUser} />}
        {data && activeTab === 'stock' && <StockView data={data} setData={updateData} user={currentUser} />}
        {data && activeTab === 'ventes' && <VentesView data={data} setData={updateData} />}
        {data && activeTab === 'clients' && <ClientsView data={data} setData={updateData} />}
        {data && activeTab === 'rapport' && <RapportView data={data} setData={updateData} user={currentUser} />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
