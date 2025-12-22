
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, Box, Users, ShoppingCart, BarChart3, Plus, 
  Trash2, ChevronRight, CheckCircle2, AlertCircle, LogOut, 
  Calendar, Weight, Coins, TrendingUp, History, Info, Search,
  Bell, Edit2, X, Filter, LayoutGrid, Receipt, Share2, Eye, FileText,
  Archive, MessageSquare, CloudSync, ShieldCheck, User as UserIcon,
  RefreshCw, Loader2, Lock, KeyRound
} from 'lucide-react';
import { 
  ProductionBatch, StockBatch, Client, Sale, AppData, User, UserRole,
  DailyRecord, Expense, Chicken
} from './types';
import { storageService } from './services/storageService';
import { PROGRAMME_VACCINATION, POIDS_THEORIQUE_REFERENCE } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

// --- Components ---

const Header = ({ user, onLogout, notifications, isSyncing }: { user: User; onLogout: () => void; notifications: Sale[]; isSyncing: boolean }) => {
  const [showNotifs, setShowNotifs] = useState(false);
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
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-orange-200" />
              ) : (
                <CloudSync className="w-3 h-3 text-green-300" />
              )}
            </div>
            <p className="text-orange-200 text-[10px] mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {user.name} ({user.role === 'admin' ? 'Administrateur' : 'Employé'})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 hover:bg-white/10 rounded-full" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full font-bold">
                {notifications.length}
              </span>
            )}
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>
      {showNotifs && notifications.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-2xl z-50 p-4 animate-in slide-in-from-top duration-200">
           <div className="flex justify-between items-center mb-3">
             <h3 className="text-gray-900 font-bold text-sm">Échéances de crédit</h3>
             <button onClick={() => setShowNotifs(false)}><X className="w-4 h-4 text-gray-400" /></button>
           </div>
           <div className="space-y-2 max-h-60 overflow-y-auto">
             {notifications.map(n => (
               <div key={n.id} className="p-3 bg-red-50 border border-red-100 rounded-xl flex justify-between items-center">
                 <div className="text-xs">
                   <div className="font-bold text-red-900">{n.clientNom}</div>
                   <div className="text-red-700">Dû le: {n.dueDate ? new Date(n.dueDate).toLocaleDateString() : '?'}</div>
                 </div>
                 <div className="font-black text-red-900">{n.total} Frs</div>
               </div>
             ))}
           </div>
        </div>
      )}
    </header>
  );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
  const navItems = [
    { id: 'production', label: 'Prod.', icon: ClipboardList },
    { id: 'stock', label: 'Stock', icon: Box },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'ventes', label: 'Ventes', icon: ShoppingCart },
    { id: 'rapport', label: 'Bilan', icon: BarChart3 },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 pb-safe z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => (
        <button key={item.id} onClick={() => onTabChange(item.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === item.id ? 'text-orange-600' : 'text-gray-400'}`}>
          <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between shrink-0 bg-gray-50/50">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

const SearchBar = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative mb-4">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input 
      type="text" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-10 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all shadow-sm"
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
        <X className="w-4 h-4 text-gray-400" />
      </button>
    )}
  </div>
);

// --- Main Views ---

const ProductionView = ({ data, setData, user }: { data: AppData; setData: (d: AppData) => void; user: User }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [batchTab, setBatchTab] = useState<'suivi' | 'depenses' | 'vaccin'>('suivi');

  const handleAddBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user.role !== 'admin') return alert("Seul un administrateur peut créer une nouvelle bande.");
    const formData = new FormData(e.currentTarget);
    const newBatch: ProductionBatch = {
      id: crypto.randomUUID(),
      nom: formData.get('nom') as string,
      dateMisePlace: formData.get('date') as string,
      nbPoussinsInitial: Number(formData.get('count')),
      prixAchatPoussin: Number(formData.get('prixPoussin')),
      suiviQuotidien: [],
      depenses: [],
      vaccinations: JSON.parse(JSON.stringify(PROGRAMME_VACCINATION)),
      statut: 'active'
    };
    setData({ ...data, productionBatches: [newBatch, ...data.productionBatches] });
    setIsAddModalOpen(false);
  };

  const handleUpdateBatch = (updated: ProductionBatch) => {
    setData({
      ...data,
      productionBatches: data.productionBatches.map(b => b.id === updated.id ? updated : b)
    });
    setSelectedBatch(updated);
  };

  const getDayOfBatch = (batchDate: string, targetDate: string) => {
    const start = new Date(batchDate).getTime();
    const target = new Date(targetDate).getTime();
    return Math.floor((target - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  const growthChartData = useMemo(() => {
    if (!selectedBatch) return [];
    const lastDaySaisi = selectedBatch.suiviQuotidien.length > 0 
      ? Math.max(...selectedBatch.suiviQuotidien.map(r => r.jourDeBande))
      : 1;
    const maxDay = Math.max(lastDaySaisi, 7);
    const chartData = [];
    for (let j = 1; j <= maxDay; j++) {
      const actualRecord = selectedBatch.suiviQuotidien.find(r => r.jourDeBande === j);
      chartData.push({
        jour: `J${j}`,
        theorique: POIDS_THEORIQUE_REFERENCE[j] || null,
        reel: actualRecord?.poidsReel || null
      });
    }
    return chartData;
  }, [selectedBatch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Production active</h2>
        {user.role === 'admin' && (
          <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
        )}
      </div>

      <div className="grid gap-4">
        {data.productionBatches.filter(b => b.statut === 'active').map(batch => (
          <div key={batch.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setSelectedBatch(batch)}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800">{batch.nom}</h3>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full">J{getDayOfBatch(batch.dateMisePlace, new Date().toISOString())}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-2"><Users className="w-4 h-4" /><span>{batch.nbPoussinsInitial - batch.suiviQuotidien.reduce((acc, r) => acc + r.mort, 0)} vivants</span></div>
              <div className="flex items-center gap-2"><Coins className="w-4 h-4" /><span>{batch.depenses.reduce((acc, d) => acc + d.montant, 0) + (batch.nbPoussinsInitial * batch.prixAchatPoussin)} Frs</span></div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouvelle Bande">
        <form onSubmit={handleAddBatch} className="space-y-4">
          <input name="nom" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nom de la bande" />
          <input name="date" type="date" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
          <div className="grid grid-cols-2 gap-4">
            <input name="count" type="number" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nb Poussins" />
            <input name="prixPoussin" type="number" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Prix/Poussin" />
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-orange-100">Créer la production</button>
        </form>
      </Modal>

      <Modal isOpen={!!selectedBatch} onClose={() => setSelectedBatch(null)} title={selectedBatch?.nom || ""}>
        {selectedBatch && (
          <div className="space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(['suivi', 'depenses', 'vaccin'] as const).map(t => (
                <button key={t} onClick={() => setBatchTab(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${batchTab === t ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>{t}</button>
              ))}
            </div>

            {batchTab === 'suivi' && (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" /> Poids réel vs théorique (g)
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="jour" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line name="Théorique" type="monotone" dataKey="theorique" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line name="Réel" type="monotone" dataKey="reel" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <form className="bg-orange-50 p-4 rounded-3xl grid grid-cols-2 gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const dateInput = f.get('date') as string;
                  const record: DailyRecord = {
                    date: dateInput,
                    jourDeBande: getDayOfBatch(selectedBatch.dateMisePlace, dateInput),
                    mort: Number(f.get('mort')),
                    conso: Number(f.get('conso')),
                    quantite: Number(f.get('qte')),
                    poidsReel: Number(f.get('poids')),
                    note: f.get('note') as string
                  };
                  handleUpdateBatch({ ...selectedBatch, suiviQuotidien: [...selectedBatch.suiviQuotidien, record].sort((a,b) => a.date.localeCompare(b.date)) });
                  e.currentTarget.reset();
                }}>
                  <input name="date" type="date" required className="col-span-2 p-3 border rounded-xl text-sm mb-2" defaultValue={new Date().toISOString().split('T')[0]} />
                  <input name="mort" type="number" placeholder="Morts" className="p-3 border rounded-xl text-sm" />
                  <input name="conso" type="number" placeholder="Conso (g)" className="p-3 border rounded-xl text-sm" />
                  <input name="qte" type="number" placeholder="Qte Alim (kg)" className="p-3 border rounded-xl text-sm" />
                  <input name="poids" type="number" placeholder="Poids (g)" className="p-3 border rounded-xl text-sm" />
                  <textarea name="note" placeholder="Observations Process..." className="col-span-2 p-3 border rounded-xl text-sm min-h-[60px]" />
                  <button type="submit" className="col-span-2 bg-orange-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Saisir le suivi</button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Journal de Bande</h4>
                  {selectedBatch.suiviQuotidien.slice().reverse().map((r, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-sm">
                        <div><div className="font-bold">Jour {r.jourDeBande}</div><div className="text-[10px] text-gray-400">{new Date(r.date).toLocaleDateString()}</div></div>
                        <div className="text-right"><div className="font-bold text-red-500">{r.mort} mort(s)</div><div className="text-[10px] font-bold text-orange-600">{r.poidsReel}g</div></div>
                      </div>
                      {r.note && (
                        <div className="flex items-start gap-2 bg-gray-50 p-2 rounded-xl text-[10px] text-gray-500 italic">
                          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-orange-400" />
                          <span>{r.note}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {batchTab === 'depenses' && (
              <div className="space-y-4">
                <form className="bg-blue-50 p-4 rounded-3xl space-y-2" onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const exp: Expense = {
                    id: crypto.randomUUID(),
                    libelle: f.get('libelle') as string,
                    montant: Number(f.get('montant')),
                    date: f.get('date') as string || new Date().toISOString()
                  };
                  handleUpdateBatch({ ...selectedBatch, depenses: [...selectedBatch.depenses, exp] });
                  e.currentTarget.reset();
                }}>
                  <input name="libelle" required placeholder="Libellé dépense" className="w-full p-3 border rounded-xl text-sm bg-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="montant" type="number" required placeholder="Prix Frs" className="p-3 border rounded-xl text-sm bg-white" />
                    <input name="date" type="date" className="p-3 border rounded-xl text-sm bg-white" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Enregistrer dépense</button>
                </form>
                <div className="space-y-2">
                   <div className="flex justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm italic text-orange-700">
                     <span>Investissement Poussins ({selectedBatch.nbPoussinsInitial})</span>
                     <span className="font-bold">{selectedBatch.nbPoussinsInitial * selectedBatch.prixAchatPoussin} Frs</span>
                   </div>
                   {selectedBatch.depenses.map(d => (
                     <div key={d.id} className="flex justify-between p-3 border border-gray-100 rounded-xl text-xs bg-white">
                       <span className="text-gray-600 font-medium">{d.libelle}</span><span className="font-bold">{d.montant} Frs</span>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {batchTab === 'vaccin' && (
              <div className="space-y-2">
                {selectedBatch.vaccinations.map((v, i) => (
                  <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${v.effectuee ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                    <div><div className="text-sm font-bold">{v.traitement}</div><div className="text-[10px] text-gray-400">J{v.jours.join('-')} • {v.produits.join(', ')}</div></div>
                    <button onClick={() => {
                      const next = { ...selectedBatch };
                      next.vaccinations[i].effectuee = !next.vaccinations[i].effectuee;
                      handleUpdateBatch(next);
                    }} className={`p-2 rounded-full transition-transform active:scale-125 ${v.effectuee ? 'text-green-600' : 'text-gray-200'}`}><CheckCircle2 className="w-8 h-8" /></button>
                  </div>
                ))}
              </div>
            )}
            
            {user.role === 'admin' && (
              <button 
                onClick={() => {
                  if (confirm("Transférer cette bande au stock de vente ?")) {
                    const stockId = crypto.randomUUID();
                    const newStock: StockBatch = {
                      id: stockId,
                      productionBatchId: selectedBatch.id,
                      lettre: selectedBatch.nom.charAt(0).toUpperCase(),
                      nom: `Bande ${selectedBatch.nom}`,
                      prixKg: 2500,
                      coutInitial: 0,
                      poulets: [],
                      isFinalized: false
                    };
                    setData({
                      ...data,
                      productionBatches: data.productionBatches.map(b => b.id === selectedBatch.id ? { ...b, statut: 'cloturee' } : b),
                      stockBatches: [...data.stockBatches, newStock]
                    });
                    setSelectedBatch(null);
                  }
                }}
                className="w-full p-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
              >
                Archiver & Mettre en vente
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const StockView = ({ data, setData, user }: { data: AppData; setData: (d: AppData) => void; user: User }) => {
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);

  const handleCreateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user.role !== 'admin') return;
    const f = new FormData(e.currentTarget);
    const newBatch: StockBatch = {
      id: crypto.randomUUID(),
      nom: f.get('nom') as string,
      lettre: (f.get('lettre') as string || 'S').toUpperCase(),
      prixKg: Number(f.get('prixKg')) || 2500,
      coutInitial: Number(f.get('cout')) || 0,
      poulets: [],
      isFinalized: false
    };
    setData({ ...data, stockBatches: [newBatch, ...data.stockBatches] });
    setIsAddBatchModalOpen(false);
  };

  const handleAddChicken = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatch) return;
    const f = new FormData(e.currentTarget);
    const newChicken: Chicken = {
      id: crypto.randomUUID(),
      numero: f.get('numero') as string,
      poids: Number(f.get('poids')),
      prix: Number(f.get('prix')),
      vendu: false
    };
    const updatedBatch = { ...selectedBatch, poulets: [...selectedBatch.poulets, newChicken] };
    setData({
      ...data,
      stockBatches: data.stockBatches.map(b => b.id === updatedBatch.id ? updatedBatch : b)
    });
    setSelectedBatch(updatedBatch);
    e.currentTarget.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des Stocks</h2>
        {user.role === 'admin' && (
          <button onClick={() => setIsAddBatchModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
        )}
      </div>

      <div className="grid gap-4">
        {data.stockBatches.map(batch => (
          <div key={batch.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setSelectedBatch(batch)}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl">{batch.lettre}</div>
              <div>
                <h3 className="font-bold text-gray-800">{batch.nom}</h3>
                <p className="text-xs text-gray-400">{batch.poulets.filter(p => !p.vendu).length} poulets disponibles</p>
              </div>
            </div>
            <ChevronRight className="text-gray-300" />
          </div>
        ))}
      </div>

      <Modal isOpen={isAddBatchModalOpen} onClose={() => setIsAddBatchModalOpen(false)} title="Nouveau Lot de Stock">
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <input name="nom" required placeholder="Nom du lot (ex: Lot Poulets Adultes)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          <div className="grid grid-cols-2 gap-4">
            <input name="lettre" maxLength={1} placeholder="Lettre (ex: A, B, C)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            <input name="prixKg" type="number" placeholder="Prix/Kg (défaut: 2500)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          </div>
          <input name="cout" type="number" placeholder="Coût d'achat total (si applicable)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-orange-100">Créer le lot</button>
        </form>
      </Modal>

      <Modal isOpen={!!selectedBatch} onClose={() => setSelectedBatch(null)} title={selectedBatch?.nom || ""}>
        {selectedBatch && (
          <div className="space-y-6">
            <form onSubmit={handleAddChicken} className="bg-orange-50 p-4 rounded-3xl grid grid-cols-2 gap-2">
              <input name="numero" required placeholder="N° / Bague" className="p-3 border rounded-xl text-sm outline-none" />
              <input name="poids" type="number" step="0.01" required placeholder="Poids (kg)" className="p-3 border rounded-xl text-sm outline-none" />
              <input name="prix" type="number" required placeholder="Prix Vente (Frs)" className="col-span-2 p-3 border rounded-xl text-sm outline-none" />
              <button type="submit" className="col-span-2 bg-orange-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Ajouter au stock</button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Contenu du Stock</h4>
              {selectedBatch.poulets.length === 0 && <p className="text-center text-xs text-gray-300 py-4 italic">Aucun poulet dans ce lot</p>}
              {selectedBatch.poulets.map(p => (
                <div key={p.id} className={`flex justify-between items-center p-3 border rounded-2xl ${p.vendu ? 'bg-gray-50 opacity-50' : 'bg-white border-gray-100 shadow-sm'}`}>
                  <div className="text-sm font-bold">#{p.numero} - {p.poids}kg</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-700">{p.prix} F</span>
                    {p.vendu ? (
                       <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                       <button onClick={(e) => {
                         e.stopPropagation();
                         if(confirm("Supprimer ce poulet du stock ?")) {
                           const updatedBatch = { ...selectedBatch, poulets: selectedBatch.poulets.filter(c => c.id !== p.id) };
                           setData({ ...data, stockBatches: data.stockBatches.map(b => b.id === updatedBatch.id ? updatedBatch : b) });
                           setSelectedBatch(updatedBatch);
                         }
                       }} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {user.role === 'admin' && !selectedBatch.isFinalized && (
              <button 
                onClick={() => {
                   if(confirm("Supprimer complètement ce lot de stock ?")) {
                     setData({ ...data, stockBatches: data.stockBatches.filter(b => b.id !== selectedBatch.id) });
                     setSelectedBatch(null);
                   }
                }}
                className="w-full p-3 text-red-500 text-[10px] font-bold uppercase tracking-widest"
              >
                Supprimer le lot
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const VentesView = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPoulets, setSelectedPoulets] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const availablePoulets = useMemo(() => {
    return data.stockBatches.flatMap(b => b.poulets.filter(p => !p.vendu).map(p => ({ ...p, batchName: b.nom })));
  }, [data.stockBatches]);

  const handleAddSale = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedPoulets.length === 0) return alert("Sélectionnez au moins un poulet.");
    
    const f = new FormData(e.currentTarget);
    const clientId = f.get('clientId') as string;
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return alert("Veuillez sélectionner un client.");

    const total = availablePoulets.filter(p => selectedPoulets.includes(p.id)).reduce((a, b) => a + b.prix, 0);
    const isCredit = f.get('isCredit') === 'on';

    const newSale: Sale = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientNom: client.nom,
      pouletIds: selectedPoulets,
      total: total,
      isCredit: isCredit,
      dueDate: isCredit ? f.get('dueDate') as string : undefined,
      isPaid: !isCredit,
      dateVente: new Date().toISOString()
    };

    const updatedStock = data.stockBatches.map(b => ({
      ...b,
      poulets: b.poulets.map(p => selectedPoulets.includes(p.id) ? { ...p, vendu: true } : p)
    }));

    setData({
      ...data,
      stockBatches: updatedStock,
      sales: [newSale, ...data.sales]
    });

    setIsAddModalOpen(false);
    setSelectedPoulets([]);
  };

  const filteredSales = data.sales.filter(s => s.clientNom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ventes & Crédits</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un client..." />

      <div className="space-y-4">
        {filteredSales.map(s => (
          <div key={s.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
             <div>
               <div className="font-bold text-gray-800">{s.clientNom}</div>
               <div className="text-[10px] text-gray-400">{new Date(s.dateVente).toLocaleDateString()} • {s.pouletIds.length} poulet(s)</div>
               {s.isCredit && (
                 <div className={`mt-1 text-[9px] font-black px-2 py-0.5 rounded-full inline-block ${s.isPaid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                   {s.isPaid ? 'PAYÉ' : `CRÉDIT (Echéance: ${s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '?'})`}
                 </div>
               )}
             </div>
             <div className="text-right">
               <div className="font-black text-orange-600">{s.total} F</div>
               {s.isCredit && !s.isPaid && (
                 <button 
                  onClick={() => {
                    if(confirm("Confirmer le paiement de ce crédit ?")) {
                      setData({ ...data, sales: data.sales.map(sale => sale.id === s.id ? { ...sale, isPaid: true } : sale) });
                    }
                  }}
                  className="text-[10px] font-bold text-blue-600 underline block mt-1"
                 >Marquer payé</button>
               )}
             </div>
          </div>
        ))}
        {filteredSales.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucune vente enregistrée</p>}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouvelle Vente">
        <form onSubmit={handleAddSale} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client</label>
            <select name="clientId" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none">
              <option value="">Sélectionner un client</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Poulets disponibles ({availablePoulets.length})</label>
            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-2xl p-2 bg-gray-50 space-y-1">
              {availablePoulets.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Aucun poulet disponible en stock</p>}
              {availablePoulets.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 text-xs shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                  <input 
                    type="checkbox" 
                    checked={selectedPoulets.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPoulets([...selectedPoulets, p.id]);
                      else setSelectedPoulets(selectedPoulets.filter(id => id !== p.id));
                    }}
                    className="w-5 h-5 accent-orange-600"
                  />
                  <div className="flex-1">
                    <div className="font-bold">#{p.numero} - {p.poids}kg</div>
                    <div className="text-[9px] text-gray-400">{p.batchName}</div>
                  </div>
                  <div className="font-black text-orange-600 text-sm">{p.prix} F</div>
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-3xl space-y-3 border border-orange-100 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-orange-900">Vente à crédit ?</span>
              <input name="isCredit" type="checkbox" className="w-6 h-6 accent-orange-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-orange-400 font-black ml-1 uppercase">Date d'échéance du crédit</label>
              <input name="dueDate" type="date" className="w-full p-3 border rounded-xl text-sm outline-none bg-white" />
            </div>
          </div>

          <div className="flex justify-between items-center px-4 py-2 bg-gray-900 text-white rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">TOTAL</div>
            <div className="text-xl font-black">{availablePoulets.filter(p => selectedPoulets.includes(p.id)).reduce((a, b) => a + b.prix, 0)} Frs</div>
          </div>

          <button type="submit" className="w-full bg-orange-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 active:scale-95 transition-transform">Valider la commande</button>
        </form>
      </Modal>
    </div>
  );
};

