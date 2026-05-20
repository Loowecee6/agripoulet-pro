import React, { useState, useMemo } from 'react';
import { Plus, Users, Coins, TrendingUp, MessageSquare, CheckCircle2 } from 'lucide-react';
import { AppData, User, ProductionBatch, DailyRecord, Expense, StockBatch } from '../../types';
import { PROGRAMME_VACCINATION, POIDS_THEORIQUE_REFERENCE } from '../../constants';
import { Modal } from '../common/Modal';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

interface ProductionViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  user: User;
}

export const ProductionView = ({ data, setData, user }: ProductionViewProps) => {
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
                      typeOrigine: 'PR',
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
