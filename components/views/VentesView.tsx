import React, { useCallback } from 'react';
import { useToast } from '../common/ToastContext';
import { QuickAddGrid } from '../common/QuickAddGrid';
import {
  Plus, ChevronRight, MinusCircle, CheckCircle2, Receipt,
  Edit2, Trash2, DollarSign, History, Download, Copy, Send
} from 'lucide-react';
import { AppData, FactureItemLine } from '../../types';
import { formatWhatsAppUrl } from '../../utils/whatsapp';
import { formatDateShort, formatDateWithTime } from '../../utils/dateFormat';
import { getRemainingBalance, getTotalPayments, isSalePaid } from '../../utils/creditHelpers';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { Modal } from '../common/Modal';
import { SearchBar } from '../common/SearchBar';
import { useSalesActions } from '../../hooks/useSalesActions';

interface VentesViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  onTabChange?: (tab: string) => void;
  permissions?: string[];
}

export const VentesView = ({ data, setData, onTabChange, permissions = [] }: VentesViewProps) => {
  const { addToast } = useToast();

  const {
    isAddModalOpen, setIsAddModalOpen,
    selectedSale, setSelectedSale,
    editingSale, setEditingSale,
    isPaymentModalOpen, setIsPaymentModalOpen,
    paymentSaleId, setPaymentSaleId,
    search, setSearch,
    selectedBatchId, setSelectedBatchId,
    basket, setBasket,
    priceInput, setPriceInput,
    qteVente, setQteVente,
    availableBatches,
    selectedBatch,
    filteredSales,
    getSaleChickens,
    handleAddToBasket,
    handleRemoveFromBasket,
    handleAddSale,
    handleDeleteSale,
    handleAddPayment,
    handleEditSale,
    handleFullPayment,
    resetAddModal,
  } = useSalesActions({ data, setData, addToast });

  const generateSaleReceiptBlob = useCallback(async (sale: Sale, clientNom: string, clientTel: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const rowHeight = 30;
      const items = sale.factureItems || [];
      const headerHeight = 220;
      const footerHeight = 130;
      const dynamicHeight = Math.max(1, items.length) * rowHeight;
      const canvasWidth = 500;
      const canvasHeight = headerHeight + dynamicHeight + footerHeight;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(5, 5, canvasWidth - 10, canvasHeight - 10);

      ctx.fillStyle = '#ea580c';
      ctx.fillRect(5, 5, canvasWidth - 10, 15);

      ctx.font = '36px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐔', canvasWidth / 2, 65);

      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('AGRIPOULET PRO', canvasWidth / 2, 105);

      ctx.font = 'italic 12px "Inter", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Élevage & Vente de Poulets de Qualité', canvasWidth / 2, 125);

      const drawDottedLine = (y: number) => {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(25, y);
        ctx.lineTo(canvasWidth - 25, y);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      drawDottedLine(140);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillText(`FACTURE N° : FAC-${new Date(sale.dateVente).toISOString().split('T')[0].replace(/-/g, '')}-${sale.id.slice(0, 4)}`, 25, 160);
      ctx.fillText(`Date : ${new Date(sale.dateVente).toLocaleDateString('fr-FR')}`, 25, 178);

      ctx.fillText(`Client : ${clientNom}`, 25, 196);
      if (clientTel) {
        ctx.fillText(`Tél : ${clientTel}`, 25, 214);
      }
      const nbPoulets = items.reduce((s, i) => s + i.qte, 0) || sale.pouletIds.length;
      ctx.fillText(`Nb de poulets : ${nbPoulets}`, 25, clientTel ? 232 : 214);

      const infoEnd = clientTel ? 232 : 214;
      drawDottedLine(infoEnd + 18);

      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('Désignation', 25, infoEnd + 40);
      ctx.textAlign = 'right';
      ctx.fillText('Prix (F)', 475, infoEnd + 40);

      drawDottedLine(infoEnd + 52);

      let currentY = infoEnd + 75;
      ctx.font = 'medium 11px "Inter", sans-serif';
      ctx.fillStyle = '#334155';

      if (items.length > 0) {
        items.forEach((item) => {
          ctx.textAlign = 'left';
          let name = item.designation || 'Poulet';
          if (item.qte > 1) name += ` (x${item.qte})`;
          if (name.length > 36) name = name.substring(0, 33) + '...';
          ctx.fillText(name, 25, currentY);

          ctx.textAlign = 'right';
          ctx.font = 'bold 11px "Inter", sans-serif';
          ctx.fillText(String(item.qte * item.prixU), 475, currentY);
          ctx.font = 'medium 11px "Inter", sans-serif';
          currentY += rowHeight;
        });
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 11px "Inter", sans-serif';
        ctx.fillText('Aucun détail disponible', canvasWidth / 2, currentY + 10);
        currentY += rowHeight;
      }

      drawDottedLine(currentY - 12);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px "Inter", sans-serif';
      ctx.fillText('TOTAL À PAYER', 25, currentY + 16);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ea580c';
      ctx.font = '900 17px "Inter", sans-serif';
      ctx.fillText(`${sale.total.toLocaleString('fr-FR')} F CFA`, 475, currentY + 18);

      currentY += 45;
      const bannerWidth = canvasWidth - 50;
      const bannerHeight = 32;
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "Inter", sans-serif';

      if (sale.isCredit && !sale.isPaid) {
        ctx.fillStyle = '#fef2f2';
        ctx.fillRect(25, currentY, bannerWidth, bannerHeight);
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.strokeRect(25, currentY, bannerWidth, bannerHeight);
        ctx.fillStyle = '#b91c1c';
        ctx.fillText(
          `PAIEMENT DIFFÉRÉ — ÉCHÉANCE : ${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString('fr-FR') : 'N/A'}`,
          canvasWidth / 2, currentY + 20
        );
      } else {
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(25, currentY, bannerWidth, bannerHeight);
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1;
        ctx.strokeRect(25, currentY, bannerWidth, bannerHeight);
        ctx.fillStyle = '#15803d';
        ctx.fillText('PAIEMENT COMPTANT (SOLDE)', canvasWidth / 2, currentY + 20);
      }

      currentY += bannerHeight + 25;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 10px "Inter", sans-serif';
      ctx.fillText('Merci pour votre confiance ! 🐔', canvasWidth / 2, currentY);
      ctx.fillText('AgriPoulet Pro — Sénégal', canvasWidth / 2, currentY + 14);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }, []);

  const handleDownloadReceipt = useCallback(async (sale: Sale) => {
    const client = data.clients.find(c => c.id === sale.clientId);
    const blob = await generateSaleReceiptBlob(sale, sale.clientNom, client?.tel || '');
    if (!blob) { addToast('Erreur de génération', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Facture_${sale.clientNom.replace(/\s+/g, '_')}_${new Date(sale.dateVente).toISOString().split('T')[0]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Reçu téléchargé !', 'success');
  }, [data.clients, generateSaleReceiptBlob, addToast]);

  const handleCopyReceipt = useCallback(async (sale: Sale) => {
    const client = data.clients.find(c => c.id === sale.clientId);
    const blob = await generateSaleReceiptBlob(sale, sale.clientNom, client?.tel || '');
    if (!blob) { addToast('Erreur de génération', 'error'); return; }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      addToast('Reçu copié ! Collez-le (Ctrl+V) sur WhatsApp.', 'success');
    } catch {
      addToast('Copie non supportée dans ce navigateur.', 'info');
    }
  }, [data.clients, generateSaleReceiptBlob, addToast]);

  const handleShareSaleWhatsApp = useCallback(async (sale: Sale) => {
    const client = data.clients.find(c => c.id === sale.clientId);
    const tel = client?.tel || '';
    const blob = await generateSaleReceiptBlob(sale, sale.clientNom, tel);
    if (!blob) { addToast('Erreur de génération', 'error'); return; }
    const items = sale.factureItems || [];
    let text = `*AGRIPOULET PRO - FACTURE* 🐔\n---------------------------------\n`;
    text += `*Client :* ${sale.clientNom}\n*Date :* ${new Date(sale.dateVente).toLocaleDateString('fr-FR')}\n`;
    text += `*Statut :* ${sale.isCredit && !sale.isPaid ? 'Crédit' : 'Payé'}\n---------------------------------\n`;
    items.forEach(item => {
      text += `- ${item.designation} (x${item.qte}) : *${(item.qte * item.prixU).toLocaleString('fr-FR')} F*\n`;
    });
    text += `---------------------------------\n*TOTAL : ${sale.total.toLocaleString('fr-FR')} F CFA*\n\n`;
    text += `Voir l'image jointe pour les détails. 🙏🐔`;

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch { /* ignore */ }
    const url = formatWhatsAppUrl(tel || '00000000', text);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else addToast('Numéro invalide.', 'error');
  }, [data.clients, generateSaleReceiptBlob, addToast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Ventes & Crédits</h2>
        <div className="flex items-center gap-2">
          {permissions.includes('ventes.facturier') && (
          <button 
            onClick={() => onTabChange?.('facturier')}
            className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-4 py-3 rounded-2xl border border-orange-100/50 dark:border-orange-900/30 text-xs font-bold active:scale-95 transition-transform"
            title="Facturier mobile WhatsApp"
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Facturier</span>
          </button>
          )}
          <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Plus /></button>
        </div>
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
               <div className="text-[10px] text-gray-400">{formatDateShort(s.dateVente)} • {s.pouletIds.length} poulet(s)</div>
               {s.isCredit && (() => {
                 const remaining = getRemainingBalance(s);
                 const isFullyPaid = remaining <= 0;
                 const totalPayments = getTotalPayments(s);
                 const hasPartialPayments = totalPayments > 0 && !isFullyPaid;
                 return (
                   <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                     <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isFullyPaid ? 'bg-green-100 text-green-600' : hasPartialPayments ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                       {isFullyPaid ? 'PAYÉ' : hasPartialPayments ? `${formatNumber(remaining)} F RESTANTS` : `CRÉDIT (${s.dueDate ? formatDateShort(s.dueDate) : '?'})`}
                     </span>
                     {hasPartialPayments && (
                       <span className="text-[8px] text-yellow-600 font-medium">
                         {formatNumber(totalPayments)} F versés
                       </span>
                     )}
                   </div>
                 );
               })()}
             </div>
             <div className="flex items-center gap-1">
               <div className="text-right mr-2">
                 <div className="font-black text-orange-600">{formatCurrency(s.total)}</div>
               </div>
               <button onClick={() => setEditingSale(s)} className="p-2 text-gray-300 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
               <button onClick={() => handleDeleteSale(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
               <button onClick={() => setSelectedSale(s)} className="p-2 text-gray-300 hover:text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
             </div>
          </div>
        ))}
        {filteredSales.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Aucune vente enregistrée</p>}
      </div>

      {/* Modal Nouvelle Vente */}
      <Modal isOpen={isAddModalOpen} onClose={resetAddModal} title="Nouvelle Vente">
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
                  {b.nom} ({b.quantite && b.quantite > 0 ? b.quantite : b.poulets.filter(p => !p.vendu).length} dispos)
                </option>
              ))}
            </select>
          </div>
          
          {/* Quantité pour lots groupés */}
          {selectedBatch?.quantite && selectedBatch.quantite > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantité à vendre</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQteVente(Math.max(1, qteVente - 1))} className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 font-bold text-lg flex items-center justify-center active:scale-90">-</button>
                <input
                  type="number" min="1" max={selectedBatch.quantite}
                  value={qteVente}
                  onChange={(e) => setQteVente(Math.min(selectedBatch.quantite, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 p-3 border rounded-xl bg-gray-50 dark:bg-gray-800 text-center text-lg font-bold dark:text-white outline-none"
                />
                <button type="button" onClick={() => setQteVente(Math.min(selectedBatch.quantite, qteVente + 1))} className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 font-bold text-lg flex items-center justify-center active:scale-90">+</button>
              </div>
            </div>
          )}
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-3xl space-y-3 border border-orange-100 dark:border-orange-800/50 shadow-sm">
            <label className="text-[10px] font-black text-orange-400 dark:text-orange-300 uppercase ml-1">{selectedBatch?.quantite && selectedBatch.quantite > 0 ? 'Vendre au prix unitaire (F)' : 'Ajouter un poulet (Saisie Prix)'}</label>
            <div className="flex gap-2">
              <QuickAddGrid
                options={[3500, 4000, 4500, 5000]}
                onSelect={(price) => {
                  setPriceInput(String(price));
                  handleAddToBasket();
                }}
              />
              <input type="hidden" value={priceInput} readOnly />
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
                  <span className="px-2 py-1 rounded-lg text-[10px] font-black tracking-wider bg-orange-100 text-orange-700">{p.isGroup ? `x${p.quantiteGroupe}` : p.numero}</span>
                  <div className="flex-1">
                    <div className="text-[9px] text-gray-400">{p.isGroup ? `${p.quantiteGroupe} poulet(s)` : `${p.poids} kg`}</div>
                  </div>
                  <div className="font-black text-orange-600 text-sm">{formatCurrency(p.prix)}</div>
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
            <div className="text-xl font-black">{formatCurrency(basket.reduce((acc, p) => acc + p.prix, 0))}</div>
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
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none select-none -rotate-12">
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
                  {selectedSale.factureItems ? (
                    <>
                      <div className="grid grid-cols-3 text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">
                        <span>Désignation</span>
                        <span className="text-center">Qté</span>
                        <span className="text-right">Prix</span>
                      </div>
                      <div className="h-px bg-gray-100" />
                      {selectedSale.factureItems.map((item, i) => (
                        <div key={i} className="grid grid-cols-3 items-center px-1 text-sm">
                          <span className="text-gray-700">{item.designation}</span>
                          <span className="text-center text-gray-500">x{item.qte}</span>
                          <span className="text-right font-black text-orange-600">{formatCurrency(item.qte * item.prixU)}</span>
                        </div>
                      ))}
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200 grid grid-cols-3 text-xs px-1">
                        <span className="text-gray-500">Nbre de poulets</span>
                        <span className="text-center text-gray-500"></span>
                        <span className="text-right font-black text-orange-600">{selectedSale.factureItems.reduce((s, i) => s + i.qte, 0)}</span>
                      </div>
                    </>
                  ) : selectedSale.pouletIds.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">
                        <span>Réf / Matricule</span>
                        <span className="text-center">Poids</span>
                        <span className="text-right">Prix</span>
                      </div>
                      <div className="h-px bg-gray-100" />
                      {getSaleChickens(selectedSale.pouletIds).map(p => (
                        <div key={p.id} className="grid grid-cols-3 items-center px-1 text-sm">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider bg-orange-100 text-orange-700 inline-block w-fit">{p.numero}</span>
                          <span className="text-center text-gray-500">{p.poids} kg</span>
                          <span className="text-right font-black text-orange-600">{formatCurrency(p.prix)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4 italic">Détails indisponibles pour cette ancienne facture</p>
                  )}
                </div>

               <div className="h-px bg-gray-100 mb-4" />

               <div className="flex justify-between items-end">
                 <div>
                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Statut Paiement</div>
                   <div className={`text-xs font-black px-3 py-1 rounded-full inline-block ${isSalePaid(selectedSale) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {!selectedSale.isCredit ? 'PAYÉ COMPTANT' : isSalePaid(selectedSale) ? 'PAYÉ' : 'À CRÉDIT'}
                   </div>
                   {selectedSale.isCredit && !isSalePaid(selectedSale) && selectedSale.dueDate && (
                     <div className="text-[9px] text-red-400 mt-1 font-bold">Échéance: {formatDateShort(selectedSale.dueDate)}</div>
                   )}
                 </div>
                 <div className="text-right">
                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Total Général</div>
                   <div className="text-2xl font-black text-gray-900">{formatCurrency(selectedSale.total)}</div>
                 </div>
               </div>
            </div>

            <div className="flex flex-col gap-3">

              {/* Payment History Section */}
              {selectedSale.isCredit && (selectedSale.payments || []).length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-700">Historique des paiements</h4>
                  </div>
                  <div className="space-y-2">
                    {(selectedSale.payments || []).map(p => (
                      <div key={p.id} className="bg-blue-50 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span className="font-bold text-gray-800">{formatCurrency(p.montant)}</span>
                          </div>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400">
                            {formatDateWithTime(p.date)}
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
                             p.methode === 'wave' ? '📱 Wave' : ''}
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
                      {formatCurrency(getTotalPayments(selectedSale))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Solde restant</span>
                    <span className={`text-sm font-black ${getRemainingBalance(selectedSale) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {getRemainingBalance(selectedSale) > 0
                        ? formatCurrency(getRemainingBalance(selectedSale))
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
                    onClick={() => handleFullPayment(selectedSale)}
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
                      {formatCurrency(getTotalPayments(selectedSale))} versés sur {formatCurrency(selectedSale.total)}
                    </div>
                  </div>
                </div>
              )}
              
               {/* Share / Export Actions */}
               <div className="grid grid-cols-3 gap-2">
                 <button
                   onClick={() => handleDownloadReceipt(selectedSale)}
                   className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-all dark:text-white"
                 >
                   <Download className="w-4 h-4 text-gray-600" />
                   Télécharger
                 </button>
                 <button
                   onClick={() => handleCopyReceipt(selectedSale)}
                   className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-all dark:text-white"
                 >
                   <Copy className="w-4 h-4 text-gray-600" />
                   Copier
                 </button>
                 <button
                   onClick={() => handleShareSaleWhatsApp(selectedSale)}
                   className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                 >
                   <Send className="w-4 h-4" />
                   WhatsApp
                 </button>
               </div>

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

      {/* Modal Modifier Vente */}
      <Modal isOpen={!!editingSale} onClose={() => setEditingSale(null)} title="Modifier la Vente">
        {editingSale && (
          <form onSubmit={handleEditSale} className="space-y-4">
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
                <div className="text-3xl font-black text-blue-700">{formatCurrency(remaining)}</div>
                <div className="text-xs text-blue-400">sur {formatCurrency(sale.total)}</div>
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
                <select name="methode" required className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm appearance-none">
                  <option value="especes">💵 Espèces</option>
                  <option value="orange_money">📱 Orange Money</option>
                  <option value="wave">📱 Wave</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Note (optionnelle)</label>
                <input name="note" type="text" placeholder="Ex: Avance, reliquat..." className="w-full p-4 border rounded-2xl bg-gray-50 outline-none text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setIsPaymentModalOpen(false); setPaymentSaleId(null); }} className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-transform">Annuler</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Enregistrer</button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </div>
  );
};
