import React, { useState, useMemo } from 'react';
import { Plus, ChevronRight, CheckCircle2, Trash2, Edit2, Printer } from 'lucide-react';
import { printChickenLabels } from '../../utils/labelPrint';
import { AppData, User, StockBatch, Chicken } from '../../types';
import { Modal } from '../common/Modal';

interface StockViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  user: User;
  permissions: string[];
}

export const StockView = ({ data, setData, user, permissions }: StockViewProps) => {
  const can = (perm: string) => permissions.includes(perm);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editingChicken, setEditingChicken] = useState<{ id: string; chicken: Chicken } | null>(null);
  
  // États locaux pour le calcul automatique réciproque
  const [tempPoids, setTempPoids] = useState<string>('');
  const [tempPrix, setTempPrix] = useState<string>('');

  const nextChickenNumero = useMemo(() => {
    if (!selectedBatch) return '';
    const letter = selectedBatch.lettre || 'S';
    const prefix = selectedBatch.typeOrigine || 'PR';
    const numbers = selectedBatch.poulets.map(p => {
      const match = p.numero.match(/(?:PR|IM)-\w(\d{3})/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = (maxNum + 1).toString().padStart(3, '0');
    return `${prefix}-${letter}${nextNum}`;
  }, [selectedBatch]);

  const handleCreateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can('stock.create')) return;
    const f = new FormData(e.currentTarget);
    const newBatch: StockBatch = {
      id: crypto.randomUUID(),
      nom: f.get('nom') as string,
      typeOrigine: (f.get('typeOrigine') as 'PR' | 'IM') || 'PR',
      lettre: (f.get('lettre') as string || 'S').toUpperCase(),
      prixKg: Number(f.get('prixKg')) || 2500,
      coutInitial: Number(f.get('cout')) || 0,
      poulets: [],
      isFinalized: false
    };
    setData({ ...data, stockBatches: [newBatch, ...data.stockBatches] });
    setIsAddBatchModalOpen(false);
  };

  const handlePoidsChange = (val: string) => {
    setTempPoids(val);
    if (!selectedBatch || !val || isNaN(Number(val))) {
      setTempPrix('');
      return;
    }
    const calculatedPrix = Math.round(Number(val) * selectedBatch.prixKg);
    setTempPrix(calculatedPrix.toString());
  };

  const handlePrixChange = (val: string) => {
    setTempPrix(val);
    if (!selectedBatch || !val || isNaN(Number(val))) {
      setTempPoids('');
      return;
    }
    const calculatedPoids = Number(val) / selectedBatch.prixKg;
    setTempPoids(calculatedPoids.toFixed(2));
  };

  const handleAddChicken = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatch) return;
    
    const p = Number(tempPoids);
    const pr = Number(tempPrix);

    if (!p || !pr) return alert("Le poids et le prix doivent être renseignés.");
    
    const newChicken: Chicken = {
      id: crypto.randomUUID(),
      numero: nextChickenNumero,
      poids: p,
      prix: pr,
      vendu: false
    };
    const updatedBatch = { ...selectedBatch, poulets: [...selectedBatch.poulets, newChicken] };
    setData({
      ...data,
      stockBatches: data.stockBatches.map(b => b.id === updatedBatch.id ? updatedBatch : b)
    });
    setSelectedBatch(updatedBatch);
    setTempPoids('');
    setTempPrix('');
    e.currentTarget.reset();
  };

  const handleUpdateChicken = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatch || !editingChicken) return;
    const f = new FormData(e.currentTarget);
    const updatedChicken: Chicken = {
      ...editingChicken.chicken,
      numero: f.get('numero') as string,
      poids: Number(f.get('poids')),
      prix: Number(f.get('prix')),
    };
    const updatedBatch = {
      ...selectedBatch,
      poulets: selectedBatch.poulets.map(c => c.id === editingChicken.id ? updatedChicken : c)
    };
    setData({ ...data, stockBatches: data.stockBatches.map(b => b.id === updatedBatch.id ? updatedBatch : b) });
    setSelectedBatch(updatedBatch);
    setEditingChicken(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Gestion des Stocks</h2>
        {can('stock.create') && (
          <button onClick={() => setIsAddBatchModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
        )}
      </div>

      <div className="grid gap-4">
        {data.stockBatches.map(batch => (
          <div key={batch.id} className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setSelectedBatch(batch)}>
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-sm">
                {batch.typeOrigine}-{batch.lettre}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">{batch.nom}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${batch.typeOrigine === 'PR' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {batch.typeOrigine === 'PR' ? 'PRODUCTION' : 'IMPORTATION'}
                  </span>
                  <p className="text-[10px] text-gray-400">{batch.poulets.filter(p => !p.vendu).length} disponibles</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {can('stock.edit') && (
                <button onClick={() => setEditingBatch(batch)} className="p-2 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-5 h-5" /></button>
              )}
              <ChevronRight className="text-gray-300 cursor-pointer" onClick={() => setSelectedBatch(batch)} />
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isAddBatchModalOpen} onClose={() => setIsAddBatchModalOpen(false)} title="Nouveau Lot de Stock">
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Origine du Lot</label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border">
              <label className="cursor-pointer">
                <input type="radio" name="typeOrigine" value="PR" defaultChecked className="hidden peer" />
                <div className="text-center py-2 text-xs font-bold rounded-xl peer-checked:bg-white peer-checked:shadow-sm peer-checked:text-orange-600 text-gray-400 transition-all">Production (PR)</div>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="typeOrigine" value="IM" className="hidden peer" />
                <div className="text-center py-2 text-xs font-bold rounded-xl peer-checked:bg-white peer-checked:shadow-sm peer-checked:text-orange-600 text-gray-400 transition-all">Importation (IM)</div>
              </label>
            </div>
          </div>
          <input name="nom" required placeholder="Nom du lot (ex: Lot Poulets Adultes)" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white" />
          <div className="grid grid-cols-2 gap-4">
            <input name="lettre" maxLength={1} placeholder="Lettre (ex: A, B, C)" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white" />
            <input name="prixKg" type="number" min="0" placeholder="Prix/Kg (défaut: 2500)" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white" />
          </div>
          <input name="cout" type="number" min="0" placeholder="Coût d'achat total (si applicable)" className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none dark:border-gray-600 dark:text-white" />
          <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-orange-100 dark:shadow-none">Créer le lot</button>
        </form>
      </Modal>

      <Modal isOpen={!!selectedBatch} onClose={() => { setSelectedBatch(null); setTempPoids(''); setTempPrix(''); }} title={selectedBatch?.nom || ""}>
        {selectedBatch && (
          <div className="space-y-6">
            {/* Phase d'étiquetage : lot vide venant de production */}
            {selectedBatch.poulets.length === 0 && selectedBatch.typeOrigine === 'PR' && (
              <div className="bg-red-50 border-2 border-red-200 p-4 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-sm">!</div>
                  <div>
                    <h4 className="font-bold text-red-800">Phase d'abattage & Étiquetage</h4>
                    <p className="text-xs text-red-600">Définissez le prix/kg puis étiquetez chaque poulet</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-500 uppercase ml-1">Prix au Kilo du jour (Frs)</label>                <input 
                  type="number"
                  min="0"
                  value={selectedBatch.prixKg}
                  onChange={(e) => {
                    const newPrixKg = Number(e.target.value);
                    const updated = { ...selectedBatch, prixKg: newPrixKg };
                    setData({ ...data, stockBatches: data.stockBatches.map(b => b.id === updated.id ? updated : b) });
                    setSelectedBatch(updated);
                  }}
                  className="w-full p-4 border-2 border-red-300 rounded-2xl text-2xl font-black text-center text-red-800 bg-white outline-none focus:ring-2 focus:ring-red-500"
                />
                  <p className="text-[10px] text-red-400 text-center dark:text-red-500">Ce prix sera utilisé pour calculer le prix de chaque poulet</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAddChicken} className="bg-orange-50 p-4 rounded-3xl grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-orange-400 uppercase ml-1">N° Matricule Automatique ({selectedBatch.typeOrigine})</label>
                <div className="p-3 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-xl text-sm font-black text-gray-900 dark:text-white tracking-widest text-center shadow-inner">
                  {nextChickenNumero}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-400 font-bold ml-1 uppercase">Poids (kg)</label>
                <input 
                  value={tempPoids}
                  onChange={(e) => handlePoidsChange(e.target.value)}
                  type="number" 
                  min="0"
                  step="0.01" 
                  placeholder="Poids (kg)" 
                  className="w-full p-3 border rounded-xl text-sm outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-400 font-bold ml-1 uppercase">Prix Vente (Frs)</label>
                <input 
                  value={tempPrix}
                  onChange={(e) => handlePrixChange(e.target.value)}
                  type="number" 
                  min="0"
                  placeholder="Prix Vente (Frs)" 
                  className="w-full p-3 border rounded-xl text-sm outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
                />
              </div>
              <p className="col-span-2 text-[8px] text-orange-400 italic text-center">Calculé sur la base de {selectedBatch.prixKg} F/kg</p>
              <button type="submit" className="col-span-2 bg-orange-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform mt-2">Ajouter au stock</button>
            </form>

            {/* Compteur d'étiquetage + impression QR */}
            {selectedBatch.poulets.length > 0 && selectedBatch.typeOrigine === 'PR' && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-green-700">Étiquetés : {selectedBatch.poulets.length} poulet(s)</span>
                  <span className="text-[10px] text-green-500 block mt-0.5">Prix/kg : {selectedBatch.prixKg} Frs</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const chickens = selectedBatch.poulets.map(p => ({
                        numero: p.numero,
                        poids: p.poids,
                        prix: p.prix,
                        batchNom: selectedBatch.nom,
                      }));
                      await printChickenLabels(chickens);
                    } catch (e) {
                      console.error('Étiquetage QR échoué:', e);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform hover:bg-blue-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Impr. QR
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1 mb-2">Contenu du Stock</h4>
              {selectedBatch.poulets.length === 0 && <p className="text-center text-xs text-gray-300 py-4 italic">Aucun poulet dans ce lot — commencez l'étiquetage</p>}
              {selectedBatch.poulets.slice().reverse().map(p => {
                const isReserved = data.reservations
                  .filter(r => r.statut !== 'cancelled' && r.statut !== 'completed')
                  .some(r => r.pouletIds.includes(p.id));
                return (
                  <div key={p.id} className={`flex justify-between items-center p-3 border rounded-2xl ${p.vendu ? 'bg-gray-50 opacity-50' : isReserved ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="text-sm font-bold tracking-tight flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-black tracking-wider ${p.vendu ? 'bg-green-100 text-green-700' : isReserved ? 'bg-yellow-200 text-yellow-800' : 'bg-orange-100 text-orange-700'}`}>{p.numero}</span>
                      {isReserved && !p.vendu && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-yellow-200 text-yellow-800">Réservé</span>
                      )}
                      <span className="text-gray-300 mx-1">|</span> {p.poids}kg
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-gray-700">{p.prix} F</span>
                      {p.vendu ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setEditingChicken({ id: p.id, chicken: p }); }} className="text-gray-300 hover:text-orange-500 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if(confirm("Supprimer ce poulet du stock ?")) {
                              const updatedBatch = { ...selectedBatch, poulets: selectedBatch.poulets.filter(c => c.id !== p.id) };
                              setData({ ...data, stockBatches: data.stockBatches.map(b => b.id === updatedBatch.id ? updatedBatch : b) });
                              setSelectedBatch(updatedBatch);
                            }
                          }} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {can('stock.delete') && !selectedBatch.isFinalized && (
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

      {/* Edit Batch Modal */}
      <Modal isOpen={!!editingBatch} onClose={() => setEditingBatch(null)} title="Modifier le Lot">
        {editingBatch && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const updated = {
              ...editingBatch,
              nom: f.get('nom') as string,
              typeOrigine: f.get('typeOrigine') as 'PR' | 'IM',
              lettre: (f.get('lettre') as string || editingBatch.lettre).toUpperCase(),
              prixKg: Number(f.get('prixKg')) || editingBatch.prixKg,
              coutInitial: Number(f.get('cout')) || editingBatch.coutInitial,
            };
            setData({ ...data, stockBatches: data.stockBatches.map(b => b.id === updated.id ? updated : b) });
            setEditingBatch(null);
          }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Origine du Lot</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border">
                <label className="cursor-pointer">
                  <input type="radio" name="typeOrigine" value="PR" defaultChecked={editingBatch.typeOrigine === 'PR'} className="hidden peer" />
                  <div className="text-center py-2 text-xs font-bold rounded-xl peer-checked:bg-white peer-checked:shadow-sm peer-checked:text-orange-600 text-gray-400 transition-all">Production (PR)</div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="typeOrigine" value="IM" defaultChecked={editingBatch.typeOrigine === 'IM'} className="hidden peer" />
                  <div className="text-center py-2 text-xs font-bold rounded-xl peer-checked:bg-white peer-checked:shadow-sm peer-checked:text-orange-600 text-gray-400 transition-all">Importation (IM)</div>
                </label>
              </div>
            </div>
            <input name="nom" required defaultValue={editingBatch.nom} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            <div className="grid grid-cols-2 gap-4">
              <input name="lettre" maxLength={1} defaultValue={editingBatch.lettre} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
              <input name="prixKg" type="number" min="0" defaultValue={editingBatch.prixKg} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            </div>
            <input name="cout" type="number" min="0" defaultValue={editingBatch.coutInitial} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg">Enregistrer</button>
          </form>
        )}
      </Modal>

      {/* Edit Chicken Modal */}
      <Modal isOpen={!!editingChicken} onClose={() => setEditingChicken(null)} title="Modifier le Poulet">
        {editingChicken && (
          <form onSubmit={handleUpdateChicken} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">N° Matricule</label>
              <input name="numero" required defaultValue={editingChicken.chicken.numero} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Poids (kg)</label>
                <input name="poids" type="number" min="0" step="0.01" required defaultValue={editingChicken.chicken.poids} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Prix (Frs)</label>
                <input name="prix" type="number" min="0" required defaultValue={editingChicken.chicken.prix} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg">Enregistrer</button>
          </form>
        )}
      </Modal>
    </div>
  );
};
