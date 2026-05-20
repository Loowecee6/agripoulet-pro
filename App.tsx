import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, ChevronRight, ShieldCheck, Lock, Loader2, User as UserIcon } from 'lucide-react';
import { AppData, User } from './types';
import { storageService } from './services/storageService';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { Modal } from './components/common/Modal';
import { ProductionView } from './components/views/ProductionView';
import { StockView } from './components/views/StockView';
import { VentesView } from './components/views/VentesView';
import { ClientsView } from './components/views/ClientsView';
import { RapportView } from './components/views/RapportView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('production');
  const [data, setData] = useState<AppData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Login State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const cloudData = await storageService.loadData();
      setData(cloudData);
      setIsInitialLoading(false);
    };
    init();
  }, []);

  // Auto-sync
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

  const handleAdminLoginAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    
    if (passwordInput === data.settings.adminPasswordHash) {
      setCurrentUser({id:'1', name:'Admin Principal', role:'admin'});
      setShowPasswordModal(false);
      setPasswordInput('');
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
        <p className="text-orange-900 font-bold animate-pulse">Initialisation du Cloud...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="w-20 h-20 bg-orange-600 rounded-[2.5rem] flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-orange-200 rotate-3 animate-bounce">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-orange-950 mb-1 tracking-tight">AgriPoulet Pro</h1>
          <p className="text-orange-800/50 text-xs font-bold uppercase tracking-widest mb-12">Gestion Partagée & Sécurisée</p>
          
          <div className="space-y-4">
              <button 
                onClick={() => setShowPasswordModal(true)} 
                className="w-full bg-white text-orange-950 p-5 rounded-3xl font-black flex items-center justify-between border-2 border-orange-100 shadow-xl shadow-orange-100/50 active:scale-95 transition-transform group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform"><Lock className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm">Administrateur</div>
                    <div className="text-[10px] opacity-40 font-bold">ACCÈS PROTÉGÉ</div>
                  </div>
                </div>
                <ChevronRight className="opacity-20" />
              </button>

              <button 
                onClick={() => setCurrentUser({id:'2', name:'Employé Site 1', role:'user'})} 
                className="w-full bg-white text-orange-950 p-5 rounded-3xl font-black flex items-center justify-between border-2 border-orange-100 shadow-xl shadow-orange-100/50 active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><UserIcon /></div>
                  <div className="text-left">
                    <div className="text-sm">Employé</div>
                    <div className="text-[10px] opacity-40 font-bold">LIBRE ACCÈS</div>
                  </div>
                </div>
                <ChevronRight className="opacity-20" />
              </button>
          </div>
          
          <p className="mt-12 text-[9px] text-orange-300 font-bold uppercase tracking-widest">
            Cloud Google Infrastructure • Real-time Sync
          </p>
        </div>

        {/* Password Modal */}
        <Modal isOpen={showPasswordModal} onClose={() => {setShowPasswordModal(false); setLoginError(false); setPasswordInput('');}} title="Code Administrateur">
          <form onSubmit={handleAdminLoginAttempt} className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Veuillez entrer le code secret pour accéder aux fonctions administratives.</p>
              <input 
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={passwordInput}
                onChange={(e) => {setPasswordInput(e.target.value); setLoginError(false);}}
                placeholder="••••"
                className={`w-full p-4 text-center text-4xl font-black tracking-[0.8em] bg-gray-50 border-2 rounded-2xl outline-none transition-all ${loginError ? 'border-red-500 bg-red-50 animate-shake' : 'border-gray-100 focus:border-orange-500'}`}
              />
              {loginError && <p className="text-red-500 text-[10px] font-bold uppercase">Code incorrect, réessayez.</p>}
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-orange-100 active:scale-95 transition-transform uppercase tracking-widest text-xs">
              Déverrouiller
            </button>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative shadow-2xl flex flex-col border-x border-gray-100 font-sans selection:bg-orange-100">
      <Header user={currentUser} onLogout={() => setCurrentUser(null)} notifications={notifications} isSyncing={isSyncing} />
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
