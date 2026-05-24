/**
 * domain/sales.ts
 * Fonctions pures pour la gestion des ventes
 * Extraites de VentesView.tsx pour améliorer la testabilité
 */

import { AppData, Chicken, Reservation, Sale, StockBatch } from '../types';

/**
 * Retourne l'ensemble des IDs de poulets réservés (non vendus, réservations actives)
 */
export function getReservedPouletIds(reservations: Reservation[]): Set<string> {
  return new Set(
    reservations
      .filter(r => r.statut !== 'cancelled' && r.statut !== 'completed')
      .flatMap(r => r.pouletIds)
  );
}

/**
 * Filtre les lots de stock disponibles (avec des poulets non vendus et non réservés)
 */
export function getAvailableBatches(
  stockBatches: StockBatch[],
  reservedPouletIds: Set<string>
): StockBatch[] {
  return stockBatches.filter(b => b.poulets.some(p => !p.vendu && !reservedPouletIds.has(p.id)));
}

/**
 * Récupère les détails des poulets d'une vente depuis les lots de stock
 */
export function getSaleChickens(stockBatches: StockBatch[], pouletIds: string[]): Chicken[] {
  const details: Chicken[] = [];
  stockBatches.forEach(batch => {
    batch.poulets.forEach(p => {
      if (pouletIds.includes(p.id)) details.push(p);
    });
  });
  return details;
}

/**
 * Crée une nouvelle vente
 */
export function createSale(params: {
  clientId: string;
  clientNom: string;
  pouletIds: string[];
  total: number;
  isCredit: boolean;
  dueDateRaw?: string;
}): Sale {
  return {
    id: crypto.randomUUID(),
    clientId: params.clientId,
    clientNom: params.clientNom,
    pouletIds: params.pouletIds,
    total: params.total,
    isCredit: params.isCredit,
    dueDate: params.isCredit && params.dueDateRaw ? params.dueDateRaw : undefined,
    isPaid: !params.isCredit,
    dateVente: new Date().toISOString(),
  };
}

/**
 * Valide les contraintes d'une vente à crédit
 * Retourne un message d'erreur ou null si valide
 */
export function validateCredit(dueDateRaw?: string): string | null {
  if (!dueDateRaw) {
    return "Veuillez définir une date d'échéance pour le crédit.";
  }
  const maxDate = new Date(Date.now() + 15 * 86400000);
  if (new Date(dueDateRaw) > maxDate) {
    return 'Le crédit ne peut pas dépasser 15 jours. Choisissez une date plus proche.';
  }
  return null;
}

/**
 * Marque les poulets comme vendus dans les lots de stock
 */
export function markChickensAsSold(
  stockBatches: StockBatch[],
  pouletIds: string[]
): StockBatch[] {
  return stockBatches.map(b => ({
    ...b,
    poulets: b.poulets.map(p =>
      pouletIds.includes(p.id) ? { ...p, vendu: true } : p
    ),
  }));
}

/**
 * Remet les poulets en stock (annulation de vente)
 */
export function markChickensAsUnsold(
  stockBatches: StockBatch[],
  pouletIds: string[]
): StockBatch[] {
  return stockBatches.map(b => ({
    ...b,
    poulets: b.poulets.map(p =>
      pouletIds.includes(p.id) ? { ...p, vendu: false } : p
    ),
  }));
}

/**
 * Met à jour les paiements d'une vente et détermine si elle est soldée
 */
export function processPayment(
  sale: Sale,
  montant: number,
  methode?: string,
  note?: string
): { updatedSale: Sale; payment: import('../types').Payment } {
  const payment = {
    id: crypto.randomUUID(),
    montant,
    date: new Date().toISOString(),
    methode: methode as any || undefined,
    note: note || undefined,
  };

  const existingPayments = sale.payments || [];
  const totalAfter = existingPayments.reduce((s, p) => s + p.montant, 0) + montant;

  return {
    payment,
    updatedSale: {
      ...sale,
      payments: [...existingPayments, payment],
      isPaid: totalAfter >= sale.total,
    },
  };
}
