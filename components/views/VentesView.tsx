import React, { useState, useMemo } from 'react';
import { useToast } from '../common/ToastContext';
import { QuickAddGrid } from '../common/QuickAddGrid';
import { Plus, ChevronRight, ShoppingBag, MinusCircle, CheckCircle2, Receipt, Info } from 'lucide-react';
import { AppData, Sale, Chicken } from '../../types';
import { Modal } from '../common/Modal';
import { SearchBar } from '../common/SearchBar';

interface VentesViewProps {
  data: AppData;
  setData: (d: AppData) => void;
}

export const VentesView = ({ data, setData }: VentesViewProps) => {
  const { addToast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  
  // États pour la création d'une vente
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [basket, setBasket] = useState<Chicken[]>([]);
  const [priceInput, setPriceInput] = useState<string>('');

  const availableBatches = useMemo(() => {
    return data.stockBatches.filter(b => b.poulets.some(p => !p.vendu));
  }, [data.stockBatches]);

  const handleAddToBasket = () => {
    if (!selectedBatchId) return alert("Choisissez d'abord un lot de stock.");
    if (!priceInput) return;

    const targetBatch = data.stockBatches.find(b => b.id === selectedBatchId);
    if (!targetBatch) return;

    const targetPrice = Number(priceInput);
    const foundChicken = targetBatch.poulets.find(p => 
      !p.vendu && 
      p.prix === targetPrice && 
      !basket.some(bp => bp.id === p.id)
    );

    if (foundChicken) {
      setBasket([...basket, foundChicken]);
      setPriceInput('');
      addToast('Poulet ajouté au panier', 'success');
    } else {
      addToast(`Aucun poulet disponible à ${targetPrice} Frs dans ce lot.`, 'error');
    }
  };

  const handleRemoveFromBasket = (id: string) => {
    setBasket(basket.filter(p => p.id !== id));
  };

  const handleAddSale = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (basket.length === 0) return addToast("Votre panier est vide.", 'error');
    
    const f = new FormData(e.currentTarget);
    const clientId = f.get('clientId') as string;
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return addToast("Veuillez sélectionner un client.", 'error');

    const basketIds = basket.map(p => p.id);
    const total = basket.reduce((acc, p) => acc + p.prix, 0);
    const isCredit = f.get('isCredit') === 'on';

    const newSale: Sale = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientNom: client.nom,
      pouletIds: basketIds,
      total: total,
      isCredit: isCredit,
      dueDate: isCredit ? f.get('dueDate') as string : undefined,
      isPaid: !isCredit,
      dateVente: new Date().toISOString()
    };

    const updatedStock = data.stockBatches.map(b => ({
      ...b,
      poulets: b.poulets.map(p => basketIds.includes(p.id) ? { ...p, vendu: true } : p)
    }));

    setData({
      ...data,
      stockBatches: updatedStock,
      sales: [newSale, ...data.sales]
    });

    setIsAddModalOpen(false);
    setBasket([]);
    setSelectedBatchId('');
    addToast('Vente enregistrée avec succès', 'success');
  };

  const filteredSales = data.sales.filter(s => s.clientNom.toLowerCase().includes(search.toLowerCase()));

  // Récupération des détails d'un poulet à partir des batches (optimisé)
  const getSaleChickens = (pouletIds: string[]) => {
    const details: Chicken[] = [];
    data.stockBatches.forEach(batch => {
      batch.poulets.forEach(p => {
        if (pouletIds.includes(p.id)) details.push(p);
      });
    });
    return details;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ventes & Crédits</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un client..." />

      <div className="space-y-4">
        {filteredSales.map(s => (
          <div 
            key={s.id} 
            className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors"
            onClick={() => setSelectedSale(s)}
          >
             <div>
               <div className="font-bold text-gray-800">{s.clientNom}</div>
               <div className="text-[10px] text-gray-400">{new Date(s.dateVente).toLocaleDateString()} • {s.pouletIds.length} poulet(s)</div>
               {s.isCredit && (
                 <div className={`mt-1 text-[9px] font-black px-2 py-0.5 rounded-full inline-block ${s.isPaid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                   {s.isPaid ? 'PAYÉ' : `CRÉDIT (Echéance: ${s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '?'})`}
                 </div>
               )}
             </div>
             <div className="flex items-center gap-3">
               <div className="text-right">
                 <div className="font-black text-orange-600">{s.total} F</div>
               </div>
               <ChevronRight className="w-4 h-4 text-gray-300" />
             </div>
          </div>
        ))}
        {filteredSales.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucune vente enregistrée</p>}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setBasket([]); setSelectedBatchId(''); }} title="Nouvelle Vente">
        <form onSubmit={handleAddSale} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client *</label>
            <select name="clientId" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none">
              <option value="">Choisir un client</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lot de Stock *</label>
            <select 
              value={selectedBatchId}
              onChange={(e) => { setSelectedBatchId(e.target.value); setBasket([]); }}
              required 
              className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none"
            >
              <option value="">Sélectionner le stock source</option>
              {availableBatches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nom} ({b.poulets.filter(p => !p.vendu).length} dispos)
                </option>
              ))}
            </select>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-3xl space-y-3 border border-orange-100 shadow-sm">
            <label className="text-[10px] font-black text-orange-400 uppercase ml-1">Ajouter un poulet (Saisie Prix)</label>
            <div className="flex gap-2">
              <QuickAddGrid
                options={[3500, 4000, 4500, 5000]}
                onSelect={(price) => {
                  setPriceInput(String(price));
                  handleAddToBasket();
                }}
              />
              {/* Hidden input to retain manual entry if needed */}
              <input
                type="hidden"
                value={priceInput}
                readOnly
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Panier de vente ({basket.length})</label>
              {basket.length > 0 && <button type="button" onClick={() => setBasket([])} className="text-[9px] text-red-500 font-bold uppercase">Vider</button>}
            </div>
            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-2xl p-2 bg-gray-50 space-y-1">
              {basket.length === 0 && <p className="text-center text-xs text-gray-400 py-6 italic">Aucun poulet sélectionné</p>}
              {basket.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 text-xs shadow-sm">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  <div className="flex-1">
                    <div className="font-bold">{p.numero}</div>
                    <div className="text-[9px] text-gray-400">{p.poids} kg</div>
                  </div>
                  <div className="font-black text-orange-600 text-sm">{p.prix} F</div>
                  <button type="button" onClick={() => handleRemoveFromBasket(p.id)} className="text-gray-300 hover:text-red-500 ml-1">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-white rounded-3xl space-y-3 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Vente à crédit ?</span>
              <input name="isCredit" type="checkbox" className="w-6 h-6 accent-orange-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-400 font-black ml-1 uppercase">Date d'échéance du crédit</label>
              <input name="dueDate" type="date" className="w-full p-3 border rounded-xl text-sm outline-none bg-gray-50" />
            </div>
          </div>

          <div className="flex justify-between items-center px-4 py-2 bg-gray-900 text-white rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">TOTAL À PAYER</div>
            <div className="text-xl font-black">{basket.reduce((acc, p) => acc + p.prix, 0)} Frs</div>
          </div>

          <button 
            type="submit" 
            disabled={basket.length === 0}
            className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform mt-2 ${basket.length > 0 ? 'bg-orange-600 text-white shadow-orange-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            Valider la commande
          </button>
        </form>
      </Modal>

      {/* Modal Détails Vente / Facture */}
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Détails de la Vente">
        {selectedSale && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-dashed border-gray-200 p-6 rounded-[2rem] shadow-sm relative overflow-hidden">
               {/* Watermark/Status */}
               <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none select-none -rotate-12`}>
                 <span className="text-7xl font-black uppercase">{selectedSale.isPaid ? 'PAYÉ' : 'CRÉDIT'}</span>
               </div>

               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-1">Facture / Reçu</h3>
                   <div className="text-xl font-black text-gray-900">{selectedSale.clientNom}</div>
                   <div className="text-[10px] text-gray-400 font-bold">{new Date(selectedSale.dateVente).toLocaleString()}</div>
                 </div>
                 <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white">
                   <Receipt className="w-6 h-6" />
                 </div>
               </div>

               <div className="space-y-3 mb-6">
                 <div className="grid grid-cols-3 text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">
                   <span>Réf / Matricule</span>
                   <span className="text-center">Poids</span>
                   <span className="text-right">Prix</span>
                 </div>
                 <div className="h-px bg-gray-100" />
                 {getSaleChickens(selectedSale.pouletIds).map(p => (
                   <div key={p.id} className="grid grid-cols-3 items-center px-1 text-sm">
                     <span className="font-bold text-gray-700">{p.numero}</span>
                     <span className="text-center text-gray-500">{p.poids} kg</span>
                     <span className="text-right font-black text-orange-600">{p.prix} F</span>
                   </div>
                 ))}
               </div>

               <div className="h-px bg-gray-100 mb-4" />

               <div className="flex justify-between items-end">
                 <div>
                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Statut Paiement</div>
                   <div className={`text-xs font-black px-3 py-1 rounded-full inline-block ${selectedSale.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {selectedSale.isPaid ? 'PAYÉ COMPTANT' : 'À CRÉDIT'}
                   </div>
                   {selectedSale.isCredit && !selectedSale.isPaid && selectedSale.dueDate && (
                     <div className="text-[9px] text-red-400 mt-1 font-bold">Échéance: {new Date(selectedSale.dueDate).toLocaleDateString()}</div>
                   )}
                 </div>
                 <div className="text-right">
                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Total Général</div>
                   <div className="text-2xl font-black text-gray-900">{selectedSale.total} Frs</div>
                 </div>
               </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-[10px] text-blue-700 font-medium">Capturez l'écran pour envoyer cette facture à votre client via WhatsApp ou SMS.</p>
              </div>

               {selectedSale.isCredit && !selectedSale.isPaid && (
                <button 
                  onClick={() => {
                    if(confirm("Confirmer le paiement total de cette facture ?")) {
                      setData({ ...data, sales: data.sales.map(s => s.id === selectedSale.id ? { ...s, isPaid: true } : s) });
                      setSelectedSale({ ...selectedSale, isPaid: true });
                    }
                  }}
                  className="w-full bg-green-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Marquer comme payée
                </button>
              )}
              
              <button 
                onClick={() => setSelectedSale(null)}
                className="w-full bg-gray-100 text-gray-500 p-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