const ClientsView = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = data.clients.filter(c => c.nom.toLowerCase().includes(search.toLowerCase()) || c.tel.includes(search));

  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newClient: Client = {
      id: crypto.randomUUID(),
      nom: f.get('nom') as string,
      adresse: f.get('adresse') as string,
      tel: f.get('tel') as string
    };
    setData({ ...data, clients: [...data.clients, newClient] });
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Base Clients</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher par nom ou mobile..." />

      <div className="grid gap-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center shadow-inner"><UserIcon className="w-6 h-6" /></div>
               <div>
                 <div className="font-bold text-gray-800">{c.nom}</div>
                 <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{c.tel}</div>
                 <div className="text-[10px] text-gray-400 italic mt-0.5">{c.adresse || 'Sans adresse'}</div>
               </div>
             </div>
             <button onClick={() => {
               if(confirm(`Supprimer le client "${c.nom}" ?`)) setData({ ...data, clients: data.clients.filter(cl => cl.id !== c.id) });
             }} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucun client trouvé</p>}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouveau Client">
        <form onSubmit={handleAddClient} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nom Complet</label>
            <input name="nom" required placeholder="Ex: Jean Dupont" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">N° Téléphone</label>
            <input name="tel" required placeholder="Ex: 06 00 00 00 00" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Adresse de livraison</label>
            <input name="adresse" placeholder="Quartier, Ville..." className="w-full p-4 border rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 mt-4 active:scale-95 transition-transform">Enregistrer le client</button>
        </form>
      </Modal>
    </div>
  );
};

