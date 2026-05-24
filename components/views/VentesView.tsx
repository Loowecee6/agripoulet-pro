import React, { useState, useMemo } from 'react';
import { useToast } from '../common/ToastContext';
import { QuickAddGrid } from '../common/QuickAddGrid';
import { Plus, ChevronRight, ShoppingBag, MinusCircle, CheckCircle2, Receipt, Info, Edit2, Trash2, DollarSign, History, FileDown } from 'lucide-react';
import { AppData, Sale, Chicken, Payment } from '../../types';
import { generateInvoice } from '../../utils/invoicePDF';
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
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Helper: get remaining balance on a credit sale
  const getRemainingBalance = (sale: Sale) => {
    if (!sale.isCredit) return 0;
    const totalPayments = (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
    return Math.max(0, sale.total - totalPayments);
  };

  // Helper: get total payments on a sale
  const getTotalPayments = (sale: Sale) => {
    return (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
  };

  // Helper: check if a sale is effectively paid (full)
  const isSalePaid = (sale: Sale) => {
    if (!sale.isCredit) return true;
    return getRemainingBalance(sale) <= 0;
  };
  
  // États pour la création d'une vente
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [basket, setBasket] = useState<Chicken[]>([]);
  const [priceInput, setPriceInput] = useState<string>('');

  // IDs des poulets réservés (non vendus, réservations actives)
  const reservedPouletIds = useMemo(() =>
    new Set(data.reservations
      .filter(r => r.statut !== 'cancelled' && r.statut !== 'completed')
      .flatMap(r => r.pouletIds)),
  [data.reservations]);

  const availableBatches = useMemo(() => {
    return data.stockBatches.filter(b => b.poulets.some(p => !p.vendu && !reservedPouletIds.has(p.id)));
  }, [data.stockBatches, reservedPouletIds]);

  const handleAddToBasket = () => {
    if (!selectedBatchId) return alert("Choisissez d'abord un lot de stock.");
    if (!priceInput) return;

    const targetBatch = data.stockBatches.find(b => b.id === selectedBatchId);
    if (!targetBatch) return;

    const targetPrice = Number(priceInput);
    const foundChicken = targetBatch.poulets.find(p => 
      !p.vendu && 
      !reservedPouletIds.has(p.id) &&
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

    const dueDateRaw = f.get('dueDate') as string;
    // Validate credit: must have dueDate within 15 days
    if (isCredit) {
      if (!dueDateRaw) {
        return addToast("Veuillez définir une date d'échéance pour le crédit.", 'error');
      }
      const maxDate = new Date(Date.now() + 15 * 86400000);
      if (new Date(dueDateRaw) > maxDate) {
        return addToast("Le crédit ne peut pas dépasser 15 jours. Choisissez une date plus proche.", 'error');
      }
    }

    const newSale: Sale = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientNom: client.nom,
      pouletIds: basketIds,
      total: total,
      isCredit: isCredit,
      dueDate: isCredit ? dueDateRaw : undefined,
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

  const handleDeleteSale = (saleId: string) => {
    if (!confirm('Supprimer cette vente ? Les poulets seront remis en stock.')) return;
    const sale = data.sales.find(s => s.id === saleId);
    if (!sale) return;
    // Unmark chickens as sold
    const updatedStock = data.stockBatches.map(b => ({
      ...b,
      poulets: b.poulets.map(p => sale.pouletIds.includes(p.id) ? { ...p, vendu: false } : p)
    }));
    setData({
      ...data,
      stockBatches: updatedStock,
      sales: data.sales.filter(s => s.id !== saleId)
    });
    if (selectedSale?.id === saleId) setSelectedSale(null);
    addToast('Vente supprimée', 'info');
  };

  const handleAddPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paymentSaleId) return;
    const f = new FormData(e.currentTarget);
    const montant = Number(f.get('montant'));
    if (!montant || montant <= 0) return addToast('Montant invalide', 'error');

    const sale = data.sales.find(s => s.id === paymentSaleId);
    if (!sale) return;

    const remaining = getRemainingBalance(sale);
    if (montant > remaining) {
      return addToast(`Le montant ne peut pas dépasser le solde restant (${remaining} Frs)`, 'error');
    }

    const newPayment: Payment = {
      id: crypto.randomUUID(),
      montant,
      date: new Date().toISOString(),
      methode: (f.get('methode') as Payment['methode']) || undefined,
      note: (f.get('note') as string) || undefined,
    };

    const existingPayments = sale.payments || [];
    const totalAfter = existingPayments.reduce((s, p) => s + p.montant, 0) + montant;
    const isNowPaid = totalAfter >= sale.total;

    setData({
      ...data,
      sales: data.sales.map(s =>
        s.id === paymentSaleId
          ? {
              ...s,
              payments: [...existingPayments, newPayment],
              isPaid: isNowPaid,
            }
          : s
      ),
    });

    // Update selectedSale if viewing this sale
    if (selectedSale?.id === paymentSaleId) {
      setSelectedSale({
        ...selectedSale,
        payments: [...(selectedSale.payments || []), newPayment],
        isPaid: isNowPaid,
      });
    }

    setIsPaymentModalOpen(false);
    setPaymentSaleId(null);
    addToast(`Paiement de ${montant} Frs enregistré`, 'success');
    if (isNowPaid) {
      addToast('Vente entièrement soldée !', 'success');
    }
  };

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
        <h2 className="text-xl font-bold dark:text-white">Ventes & Crédits</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un client..." />

      <div className="space-y-4">
        {filteredSales.map(s => (
          <div 
            key={s.id} 
            className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center"
          >
             <div className="cursor-pointer flex-1" onClick={() => setSelectedSale(s)}>
               <div className="font-bold text-gray-800 dark:text-white">{s.clientNom}</div>
               <div className="text-[10px] text-gray-400">{new Date(s.dateVente).toLocaleDateString()} • {s.pouletIds.length} poulet(s)</div>
               {s.isCredit && (() => {
                 const remaining = getRemainingBalance(s);
                 const isFullyPaid = remaining <= 0;
                 const totalPayments = getTotalPayments(s);
                 const hasPartialPayments = totalPayments > 0 && !isFullyPaid;
                 return (
                   <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                     <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isFullyPaid ? 'bg-green-100 text-green-600' : hasPartialPayments ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                       {isFullyPaid ? 'PAYÉ' : hasPartialPayments ? `${remaining.toLocaleString()} F RESTANTS` : `CRÉDIT (${s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '?'})`}
                     </span>
                     {hasPartialPayments && (
                       <span className="text-[8px] text-yellow-600 font-medium">
                         {totalPayments.toLocaleString()} F versés
                       </span>
                     )}
                   </div>
                 );
               })()}
             </div>
             <div className="flex items-center gap-1">
               <div className="text-right mr-2">
                 <div className="font-black text-orange-600">{s.total} F</div>
               </div>
               <button onClick={() => setEditingSale(s)} className="p-2 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
               <button onClick={() => handleDeleteSale(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
               <button onClick={() => setSelectedSale(s)} className="p-2 text-gray-300 hover:text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
             </div>
          </div>
        ))}
        {filteredSales.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucune vente enregistrée</p>}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setBasket([]); setSelectedBatchId(''); }} title="Nouvelle Vente">
        <form onSubmit={handleAddSale} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client *</label>
            <select name="clientId" required className="w-full p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none text-sm appearance-none dark:border-gray-600 dark:text-white">
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
          
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-3xl space-y-3 border border-orange-100 dark:border-orange-800/50 shadow-sm">
            <label className="text-[10px] font-black text-orange-400 dark:text-orange-300 uppercase ml-1">Ajouter un poulet (Saisie Prix)</label>
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
            <div className="max-h-56 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-2xl p-2 bg-gray-50 dark:bg-gray-800/50 space-y-1">
              {basket.length === 0 && <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-6 italic">Aucun poulet sélectionné</p>}
              {basket.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-xs shadow-sm">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-wider bg-orange-100 text-orange-700`}>{p.numero}</span>
                  <div className="flex-1">
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

          <div className="p-4 bg-white dark:bg-gray-800 rounded-3xl space-y-3 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Vente à crédit ?</span>
              <input name="isCredit" type="checkbox" className="w-6 h-6 accent-orange-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-400 font-black ml-1 uppercase">Date d'échéance (max 15 jours)</label>
              <input name="dueDate" type="date" min={new Date().toISOString().split('T')[0]} max={new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]} className="w-full p-3 border rounded-xl text-sm outline-none bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
            </div>
          </div>

          <div className="flex justify-between items-center px-4 py-2 bg-gray-900 dark:bg-gray-950 text-white rounded-2xl">
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
                 <span className="text-7xl font-black uppercase">{isSalePaid(selectedSale) ? 'PAYÉ' : 'CRÉDIT'}</span>
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
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider bg-orange-100 text-orange-700 inline-block w-fit`}>{p.numero}</span>
                      <span className="text-center text-gray-500">{p.poids} kg</span>
                      <span className="text-right font-black text-orange-600">{p.prix} F</span>
                    </div>
                  ))}
               </div>

               <div className="h-px bg-gray-100 mb-4" />

               <div className="flex justify-between items-end">
                 <div>
                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Statut Paiement</div>
                   <div className={`text-xs font-black px-3 py-1 rounded-full inline-block ${isSalePaid(selectedSale) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {!selectedSale.isCredit ? 'PAYÉ COMPTANT' : isSalePaid(selectedSale) ? 'PAYÉ' : 'À CRÉDIT'}
                   </div>
                   {selectedSale.isCredit && !isSalePaid(selectedSale) && selectedSale.dueDate && (
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
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const chickens = getSaleChickens(selectedSale.pouletIds).map(p => ({
                        numero: p.numero,
                        poids: p.poids,
                        prix: p.prix,
                      }));
                      await generateInvoice(selectedSale, selectedSale.clientNom, chickens);
                      addToast('Facture téléchargée !', 'success');
                    } catch (err) {
                      addToast('Erreur lors de la génération de la facture', 'error');
                      console.error(err);
                    }
                  }}
                  className="flex-1 bg-orange-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <FileDown className="w-5 h-5" /> Télécharger PDF
                </button>
              </div>

                 {/* Payment History Section */}
              {selectedSale.isCredit && (selectedSale.payments || []).length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-700">Historique des paiements</h4>
                  </div>
                  <div className="space-y-2">
                    {(selectedSale.payments || []).map((p, idx) => (
                      <div key={p.id} className="bg-blue-50 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span className="font-bold text-gray-800">{p.montant.toLocaleString()} Frs</span>
                          </div>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                        </div>
                        <div className="flex items-center justify-between pl-6">
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                            p.methode === 'especes' ? 'bg-green-100 text-green-700' :
                            p.methode === 'orange_money' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {p.methode === 'especes' ? '💵 Espèces' :
                             p.methode === 'orange_money' ? '📱 Orange Money' :
                             p.methode === 'wave' ? '📱 Wave' :
                             ''}
                          </span>
                          {p.note && (
                            <span className="text-[9px] text-gray-400 italic">{p.note}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Total versé</span>
                    <span className="text-sm font-black text-green-700">
                      {getTotalPayments(selectedSale).toLocaleString()} Frs
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Solde restant</span>
                    <span className={`text-sm font-black ${getRemainingBalance(selectedSale) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {getRemainingBalance(selectedSale) > 0
                        ? `${getRemainingBalance(selectedSale).toLocaleString()} Frs`
                        : 'Soldé ✓'}
                    </span>
                  </div>
                </div>
              )}

              {selectedSale.isCredit && !isSalePaid(selectedSale) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPaymentSaleId(selectedSale.id);
                      setIsPaymentModalOpen(true);
                    }}
                    className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" /> Ajouter un paiement
                  </button>
                  <button 
                    onClick={() => {
                      if(confirm(`Confirmer le paiement total de ${getRemainingBalance(selectedSale).toLocaleString()} Frs ?`)) {
                        const remaining = getRemainingBalance(selectedSale);
                        const fullPayment: Payment = {
                          id: crypto.randomUUID(),
                          montant: remaining,
                          date: new Date().toISOString(),
                          methode: 'especes',
                          note: 'Paiement intégral',
                        };
                        const existingPayments = selectedSale.payments || [];
                        setData({
                          ...data,
                          sales: data.sales.map(s =>
                            s.id === selectedSale.id
                              ? { ...s, payments: [...existingPayments, fullPayment], isPaid: true }
                              : s
                          ),
                        });
                        setSelectedSale({
                          ...selectedSale,
                          payments: [...existingPayments, fullPayment],
                          isPaid: true,
                        });
                        addToast('Vente entièrement soldée !', 'success');
                      }
                    }}
                    className="flex-1 bg-green-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Tout solder
                  </button>
                </div>
              )}

              {selectedSale.isCredit && isSalePaid(selectedSale) && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-green-800">Entièrement payé</div>
                    <div className="text-[9px] text-green-600">
                      {getTotalPayments(selectedSale).toLocaleString()} Frs versés sur {selectedSale.total.toLocaleString()} Frs
                    </div>
                  </div>
                </div>
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

      {/* Edit Sale Modal */}
      <Modal isOpen={!!editingSale} onClose={() => setEditingSale(null)} title="Modifier la Vente">
        {editingSale && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const clientId = f.get('clientId') as string;
            const client = data.clients.find(c => c.id === clientId);
            if (!client) return addToast("Client invalide", 'error');
            const isCredit = f.get('isCredit') === 'on';
            const dueDateRaw = f.get('dueDate') as string;
            if (isCredit) {
              if (!dueDateRaw) {
                return addToast("Veuillez définir une date d'échéance pour le crédit.", 'error');
              }
              const maxDate = new Date(Date.now() + 15 * 86400000);
              if (new Date(dueDateRaw) > maxDate) {
                return addToast("Le crédit ne peut pas dépasser 15 jours. Choisissez une date plus proche.", 'error');
              }
            }
            const updated: Sale = {
              ...editingSale,
              clientId: client.id,
              clientNom: client.nom,
              total: Number(f.get('total')) || editingSale.total,
              isCredit,
              dueDate: isCredit ? dueDateRaw : undefined,
              isPaid: !isCredit || f.get('isPaid') === 'on',
            };
            setData({
              ...data,
              sales: data.sales.map(s => s.id === editingSale.id ? updated : s)
            });
            setEditingSale(null);
            addToast('Vente modifiée', 'success');
          }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client *</label>
              <select name="clientId" required defaultValue={editingSale.clientId} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none">
                <option value="">Choisir un client</option>
                {data.clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Total (Frs)</label>
              <input name="total" type="number" min="0" defaultValue={editingSale.total} className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" />
            </div>
            <div className="p-4 bg-white rounded-3xl space-y-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">Vente à crédit ?</span>
                <input name="isCredit" type="checkbox" defaultChecked={editingSale.isCredit} className="w-6 h-6 accent-orange-600" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-400 font-black ml-1 uppercase">Date d'échéance (max 15 jours)</label>
                <input name="dueDate" type="date" min={new Date().toISOString().split('T')[0]} max={new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]} defaultValue={editingSale.dueDate || ''} className="w-full p-3 border rounded-xl text-sm outline-none bg-gray-50" />
              </div>
              {editingSale.isCredit && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Payé ?</span>
                  <input name="isPaid" type="checkbox" defaultChecked={editingSale.isPaid} className="w-6 h-6 accent-green-600" />
                </div>
              )}
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-lg">Enregistrer</button>
          </form>
        )}
      </Modal>

      {/* Modal Ajout de Paiement */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setPaymentSaleId(null); }} title="Ajouter un paiement">
        {paymentSaleId && (() => {
          const sale = data.sales.find(s => s.id === paymentSaleId);
          if (!sale) return null;
          const remaining = getRemainingBalance(sale);
          return (
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div className="bg-blue-50 rounded-2xl p-4 text-center space-y-1">
                <div className="text-[10px] font-bold text-blue-500 uppercase">Solde restant</div>
                <div className="text-3xl font-black text-blue-700">{remaining.toLocaleString()} Frs</div>
                <div className="text-xs text-blue-400">sur {sale.total.toLocaleString()} Frs</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Montant du paiement *</label>
                <input
                  name="montant"
                  type="number"
                  min="0"
                  max={remaining}
                  required
                  placeholder="Ex: 5000"
                  className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-xl font-black text-center"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Mode de paiement *</label>
                <select
                  name="methode"
                  required
                  className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none"
                >
                  <option value="especes">💵 Espèces</option>
                  <option value="orange_money">📱 Orange Money</option>
                  <option value="wave">📱 Wave</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Note (optionnelle)</label>
                <input
                  name="note"
                  type="text"
                  placeholder="Ex: Avance, reliquat..."
                  className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsPaymentModalOpen(false); setPaymentSaleId(null); }}
                  className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-transform"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </div>
  );
};
