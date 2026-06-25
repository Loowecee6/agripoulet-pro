import React, { useState, useMemo } from 'react';
import { Plus, Users, Coins, TrendingUp, MessageSquare, CheckCircle2, Edit2, Trash2, Download, BarChart3 } from 'lucide-react';
import { AppData, User, ProductionBatch, DailyRecord, Expense, StockBatch, Chicken } from '../../types';
import { PROGRAMME_VACCINATION, POIDS_THEORIQUE_REFERENCE } from '../../constants';
import { formatDateShort } from '../../utils/dateFormat';
import { Modal } from '../common/Modal';
import { exportBatchExpenses } from '../../utils/exportXLS';
import { BatchAnalytics } from '../common/BatchAnalytics';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

interface ProductionViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  user: User;
  permissions: string[];
}

export const ProductionView = ({ data, setData, user, permissions }: ProductionViewProps) => {
  const can = (perm: string) => permissions.includes(perm);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [batchTab, setBatchTab] = useState<'suivi' | 'depenses' | 'vaccin'>('suivi');
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [editingRecord, setEditingRecord] = useState<{ index: number; record: DailyRecord } | null>(null);
  const [editingExpense, setEditingExpense] = useState<{ index: number; expense: Expense } | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [abattagePartiel, setAbattagePartiel] = useState<{ quantite: number; batch: ProductionBatch } | null>(null);

  const handleAddBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can('production.create')) return alert("Vous n'avez pas la permission de créer une bande.");
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

  const handleDeleteRecord = (recordIndex: number) => {
    if (!selectedBatch || !confirm('Supprimer ce suivi ?')) return;
    const updated = { ...selectedBatch, suiviQuotidien: selectedBatch.suiviQuotidien.filter((_, i) => i !== recordIndex) };
    handleUpdateBatch(updated);
  };

  const handleDeleteExpense = (expenseIndex: number) => {
    if (!selectedBatch || !confirm('Supprimer cette dépense ?')) return;
    const updated = { ...selectedBatch, depenses: selectedBatch.depenses.filter((_, i) => i !== expenseIndex) };
    handleUpdateBatch(updated);
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
        <div className="flex items-center gap-2">
          {data.productionBatches.length > 0 && (
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`p-3 rounded-2xl shadow-lg active:scale-90 transition-colors ${showAnalytics ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
              title="Analytiques"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          )}
          {can('production.create') && (
            <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
          )}
        </div>
      </div>

      {/* Analytics section */}
      {showAnalytics && <BatchAnalytics batches={data.productionBatches} />}

      {!showAnalytics && (

      <div className="grid gap-4">
        {data.productionBatches.filter(b => b.statut === 'active').map(batch => (
          <div key={batch.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800 cursor-pointer flex-1" onClick={() => setSelectedBatch(batch)}>{batch.nom}</h3>
              <div className="flex items-center gap-1">
                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full mr-1">J{getDayOfBatch(batch.dateMisePlace, new Date().toISOString())}</span>
                {can('production.edit') && (
                  <button onClick={(e) => { e.stopPropagation(); setEditingBatch(batch); }} className="p-1 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 cursor-pointer" onClick={() => setSelectedBatch(batch)}>
              <div className="flex items-center gap-2"><Users className="w-4 h-4" /><span>{batch.nbPoussinsInitial - batch.suiviQuotidien.reduce((acc, r) => acc + r.mort, 0)} vivants</span></div>
              <div className="flex items-center gap-2"><Coins className="w-4 h-4" /><span>{batch.depenses.reduce((acc, d) => acc + d.montant, 0) + (batch.nbPoussinsInitial * batch.prixAchatPoussin)} Frs</span></div>
            </div>
          </div>
        ))}
      </div>
      )}

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouvelle Bande">
        <form onSubmit={handleAddBatch} className="space-y-4">
          <input name="nom" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nom de la bande" />
          <input name="date" type="date" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
          <div className="grid grid-cols-2 gap-4">
            <input name="count" type="number" min="0" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nb Poussins" />
            <input name="prixPoussin" type="number" min="0" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Prix/Poussin" />
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
                  const sampleCount = Number(f.get('sampleCount'));
                  const sampleTotalWeight = Number(f.get('sampleTotalWeight'));
                  const poidsMoyen = sampleCount > 0 && sampleTotalWeight > 0 ? Math.round(sampleTotalWeight / sampleCount) : Number(f.get('poidsDirect'));
                  const record: DailyRecord = {
                    date: dateInput,
                    jourDeBande: getDayOfBatch(selectedBatch.dateMisePlace, dateInput),
                    mort: Number(f.get('mort')),
                    conso: Number(f.get('conso')),
                    quantite: Number(f.get('qte')),
                    poidsReel: poidsMoyen,
                    sampleCount: sampleCount > 0 ? sampleCount : undefined,
                    sampleTotalWeight: sampleTotalWeight > 0 ? sampleTotalWeight : undefined,
                    note: f.get('note') as string
                  };
                  handleUpdateBatch({ ...selectedBatch, suiviQuotidien: [...selectedBatch.suiviQuotidien, record].sort((a,b) => a.date.localeCompare(b.date)) });
                  e.currentTarget.reset();
                }}>
                  <input name="date" type="date" required className="col-span-2 p-3 border rounded-xl text-sm mb-2" defaultValue={new Date().toISOString().split('T')[0]} />
                  <input name="mort" type="number" min="0" placeholder="Morts" className="p-3 border rounded-xl text-sm" />
                  <input name="conso" type="number" min="0" placeholder="Conso (g)" className="p-3 border rounded-xl text-sm" />
                  <input name="qte" type="number" min="0" step="0.01" placeholder="Qte Alim (kg)" className="p-3 border rounded-xl text-sm" />
                  <div className="col-span-2 bg-white border border-orange-200 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-black text-orange-500 uppercase">Pesée par échantillon</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input name="sampleCount" type="number" min="0" placeholder="Nb pesés" className="p-2 border rounded-lg text-sm" />
                      <input name="sampleTotalWeight" type="number" min="0" placeholder="Poids total (g)" className="p-2 border rounded-lg text-sm" />
                    </div>
                    <p className="text-[10px] text-gray-400">Ou saisir le poids moyen direct :</p>
                    <input name="poidsDirect" type="number" min="0" placeholder="Poids moyen (g)" className="w-full p-2 border rounded-lg text-sm" />
                  </div>
                  <textarea name="note" placeholder="Observations Process..." className="col-span-2 p-3 border rounded-xl text-sm min-h-[60px]" />
                  <button type="submit" className="col-span-2 bg-orange-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Saisir le suivi</button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Journal de Bande</h4>
                  {selectedBatch.suiviQuotidien.slice().reverse().map((r, revIndex) => {
                    const realIndex = selectedBatch.suiviQuotidien.length - 1 - revIndex;
                    return (
                    <div key={realIndex} className="bg-white border border-gray-100 rounded-2xl p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-sm">
                        <div><div className="font-bold">Jour {r.jourDeBande}</div><div className="text-[10px] text-gray-400">{formatDateShort(r.date)}</div></div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="font-bold text-red-500">{r.mort} mort(s)</div>
                            <div className="text-[10px] font-bold text-orange-600">{r.poidsReel}g</div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setEditingRecord({ index: realIndex, record: r }); }} className="p-1 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(realIndex); }} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {r.note && (
                        <div className="flex items-start gap-2 bg-gray-50 p-2 rounded-xl text-[10px] text-gray-500 italic">
                          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-orange-400" />
                          <span>{r.note}</span>
                        </div>
                      )}
                      {r.sampleCount && r.sampleTotalWeight && (
                        <div className="text-[10px] text-gray-400 bg-blue-50 p-2 rounded-xl">
                          Échantillon : {r.sampleCount} poulets → {r.sampleTotalWeight}g total → moyenne {r.poidsReel}g
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            )}

            {batchTab === 'depenses' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 uppercase">Détail des dépenses</h4>
                  {selectedBatch.depenses.length > 0 && (
                    <button
                      onClick={() => exportBatchExpenses(
                        selectedBatch.nom,
                        selectedBatch.depenses,
                        selectedBatch.prixAchatPoussin,
                        selectedBatch.nbPoussinsInitial
                      )}
                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Exporter XLS
                    </button>
                  )}
                </div>
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
                    <input name="montant" type="number" min="0" required placeholder="Prix Frs" className="p-3 border rounded-xl text-sm bg-white" />
                    <input name="date" type="date" className="p-3 border rounded-xl text-sm bg-white" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Enregistrer dépense</button>
                </form>
                 <div className="space-y-2">
                    <div className="flex justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm italic text-orange-700">
                      <span>Investissement Poussins ({selectedBatch.nbPoussinsInitial})</span>
                      <span className="font-bold">{selectedBatch.nbPoussinsInitial * selectedBatch.prixAchatPoussin} Frs</span>
                    </div>
                    {selectedBatch.depenses.map((d, idx) => (
                      <div key={d.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-xl text-xs bg-white">
                        <span className="text-gray-600 font-medium">{d.libelle}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{d.montant} Frs</span>
                          <button onClick={() => setEditingExpense({ index: idx, expense: d })} className="p-1 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteExpense(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
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
            
            {can('production.abattage') && (
              <>
                <button 
                  onClick={() => {
                    if (confirm("Passer à la phase d'abattage et étiquetage ?")) {
                      const stockId = crypto.randomUUID();
                      const letter = selectedBatch.nom.charAt(0).toUpperCase();
                      const totalDepenses = selectedBatch.depenses.reduce((a, d) => a + d.montant, 0);
                      const coutInitial = (selectedBatch.nbPoussinsInitial * selectedBatch.prixAchatPoussin) + totalDepenses;

                      const newStock: StockBatch = {
                        id: stockId,
                        productionBatchId: selectedBatch.id,
                        typeOrigine: 'PR',
                        lettre: letter,
                        nom: `Bande ${selectedBatch.nom}`,
                        prixKg: 2500,
                        coutInitial: coutInitial,
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
                  Abattage Total & Étiquetage
                </button>

                <button
                  onClick={() => {
                    const restants = selectedBatch.nbPoussinsInitial - selectedBatch.suiviQuotidien.reduce((a, d) => a + d.mort, 0) - (selectedBatch.nbAbattus || 0);
                    setAbattagePartiel({ quantite: Math.min(10, restants), batch: selectedBatch });
                  }}
                  className="w-full p-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
                >
                  Abattage
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Batch Info Modal */}
      <Modal isOpen={!!editingBatch} onClose={() => setEditingBatch(null)} title="Modifier la Bande">
        {editingBatch && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const updated = {
              ...editingBatch,
              nom: f.get('nom') as string,
              dateMisePlace: f.get('date') as string,
              nbPoussinsInitial: Number(f.get('count')),
              prixAchatPoussin: Number(f.get('prixPoussin')),
            };
            handleUpdateBatch(updated);
            setEditingBatch(null);
          }} className="space-y-4">
            <input name="nom" required defaultValue={editingBatch.nom} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nom de la bande" />
            <input name="date" type="date" required defaultValue={editingBatch.dateMisePlace} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            <div className="grid grid-cols-2 gap-4">
              <input name="count" type="number" min="0" required defaultValue={editingBatch.nbPoussinsInitial} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Nb Poussins" />
              <input name="prixPoussin" type="number" min="0" required defaultValue={editingBatch.prixAchatPoussin} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" placeholder="Prix/Poussin" />
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg">Enregistrer</button>
          </form>
        )}
      </Modal>

      {/* Edit Daily Record Modal */}
      <Modal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} title="Modifier le Suivi">
        {editingRecord && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const sampleCount = Number(f.get('sampleCount'));
            const sampleTotalWeight = Number(f.get('sampleTotalWeight'));
            const poidsMoyen = sampleCount > 0 && sampleTotalWeight > 0 ? Math.round(sampleTotalWeight / sampleCount) : Number(f.get('poidsDirect'));
            const updatedRecord: DailyRecord = {
              ...editingRecord.record,
              date: f.get('date') as string,
              mort: Number(f.get('mort')),
              conso: Number(f.get('conso')),
              quantite: Number(f.get('qte')),
              poidsReel: poidsMoyen,
              sampleCount: sampleCount > 0 ? sampleCount : undefined,
              sampleTotalWeight: sampleTotalWeight > 0 ? sampleTotalWeight : undefined,
              note: f.get('note') as string,
            };
            if (!selectedBatch) return;
            const newSuivi = [...selectedBatch.suiviQuotidien];
            newSuivi[editingRecord.index] = updatedRecord;
            handleUpdateBatch({ ...selectedBatch, suiviQuotidien: newSuivi.sort((a, b) => a.date.localeCompare(b.date)) });
            setEditingRecord(null);
          }} className="space-y-3">
            <input name="date" type="date" required defaultValue={editingRecord.record.date} className="w-full p-3 border rounded-xl text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="mort" type="number" defaultValue={editingRecord.record.mort} placeholder="Morts" className="p-3 border rounded-xl text-sm" />
              <input name="conso" type="number" defaultValue={editingRecord.record.conso} placeholder="Conso (g)" className="p-3 border rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="qte" type="number" step="0.01" defaultValue={editingRecord.record.quantite} placeholder="Qte Alim (kg)" className="p-3 border rounded-xl text-sm" />
              <input name="poidsDirect" type="number" defaultValue={editingRecord.record.poidsReel} placeholder="Poids moyen (g)" className="p-3 border rounded-xl text-sm" />
            </div>
            <div className="bg-white border border-orange-200 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-black text-orange-500 uppercase">Pesée par échantillon</p>
              <div className="grid grid-cols-2 gap-2">
                <input name="sampleCount" type="number" defaultValue={editingRecord.record.sampleCount || ''} placeholder="Nb pesés" className="p-2 border rounded-lg text-sm" />
                <input name="sampleTotalWeight" type="number" defaultValue={editingRecord.record.sampleTotalWeight || ''} placeholder="Poids total (g)" className="p-2 border rounded-lg text-sm" />
              </div>
            </div>
            <textarea name="note" defaultValue={editingRecord.record.note} placeholder="Observations..." className="w-full p-3 border rounded-xl text-sm min-h-[60px]" />
            <button type="submit" className="w-full bg-gray-900 text-white p-3 rounded-xl font-bold text-sm">Enregistrer</button>
          </form>
        )}
      </Modal>

      {/* Edit Expense Modal */}
      <Modal isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} title="Modifier la Dépense">
        {editingExpense && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const updatedExpense: Expense = {
              ...editingExpense.expense,
              libelle: f.get('libelle') as string,
              montant: Number(f.get('montant')),
              date: f.get('date') as string,
            };
            if (!selectedBatch) return;
            const newDepenses = [...selectedBatch.depenses];
            newDepenses[editingExpense.index] = updatedExpense;
            handleUpdateBatch({ ...selectedBatch, depenses: newDepenses });
            setEditingExpense(null);
          }} className="space-y-3">
            <input name="libelle" required defaultValue={editingExpense.expense.libelle} placeholder="Libellé dépense" className="w-full p-3 border rounded-xl text-sm bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <input name="montant" type="number" min="0" required defaultValue={editingExpense.expense.montant} placeholder="Prix Frs" className="p-3 border rounded-xl text-sm bg-white" />
              <input name="date" type="date" defaultValue={editingExpense.expense.date} className="p-3 border rounded-xl text-sm bg-white" />
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-3 rounded-xl font-bold text-sm">Enregistrer</button>
          </form>
        )}
      </Modal>

      {/* Abattage Partiel Modal */}
      <Modal isOpen={!!abattagePartiel} onClose={() => setAbattagePartiel(null)} title="Abattage Partiel">
        {abattagePartiel && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const quantite = parseInt(f.get('quantite') as string);
            const prixUnitaire = parseInt(f.get('prixUnitaire') as string) || 3500;
            if (isNaN(quantite) || quantite <= 0) return;

            const batch = abattagePartiel.batch;
            const morts = batch.suiviQuotidien.reduce((a, d) => a + d.mort, 0);
            const restants = batch.nbPoussinsInitial - morts - (batch.nbAbattus || 0);
            if (quantite > restants) {
              alert(`Il ne reste que ${restants} poulets disponibles dans cette bande.`);
              return;
            }

            const stockId = crypto.randomUUID();
            const usedLetters = data.stockBatches.map(s => s.lettre);
            let letter = batch.nom.charAt(0).toUpperCase();
            if (usedLetters.includes(letter)) {
              for (let c = 65; c <= 90; c++) {
                if (!usedLetters.includes(String.fromCharCode(c))) {
                  letter = String.fromCharCode(c);
                  break;
                }
              }
            }

            const newStock: StockBatch = {
              id: stockId,
              productionBatchId: batch.id,
              typeOrigine: 'PR',
              lettre: letter,
              nom: `Abattage ${batch.nom} (${quantite} pcs)`,
              prixKg: 0,
              coutInitial: quantite * prixUnitaire,
              poulets: [],
              isFinalized: true,
              quantite,
            };

            setData({
              ...data,
              productionBatches: data.productionBatches.map(b =>
                b.id === batch.id ? { ...b, nbAbattus: (b.nbAbattus || 0) + quantite } : b
              ),
              stockBatches: [...data.stockBatches, newStock],
            });

            setAbattagePartiel(null);
            setSelectedBatch(null);
            addToast(`${quantite} poulets abattus et ajoutés au stock.`, 'success');
          }} className="space-y-3">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4 text-sm space-y-1">
              <p><strong>Bande :</strong> {abattagePartiel.batch.nom}</p>
              <p><strong>Restants estimés :</strong> {abattagePartiel.batch.nbPoussinsInitial - abattagePartiel.batch.suiviQuotidien.reduce((a, d) => a + d.mort, 0) - (abattagePartiel.batch.nbAbattus || 0)} poulets</p>
              <p className="text-orange-600 font-bold">La bande reste active après l'opération.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombre de poulets à abattre</label>
              <input 
                name="quantite" type="number" min="1" required
                defaultValue={abattagePartiel.quantite}
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm outline-none bg-gray-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Prix unitaire estimé (FCFA)</label>
              <input 
                name="prixUnitaire" type="number" min="0" defaultValue="3500"
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm outline-none bg-gray-50"
              />
            </div>

            <button type="submit" className="w-full p-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-transform">
              Confirmer l'abattage
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};