const RapportView = ({ data, setData, user }: { data: AppData; setData: (d: AppData) => void; user: User }) => {
  const [previewBatch, setPreviewBatch] = useState<any>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const batchSummaries = useMemo(() => {
    return data.stockBatches.map(sb => {
      const prod = data.productionBatches.find(p => p.id === sb.productionBatchId);
      const sales = data.sales.filter(s => s.pouletIds.some(pid => sb.poulets.some(sp => sp.id === pid)));
      const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
      
      const totalCost = prod 
        ? (prod.depenses.reduce((a, d) => a + d.montant, 0) + (prod.nbPoussinsInitial * prod.prixAchatPoussin))
        : (sb.coutInitial || 0);

      const profit = totalRevenue - totalCost;
      const isFinished = sb.poulets.length > 0 && sb.poulets.every(p => p.vendu);
      
      const mortality = prod ? prod.suiviQuotidien.reduce((a, r) => a + r.mort, 0) : 0;
      const initialCount = prod ? prod.nbPoussinsInitial : sb.poulets.length;
      
      return { sb, prod, totalRevenue, totalCost, profit, isFinished, mortality, initialCount, sales };
    });
  }, [data]);

  const handleFinalize = (batchId: string) => {
    if (confirm("Clôturer définitivement ce bilan ?")) {
        setData({
            ...data,
            stockBatches: data.stockBatches.map(b => b.id === batchId ? { ...b, isFinalized: true } : b)
        });
        setPreviewBatch(null);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newP = f.get('newPass') as string;
    if (newP.length < 4) return alert("Le code doit faire au moins 4 chiffres");
    setData({
      ...data,
      settings: { ...data.settings, adminPasswordHash: newP }
    });
    setIsChangingPass(false);
    alert("Code secret administrateur mis à jour !");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Bilans Financiers</h2>
        {user.role === 'admin' && (
          <button 
            onClick={() => setIsChangingPass(true)} 
            className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-orange-100 hover:text-orange-600 transition-colors"
            title="Changer code secret"
          >
            <KeyRound className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {batchSummaries.map((sum, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-black text-lg text-gray-800">{sum.sb.nom}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        {sum.prod ? 'Production Interne' : 'Stock Importé'}
                    </p>
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full ${sum.sb.isFinalized ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-600'}`}>
                    {sum.sb.isFinalized ? 'CLÔTURÉ' : 'ACTIF'}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Investi</div>
                    <div className="text-lg font-black text-gray-700">{sum.totalCost} F</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
                    <div className="text-[10px] text-orange-400 font-bold uppercase mb-1">Recettes</div>
                    <div className="text-lg font-black text-orange-700">{sum.totalRevenue} F</div>
                </div>
            </div>
            
            <div className={`p-5 rounded-3xl flex justify-between items-center ${sum.profit >= 0 ? 'bg-green-600' : 'bg-red-600'} text-white shadow-lg`}>
                <div className="text-2xl font-black">{sum.profit} Frs</div>
                <TrendingUp className="opacity-30" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPreviewBatch(sum)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold text-[10px] uppercase">Détails</button>
              {sum.isFinished && !sum.sb.isFinalized && user.role === 'admin' && (
                <button onClick={() => handleFinalize(sum.sb.id)} className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-bold text-[10px] uppercase">Clôturer</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!previewBatch} onClose={() => setPreviewBatch(null)} title="Détails du Bilan">
        {previewBatch && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-3xl space-y-3">
              <div className="flex justify-between text-xs"><span>Quantité initiale :</span><span className="font-bold">{previewBatch.initialCount} poulets</span></div>
              <div className="flex justify-between text-xs"><span>Pertes (Mortalité) :</span><span className="font-bold text-red-500">{previewBatch.mortality} poulets</span></div>
              <div className="flex justify-between text-xs border-t pt-2"><span>Total vendus :</span><span className="font-bold text-green-600">{previewBatch.sb.poulets.filter((p:any) => p.vendu).length} poulets</span></div>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-gray-400">Notes de production</h4>
              <div className="bg-white border rounded-2xl p-4 text-xs italic text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                {previewBatch.prod?.suiviQuotidien.filter((r:any) => r.note).map((r:any, idx:number) => (
                  <div key={idx} className="border-b pb-2 last:border-0">• {r.note}</div>
                )) || <div className="text-gray-300">Aucune note pour cette bande</div>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isChangingPass} onClose={() => setIsChangingPass(false)} title="Sécurité Admin">
        <form onSubmit={handleUpdatePassword} className="space-y-4 p-2">
          <p className="text-xs text-gray-500">Ce code sera demandé à chaque connexion Administrateur sur tous les appareils.</p>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nouveau Code Secret</label>
            <input 
              name="newPass" 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Ex: 5678" 
              required 
              className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-center text-2xl font-black tracking-[1em]" 
            />
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">Mettre à jour le code</button>
        </form>
      </Modal>
    </div>
  );
};

// --- Main App Entry ---

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
