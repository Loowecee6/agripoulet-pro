import React, { useState, useMemo } from 'react';
import { Plus, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import { AppData, User, StockBatch, Chicken } from '../../types';
import { Modal } from '../common/Modal';

interface StockViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  user: User;
}

export const StockView = ({ data, setData, user }: StockViewProps) => {
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  
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
    if (user.role !== 'admin') return;
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
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-sm">
                {batch.typeOrigine}-{batch.lettre}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{batch.nom}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${batch.typeOrigine === 'PR' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {batch.typeOrigine === 'PR' ? 'PRODUCTION' : 'IMPORTATION'}
                  </span>
                  <p className="text-[10px] text-gray-400">{batch.poulets.filter(p => !p.vendu).length} disponibles</p>
                </div>
              </div>
            </div>
            <ChevronRight className="text-gray-300" />
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
          <input name="nom" required placeholder="Nom du lot (ex: Lot Poulets Adultes)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          <div className="grid grid-cols-2 gap-4">
            <input name="lettre" maxLength={1} placeholder="Lettre (ex: A, B, C)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            <input name="prixKg" type="number" placeholder="Prix/Kg (défaut: 2500)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          </div>
          <input name="cout" type="number" placeholder="Coût d'achat total (si applicable)" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
          <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-orange-100">Créer le lot</button>
        </form>
      </Modal>

      <Modal isOpen={!!selectedBatch} onClose={() => { setSelectedBatch(null); setTempPoids(''); setTempPrix(''); }} title={selectedBatch?.nom || ""}>
        {selectedBatch && (
          <div className="space-y-6">
            <form onSubmit={handleAddChicken} className="bg-orange-50 p-4 rounded-3xl grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-orange-400 uppercase ml-1">N° Matricule Automatique ({selectedBatch.typeOrigine})</label>
                <div className="p-3 bg-white border border-orange-200 rounded-xl text-sm font-black text-gray-900 tracking-widest text-center shadow-inner">
                  {nextChickenNumero}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-400 font-bold ml-1 uppercase">Poids (kg)</label>
                <input 
                  value={tempPoids}
                  onChange={(e) => handlePoidsChange(e.target.value)}
                  type="number" 
                  step="0.01" 
                  placeholder="Poids (kg)" 
                  className="w-full p-3 border rounded-xl text-sm outline-none bg-white" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-400 font-bold ml-1 uppercase">Prix Vente (Frs)</label>
                <input 
                  value={tempPrix}
                  onChange={(e) => handlePrixChange(e.target.value)}
                  type="number" 
                  placeholder="Prix Vente (Frs)" 
                  className="w-full p-3 border rounded-xl text-sm outline-none bg-white" 
                />
              </div>
              <p className="col-span-2 text-[8px] text-orange-400 italic text-center">Calculé sur la base de {selectedBatch.prixKg} F/kg</p>
              <button type="submit" className="col-span-2 bg-orange-600 text-white p-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform mt-2">Ajouter au stock</button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Contenu du Stock</h4>
              {selectedBatch.poulets.length === 0 && <p className="text-center text-xs text-gray-300 py-4 italic">Aucun poulet dans ce lot</p>}
              {selectedBatch.poulets.slice().reverse().map(p => (
                <div key={p.id} className={`flex justify-between items-center p-3 border rounded-2xl ${p.vendu ? 'bg-gray-50 opacity-50' : 'bg-white border-gray-100 shadow-sm'}`}>
                  <div className="text-sm font-bold tracking-tight text-gray-700">
                    <span className="text-orange-600">{p.numero}</span> <span className="text-gray-300 mx-1">|</span> {p.poids}kg
                  </div>
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
