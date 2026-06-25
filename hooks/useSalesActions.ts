/**
 * hooks/useSalesActions.ts
 * Handlers CRUD pour les ventes
 * Extraits de VentesView.tsx pour améliorer la maintenabilité
 */

import React, { useState, useMemo, useCallback } from 'react';
import { AppData, Sale, Chicken, StockBatch, Payment } from '../types';
import { getRemainingBalance, getTotalPayments, isSalePaid } from '../utils/creditHelpers';
import {
  getReservedPouletIds,
  getAvailableBatches,
  getSaleChickens,
  createSale,
  validateCredit,
  markChickensAsSold,
  markChickensAsUnsold,
  deductStockByQuantity,
  processPayment,
} from '../domain/sales';

interface UseSalesActionsOptions {
  data: AppData;
  setData: (d: AppData) => void;
  addToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useSalesActions({ data, setData, addToast }: UseSalesActionsOptions) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // État pour la création d'une vente
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [basket, setBasket] = useState<Chicken[]>([]);
  const [priceInput, setPriceInput] = useState<string>('');
  const [qteVente, setQteVente] = useState<number>(1);

  // IDs des poulets réservés
  const reservedPouletIds = useMemo(() => getReservedPouletIds(data.reservations), [data.reservations]);

  const availableBatches = useMemo(
    () => getAvailableBatches(data.stockBatches, reservedPouletIds),
    [data.stockBatches, reservedPouletIds]
  );

  const selectedBatch = data.stockBatches.find(b => b.id === selectedBatchId);

  const filteredSales = data.sales.filter(s =>
    !('deletedAt' in s) && s.clientNom.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddToBasket = useCallback(() => {
    if (!selectedBatchId) return alert("Choisissez d'abord un lot de stock.");
    if (!priceInput) return;

    const targetBatch = data.stockBatches.find(b => b.id === selectedBatchId);
    if (!targetBatch) return;

    const targetPrice = Number(priceInput);

    // Lot groupé (quantite)
    if (targetBatch.quantite && targetBatch.quantite > 0) {
      const qte = Math.min(qteVente, targetBatch.quantite);
      if (qte <= 0) return addToast('Stock insuffisant.', 'error');
      const virtual: Chicken = {
        id: `${targetBatch.id}-groupe-${Date.now()}`,
        numero: `${targetBatch.nom} x${qte}`,
        poids: 0,
        prix: targetPrice * qte,
        vendu: false,
        isGroup: true,
        quantiteGroupe: qte,
      };
      setBasket(prev => [...prev, virtual]);
      setPriceInput('');
      addToast(`${qte} poulet(s) ajouté(s) au panier`, 'success');
      return;
    }

    // Poulets individuels
    const foundChicken = targetBatch.poulets.find(
      p => !p.vendu && !reservedPouletIds.has(p.id) && p.prix === targetPrice && !basket.some(bp => bp.id === p.id)
    );

    if (foundChicken) {
      setBasket(prev => [...prev, foundChicken]);
      setPriceInput('');
      addToast('Poulet ajouté au panier', 'success');
    } else {
      addToast(`Aucun poulet disponible à ${targetPrice} Frs dans ce lot.`, 'error');
    }
  }, [selectedBatchId, priceInput, qteVente, data.stockBatches, reservedPouletIds, basket, addToast]);

  const handleRemoveFromBasket = useCallback((id: string) => {
    setBasket(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleAddSale = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (basket.length === 0) return addToast('Votre panier est vide.', 'error');

      const f = new FormData(e.currentTarget);
      const clientId = f.get('clientId') as string;
      const client = data.clients.find(c => c.id === clientId);
      if (!client) return addToast('Veuillez sélectionner un client.', 'error');

      // Calculer la quantité totale (individuels + groupes)
      const totalQte = basket.reduce((acc, p) => acc + ((p as any).quantiteGroupe || 1), 0);
      const basketIds = basket.filter(p => !(p as any).isGroup).map(p => p.id);
      const total = basket.reduce((acc, p) => acc + p.prix, 0);
      const isCredit = f.get('isCredit') === 'on';
      const dueDateRaw = f.get('dueDate') as string;

      if (isCredit) {
        const error = validateCredit(dueDateRaw);
        if (error) return addToast(error, 'error');
      }

      const { updated: updatedStock, venduIds } = deductStockByQuantity(data.stockBatches, totalQte);

      const factureItems = basket.map(p => {
        if ((p as any).isGroup) {
          return {
            designation: 'Poulet de chair',
            qte: (p as any).quantiteGroupe || 1,
            prixU: Math.round(p.prix / ((p as any).quantiteGroupe || 1)),
            poids: 0,
          };
        }
        return {
          designation: 'Poulet de chair',
          qte: 1,
          prixU: p.prix,
          poids: p.poids,
        };
      });

      const newSale = createSale({
        clientId: client.id,
        clientNom: client.nom,
        pouletIds: [...new Set([...basketIds, ...venduIds])],
        total,
        isCredit,
        dueDateRaw,
        factureItems,
      });

      setData({ ...data, stockBatches: updatedStock, sales: [newSale, ...data.sales] });
      setIsAddModalOpen(false);
      setBasket([]);
      setSelectedBatchId('');
      setQteVente(1);
      addToast('Vente enregistrée avec succès', 'success');
    },
    [basket, data, setData, addToast]
  );

  const handleDeleteSale = useCallback(
    (saleId: string) => {
      if (!confirm('Supprimer cette vente ? Les poulets seront remis en stock.')) return;
      const sale = data.sales.find(s => s.id === saleId);
      if (!sale) return;

      // Soft-delete : marquer comme supprimé au lieu d'effacer
      const updatedStock = markChickensAsUnsold(data.stockBatches, sale.pouletIds);
      const deletedSale = {
        ...sale,
        deletedAt: new Date().toISOString(),
        deletedBy: 'user',
      };
      setData({
        ...data,
        stockBatches: updatedStock,
        sales: data.sales.map(s => (s.id === saleId ? deletedSale : s)),
      });
      if (selectedSale?.id === saleId) setSelectedSale(null);
      addToast('Vente supprimée (soft-delete)', 'info');
    },
    [data, setData, selectedSale, addToast]
  );

  const handleAddPayment = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!paymentSaleId) return;

      // Protection anti-double-clic
      if (isProcessingPayment) return;

      const f = new FormData(e.currentTarget);
      const montant = Number(f.get('montant'));
      if (!montant || montant <= 0) return addToast('Montant invalide', 'error');

      const sale = data.sales.find(s => s.id === paymentSaleId);
      if (!sale) return;

      const remaining = getRemainingBalance(sale);
      if (montant > remaining) {
        return addToast(`Le montant ne peut pas dépasser le solde restant (${remaining} Frs)`, 'error');
      }

      // Générer une clé d'idempotence unique
      const paymentKey = `${paymentSaleId}-${Date.now()}`;
      if (idempotencyKey === paymentKey) return;
      setIdempotencyKey(paymentKey);

      setIsProcessingPayment(true);

      try {
        const { updatedSale } = processPayment(
          sale,
          montant,
          f.get('methode') as string,
          f.get('note') as string
        );

        setData({
          ...data,
          sales: data.sales.map(s => (s.id === paymentSaleId ? updatedSale : s)),
        });

        if (selectedSale?.id === paymentSaleId) {
          setSelectedSale(updatedSale);
        }

        setIsPaymentModalOpen(false);
        setPaymentSaleId(null);
        addToast(`Paiement de ${montant} Frs enregistré`, 'success');
        if (updatedSale.isPaid) {
          addToast('Vente entièrement soldée !', 'success');
        }
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [data, paymentSaleId, selectedSale, setData, addToast, isProcessingPayment, idempotencyKey]
  );

  const handleEditSale = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingSale) return;

