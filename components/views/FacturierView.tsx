import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Download, Copy, Send, Receipt, User, Phone, Calendar, Check, AlertCircle } from 'lucide-react';
import { AppData, Client, Sale } from '../../types';
import { formatWhatsAppUrl } from '../../utils/whatsapp';
import { deductStockByQuantity } from '../../domain/sales';
import { useToast } from '../common/ToastContext';

interface FacturierViewProps {
  data: AppData;
  setData: (d: AppData) => void;
  onBack: () => void;
  darkMode?: boolean;
}

interface FactureItem {
  id: string;
  designation: string;
  qte: number;
  prixU: number;
  poids: number;
}

export const FacturierView = ({ data, setData, onBack, darkMode }: FacturierViewProps) => {
  const { addToast } = useToast();

  // --- Client State ---
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientNom, setClientNom] = useState<string>('');
  const [clientTel, setClientTel] = useState<string>('');

  // --- Dates & Payment State ---
  const [dateFacture, setDateFacture] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isDeferred, setIsDeferred] = useState<boolean>(false);
  const [dateEcheance, setDateEcheance] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );

  // --- Items Table State ---
  const [items, setItems] = useState<FactureItem[]>([
    { id: '1', designation: 'Poulet de chair', qte: 1, prixU: 4000, poids: 1.5 }
  ]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);

  // --- Autocomplete / Client select handler ---
  useEffect(() => {
    if (selectedClientId === 'new' || selectedClientId === '') {
      if (selectedClientId === 'new') {
        setClientNom('');
        setClientTel('');
      }
    } else {
      const client = data.clients.find(c => c.id === selectedClientId);
      if (client) {
        setClientNom(client.nom);
        setClientTel(client.tel);
      }
    }
  }, [selectedClientId, data.clients]);

  // --- Calculation helper ---
  const totalFacture = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.qte * item.prixU), 0);
  }, [items]);

  const QUICK_PRICES = [3500, 4000, 4500, 5000];

  const itemsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    itemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [items.length]);

  // --- Actions ---
  const handleAddItem = () => {
    const newId = String(Date.now() + Math.random());
    setItems([...items, { id: newId, designation: 'Poulet de chair', qte: 1, prixU: 4000, poids: 1.5 }]);
    setActiveItemIndex(items.length);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      addToast('La facture doit contenir au moins une ligne.', 'warning');
      return;
    }
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    setActiveItemIndex(0);
  };

  const handleUpdateItem = (index: number, key: keyof FactureItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);
  };

  // --- Canvas Rendering helper ---
  const generateCanvasBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const rowHeight = 35;
      const headerHeight = 240;
      const footerHeight = 130;
      const dynamicHeight = items.length * rowHeight;
      const canvasWidth = 500;
      const canvasHeight = headerHeight + dynamicHeight + footerHeight;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // Fill background (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw thin grey border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(5, 5, canvasWidth - 10, canvasHeight - 10);

      // Top banner
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(5, 5, canvasWidth - 10, 15);

      // Logo/Chicken Icon
      ctx.font = '36px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐔', canvasWidth / 2, 65);

      // Header Text
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('AGRIPOULET PRO', canvasWidth / 2, 105);

      ctx.font = 'italic 12px "Inter", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Élevage & Vente de Poulets de Qualité', canvasWidth / 2, 125);

      // Dotted lines
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

      // Invoice info
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillText(`FACTURE N° : FAC-${dateFacture.replace(/-/g, '')}-${String(Math.floor(100 + Math.random() * 900))}`, 25, 160);
      ctx.fillText(`Date : ${new Date(dateFacture).toLocaleDateString('fr-FR')}`, 25, 178);

      // Client info
      ctx.fillText(`Client : ${clientNom || 'Client de passage'}`, 25, 196);
      if (clientTel) {
        ctx.fillText(`Tél : ${clientTel}`, 25, 214);
      }
      const nbPoulets = items.reduce((s, i) => s + i.qte, 0);
      ctx.fillText(`Nb de poulets : ${nbPoulets}`, 25, clientTel ? 232 : 214);

      const infoEnd = clientTel ? 232 : 214;
      drawDottedLine(infoEnd + 18);

      // Table Header
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('Désignation', 25, infoEnd + 40);
      ctx.textAlign = 'right';
      ctx.fillText('Prix (F)', 475, infoEnd + 40);

      drawDottedLine(infoEnd + 52);

      // Table items
      let currentY = infoEnd + 75;
      ctx.font = 'medium 11px "Inter", sans-serif';
      ctx.fillStyle = '#334155';

      items.forEach((item) => {
        ctx.textAlign = 'left';
        let name = item.designation || 'Poulet';
        if (item.qte > 1) {
          name += ` (x${item.qte})`;
        }
        if (name.length > 36) name = name.substring(0, 33) + '...';
        ctx.fillText(name, 25, currentY);

        ctx.textAlign = 'right';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillText(String(item.qte * item.prixU), 475, currentY);
        ctx.font = 'medium 11px "Inter", sans-serif';

        currentY += rowHeight;
      });

      drawDottedLine(currentY - 12);

      // Total
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px "Inter", sans-serif';
      ctx.fillText('TOTAL À PAYER', 25, currentY + 16);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ea580c';
      ctx.font = '900 17px "Inter", sans-serif';
      ctx.fillText(`${totalFacture.toLocaleString('fr-FR')} F CFA`, 475, currentY + 18);

      // Payment Status Banner
      currentY += 45;
      const bannerWidth = canvasWidth - 50;
      const bannerHeight = 32;
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "Inter", sans-serif';

      if (isDeferred) {
        ctx.fillStyle = '#fef2f2';
        ctx.fillRect(25, currentY, bannerWidth, bannerHeight);
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.strokeRect(25, currentY, bannerWidth, bannerHeight);
        ctx.fillStyle = '#b91c1c';
        ctx.fillText(
          `PAIEMENT DIFFÉRÉ — ÉCHÉANCE : ${new Date(dateEcheance).toLocaleDateString('fr-FR')}`,
          canvasWidth / 2,
          currentY + 20
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

      // Footer
      currentY += bannerHeight + 25;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 10px "Inter", sans-serif';
      ctx.fillText('Merci pour votre confiance ! 🐔', canvasWidth / 2, currentY);
      ctx.fillText('AgriPoulet Pro — Facturier WhatsApp', canvasWidth / 2, currentY + 14);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await generateCanvasBlob();
      if (!blob) throw new Error('Impossible de générer le reçu.');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture_${(clientNom || 'Client').replace(/\s+/g, '_')}_${dateFacture}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast('Image du reçu téléchargée avec succès !', 'success');
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de la génération du téléchargement.", 'error');
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const blob = await generateCanvasBlob();
      if (!blob) throw new Error('Impossible de générer le reçu.');

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        addToast('Reçu copié ! Vous pouvez le coller (Ctrl+V / Coller) sur WhatsApp.', 'success');
      } else {
        throw new Error('Presse-papiers non supporté dans ce navigateur.');
      }
    } catch (err: any) {
      console.warn(err);
      addToast('La copie directe a échoué. Utilisez le bouton Télécharger pour enregistrer le reçu.', 'info');
    }
  };

  const handleSaveVente = useCallback(() => {
    if (items.length === 0 || totalFacture <= 0) {
      addToast('Facture vide. Ajoutez au moins une ligne.', 'warning');
      return false;
    }

    // 1. Find or create client
    const telDigits = clientTel.replace(/\D/g, '');
    let client = data.clients.find(c => c.tel.replace(/\D/g, '') === telDigits) || null;
    if (!client && clientNom.trim()) {
      client = {
        id: crypto.randomUUID(),
        nom: clientNom.trim(),
        tel: clientTel.trim(),
        adresse: '',
      };
    }

    // 2. Deduire du stock la quantite totale vendue
    const totalQte = items.reduce((s, i) => s + i.qte, 0);
    const { updated: updatedBatches, venduIds } = deductStockByQuantity(data.stockBatches, totalQte);

      // 3. Create sale entry
    const newSale: Sale = {
      id: crypto.randomUUID(),
      clientId: client?.id || 'inconnu',
      clientNom: clientNom.trim() || 'Client de passage',
      pouletIds: venduIds,
      total: totalFacture,
      isCredit: isDeferred,
      dueDate: isDeferred ? dateEcheance : undefined,
      isPaid: !isDeferred,
      dateVente: new Date(dateFacture).toISOString(),
      factureItems: items.map(i => ({
        designation: i.designation,
        qte: i.qte,
        prixU: i.prixU,
        poids: i.poids,
      })),
    };

    // 4. Update AppData
    const updatedClients = client && !data.clients.find(c => c.id === client.id)
      ? [...data.clients, client]
      : data.clients;
    setData({ ...data, clients: updatedClients, stockBatches: updatedBatches, sales: [newSale, ...data.sales] });

    addToast(`Vente enregistrée ! Stock mis à jour (-${totalQte} poulets)`, 'success');
    return true;
  }, [items, totalFacture, clientNom, clientTel, isDeferred, dateEcheance, dateFacture, data, setData, addToast]);

  const handleShareWhatsApp = () => {
    const ok = handleSaveVente();
    if (!ok) return;
    const cleanPhone = clientTel.trim();
    
    // Construct recap text
    let text = `*AGRIPOULET PRO - FACTURE* 🐔\n`;
    text += `---------------------------------\n`;
    text += `*Client :* ${clientNom || 'Client de passage'}\n`;
    text += `*Date :* ${new Date(dateFacture).toLocaleDateString('fr-FR')}\n`;
    if (isDeferred) {
      text += `*Échéance :* ${new Date(dateEcheance).toLocaleDateString('fr-FR')} (Paiement différé ⚠️)\n`;
    } else {
      text += `*Paiement :* Comptant (Soldé ✅)\n`;
    }
    text += `---------------------------------\n`;
    items.forEach(item => {
      text += `- ${item.designation} (x${item.qte}) : *${(item.qte * item.prixU).toLocaleString('fr-FR')} F*\n`;
    });
    text += `---------------------------------\n`;
    text += `*TOTAL À PAYER : ${totalFacture.toLocaleString('fr-FR')} F CFA*\n\n`;
    text += `Veuillez trouver ci-joint l'image détaillée de votre facture. Merci pour votre confiance ! 🙏🐔`;

    const url = formatWhatsAppUrl(cleanPhone || '00000000', text);
    if (url) {
      // First copy image to clipboard automatically for convenient pasting
      handleCopyToClipboard();
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      addToast('Numéro de téléphone invalide.', 'error');
    }
  };

  return (
    <div className={`space-y-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-95 transition-transform shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <div>
          <h2 className="text-xl font-bold dark:text-white">Facturier Mobile</h2>
          <p className="text-xs text-gray-500">Générer et envoyer des factures par WhatsApp</p>
        </div>
      </div>

      {/* FORM & PREVIEW SPLIT */}
      <div className="space-y-6">
        
        {/* SECTION 1 : CLIENT & METADATA */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-50 dark:border-gray-700">
            <User className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-sm">Informations client & Facture</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            
            {/* Quick search client */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Sélectionner un Client Existant</label>
              <select 
                value={selectedClientId} 
                onChange={(e) => setSelectedClientId(e.target.value)} 
                className="w-full p-4 border border-gray-100 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 outline-none text-sm appearance-none dark:text-white"
              >
                <option value="">-- Client de passage (Saisie libre) --</option>
                {data.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.nom} {c.tel ? `(${c.tel})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Custom Nom client */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Nom du Client</label>
                <input 
                  type="text" 
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  placeholder="Ex: Moussa Diop"
                  className="w-full p-4 border border-gray-100 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 outline-none text-sm dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Téléphone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="tel" 
                    value={clientTel}
                    onChange={(e) => setClientTel(e.target.value)}
                    placeholder="Ex: 771234567"
                    className="w-full p-4 pl-11 border border-gray-100 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 outline-none text-sm dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Date Facture */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Date de la Facture</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="date" 
                  value={dateFacture}
                  onChange={(e) => setDateFacture(e.target.value)}
                  className="w-full p-4 pl-11 border border-gray-100 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 outline-none text-sm dark:text-white"
                />
              </div>
            </div>

            {/* Payment term: cash vs credit */}
            <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold block text-gray-800 dark:text-gray-200">Paiement différé (À Crédit) ?</span>
                  <span className="text-[10px] text-gray-400">Permet de définir une date limite de paiement</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={isDeferred}
                  onChange={(e) => setIsDeferred(e.target.checked)}
                  className="w-6 h-6 accent-orange-600 cursor-pointer rounded-lg"
                />
              </div>

              {isDeferred && (
                <div className="space-y-1 pt-2">
                  <label className="text-[9px] text-gray-400 font-black ml-1 uppercase">Date d'échéance du paiement</label>
                  <input 
                    type="date" 
                    value={dateEcheance}
                    min={dateFacture}
                    onChange={(e) => setDateEcheance(e.target.value)}
                    className="w-full p-3 border border-orange-200 dark:border-orange-800 rounded-xl text-sm outline-none bg-white dark:bg-gray-800 dark:text-white" 
                  />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SECTION 2 : ITEMS LIST */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-50 dark:border-gray-700 mb-4">
            <Receipt className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-sm">Lignes de la facture</h3>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div 
                key={item.id} 
                onClick={() => setActiveItemIndex(index)}
                className={`p-4 rounded-2xl border transition-all space-y-3 relative cursor-pointer ${
                  activeItemIndex === index 
                    ? 'border-orange-500 bg-orange-50/10 dark:bg-orange-950/10 shadow-sm' 
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                {/* Line Header */}
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                    activeItemIndex === index ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    LIGNE {index + 1}
                  </span>
                  
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="Supprimer la ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-12 gap-2">
                  {/* Designation (fixe) */}
                  <div className="col-span-12 sm:col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Désignation</label>
                    <div className="w-full p-2.5 border border-gray-100 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
                      Poulet de chair
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Qté</label>
                    <input 
                      type="number" 
                      min="1"
                      value={item.qte}
                      onChange={(e) => handleUpdateItem(index, 'qte', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 border border-gray-100 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-center font-bold dark:text-white"
                    />
                  </div>

                  {/* Weight per chicken */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Poids/pc (kg)</label>
                    <input 
                      type="number" 
                      min="0" step="0.1"
                      value={item.poids}
                      onChange={(e) => handleUpdateItem(index, 'poids', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full p-2.5 border border-gray-100 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-center dark:text-white"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase font-black">Prix U (F)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={item.prixU}
                      onChange={(e) => handleUpdateItem(index, 'prixU', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full p-2.5 border border-gray-100 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-right font-black text-orange-600 dark:text-orange-400"
                    />
                  </div>

                  {/* Info row: total weight & price/kg */}
                  <div className="col-span-12 flex gap-3 text-[10px] text-gray-400 mt-1">
                    <span>Poids total : <strong className="text-gray-600 dark:text-gray-300">{(item.qte * item.poids).toFixed(1)} kg</strong></span>
                    {item.poids > 0 && (
                      <span>Prix/kg : <strong className="text-gray-600 dark:text-gray-300">{Math.round(item.prixU / item.poids).toLocaleString('fr-FR')} F</strong></span>
                    )}
                  </div>
                </div>

                {/* Quick select prices (only shown on the active item row) */}
                {activeItemIndex === index && (
                  <div className="pt-1.5 flex gap-1.5 flex-wrap items-center">
                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase mr-1">Saisie rapide :</span>
                    {QUICK_PRICES.map((price) => (
                      <button
                        key={price}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUpdateItem(index, 'prixU', price); }}
                        className="px-2.5 py-1 text-[10px] bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg border border-gray-200/50 dark:border-gray-600 hover:border-orange-500 hover:bg-orange-50/50 active:scale-95 transition-all"
                      >
                        {price} F
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddItem}
            className="mt-4 w-full text-sm font-black uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/40 py-4 rounded-2xl border-2 border-dashed border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-950/60 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" /> Ajouter une ligne
          </button>
          <div ref={itemsEndRef} />
        </div>

        {/* SECTION 3 : DETAILED TICKET PREVIEW */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Aperçu du Reçu Mobile (Temps Réel)</label>
          
          <div className="bg-[#fcfbf4] text-gray-800 p-6 rounded-[2.5rem] border border-gray-200/80 shadow-md relative overflow-hidden font-mono max-w-sm mx-auto text-xs selection:bg-orange-100">
            {/* Top jagged teeth visual details */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-repeat-x flex justify-between" style={{ backgroundImage: 'radial-gradient(circle, transparent 30%, #fff 30%)', backgroundSize: '10px 10px' }} />

            {/* Header Content */}
            <div className="text-center space-y-1 mb-4">
              <span className="text-3xl block">🐔</span>
              <h4 className="text-base font-black tracking-wider text-gray-900">AGRIPOULET PRO</h4>
              <p className="text-[9px] text-gray-500 italic font-sans">Élevage & Vente de Poulets de Qualité</p>
              <div className="border-b border-dashed border-gray-300 pt-2" />
            </div>

            {/* Meta facts */}
            <div className="space-y-1 text-[10px] text-gray-600">
              <div><span className="font-bold">FACTURE :</span> FAC-{dateFacture.replace(/-/g, '')}-XXXX</div>
              <div><span className="font-bold">DATE :</span> {new Date(dateFacture).toLocaleDateString('fr-FR')}</div>
              <div><span className="font-bold">CLIENT :</span> {clientNom || 'Client de passage'}</div>
              {clientTel && <div><span className="font-bold">TÉL :</span> {clientTel}</div>}
              <div><span className="font-bold">POULETS :</span> {items.reduce((s, i) => s + i.qte, 0)}</div>
              <div className="border-b border-dashed border-gray-300 pt-2" />
            </div>

            {/* Items Table */}
            <div className="py-2 space-y-1">
              <div className="flex justify-between font-bold text-gray-900 text-[10px]">
                <span className="w-2/3">Désignation</span>
                <span className="w-1/3 text-right">Prix</span>
              </div>
              <div className="border-b border-dashed border-gray-300 py-0.5" />
              {items.map((item, i) => (
                <div key={item.id || i} className="flex justify-between text-gray-700 py-1">
                  <span className="w-2/3 truncate font-sans">
                    {item.designation} {item.qte > 1 ? `(x${item.qte})` : ''}
                  </span>
                  <span className="w-1/3 text-right font-bold text-gray-900">
                    {(item.qte * item.prixU).toLocaleString('fr-FR')} F
                  </span>
                </div>
              ))}
              <div className="border-b border-dashed border-gray-300 pt-1" />
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center py-2 text-gray-900">
              <span className="font-bold text-[11px]">TOTAL À PAYER</span>
              <span className="text-base font-black text-orange-600">{totalFacture.toLocaleString('fr-FR')} F CFA</span>
            </div>

            {/* Payment badge */}
            <div className={`mt-2 p-2 rounded-xl text-center font-bold font-sans text-[10px] ${
              isDeferred 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {isDeferred 
                ? `CRÉDIT (ÉCHÉANCE : ${new Date(dateEcheance).toLocaleDateString('fr-FR')})` 
                : 'PAIEMENT COMPTANT (SOLDE)'}
            </div>

            {/* Footer */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-center text-[9px] text-gray-400 font-sans italic leading-tight">
                <div>Merci pour votre confiance ! 🐔</div>
                <div>AgriPoulet Pro — Sénégal</div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 : QUICK ACTIONS AND SHARING */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-50 dark:border-gray-700">
            <Send className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-sm">Partage & Actions</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button 
              onClick={handleDownload}
              className="p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all dark:text-white"
            >
              <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              Télécharger (PNG)
            </button>

            <button 
              onClick={handleCopyToClipboard}
              className="p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all dark:text-white"
            >
              <Copy className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              Copier le Reçu
            </button>

            <button 
              onClick={handleSaveVente}
              className="col-span-2 p-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-100 dark:shadow-none active:scale-95 transition-all"
            >
              <Check className="w-4 h-4 shrink-0" />
              Enregistrer la vente
            </button>

            <button 
              onClick={handleShareWhatsApp}
              className="col-span-2 p-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-green-100 dark:shadow-none active:scale-95 transition-all"
            >
              <Send className="w-4 h-4 shrink-0" />
              Envoyer par WhatsApp
            </button>
          </div>
          
          <div className="flex gap-2 items-start bg-orange-50/70 dark:bg-orange-950/20 p-3.5 rounded-xl border border-orange-100/50 dark:border-orange-900/30 text-[10px] leading-relaxed text-orange-800 dark:text-orange-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Astuce WhatsApp :</strong> Lorsque vous cliquez sur "Envoyer par WhatsApp", l'application copie automatiquement l'image du reçu dans votre presse-papier. Une fois la discussion WhatsApp ouverte, vous n'avez plus qu'à coller l'image (via le bouton coller ou Ctrl+V) !
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
