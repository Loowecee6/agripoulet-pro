import React, { useState, useEffect, useMemo } from 'react';
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const cloudData = await storageService.loadData();
      setData(cloudData);
      setIsInitialLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (data && !isInitialLoading) {
      const sync = async () => {
        setIsSyncing(true);
        await storageService.saveData(data);
        setIsSyncing(false);
      };
      sync();
    }
  }, [data, isInitialLoading]);

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
      <Header user={currentUser} onLogout={signOutUser} notifications={notifications} isSyncing={isSyncing} />
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