      const f = new FormData(e.currentTarget);
      const clientId = f.get('clientId') as string;
      const client = data.clients.find(c => c.id === clientId);
      if (!client) return addToast('Client invalide', 'error');

      const isCredit = f.get('isCredit') === 'on';
      const dueDateRaw = f.get('dueDate') as string;

      if (isCredit) {
        const error = validateCredit(dueDateRaw);
        if (error) return addToast(error, 'error');
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

      setData({ ...data, sales: data.sales.map(s => (s.id === editingSale.id ? updated : s)) });
      setEditingSale(null);
      addToast('Vente modifiée', 'success');
    },
    [data, editingSale, setData, addToast]
  );

  const handleFullPayment = useCallback(
    (sale: Sale) => {
      if (isProcessingPayment) return;
      const remaining = getRemainingBalance(sale);
      if (!confirm(`Confirmer le paiement total de ${remaining.toLocaleString()} Frs ?`)) return;

      const paymentKey = `full-${sale.id}-${Date.now()}`;
      if (idempotencyKey === paymentKey) return;
      setIdempotencyKey(paymentKey);

      setIsProcessingPayment(true);

      try {
        const { updatedSale } = processPayment(sale, remaining, 'especes', 'Paiement intégral');

        setData({
          ...data,
          sales: data.sales.map(s => (s.id === sale.id ? updatedSale : s)),
        });

        setSelectedSale(updatedSale);
        addToast('Vente entièrement soldée !', 'success');
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [data, setData, addToast, isProcessingPayment, idempotencyKey]
  );

  const resetAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setBasket([]);
    setSelectedBatchId('');
    setQteVente(1);
  }, []);

  return {
    // États
    isAddModalOpen,
    setIsAddModalOpen,
    selectedSale,
    setSelectedSale,
    editingSale,
    setEditingSale,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentSaleId,
    setPaymentSaleId,
    search,
    setSearch,
    selectedBatchId,
    setSelectedBatchId,
    basket,
    setBasket,
    priceInput,
    setPriceInput,
    qteVente,
    setQteVente,
    // Données dérivées
    reservedPouletIds,
    availableBatches,
    selectedBatch,
    filteredSales,
    getSaleChickens: (pouletIds: string[]) => getSaleChickens(data.stockBatches, pouletIds),
    // Handlers
    handleAddToBasket,
    handleRemoveFromBasket,
    handleAddSale,
    handleDeleteSale,
    handleAddPayment,
    handleEditSale,
    handleFullPayment,
    resetAddModal,
  };
}
