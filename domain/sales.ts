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
 * Filtre les lots de stock disponibles (avec des poulets non vendus / quantite > 0 et non réservés)
 */
export function getAvailableBatches(
  stockBatches: StockBatch[],
  reservedPouletIds: Set<string>
): StockBatch[] {
  return stockBatches.filter(b =>
    (b.quantite && b.quantite > 0) ||
    b.poulets.some(p => !p.vendu && !reservedPouletIds.has(p.id))
  );
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
  factureItems?: { designation: string; qte: number; prixU: number; poids: number }[];
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
    factureItems: params.factureItems,
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
    poulets: (b.poulets || []).map(p =>
      pouletIds.includes(p.id) ? { ...p, vendu: true } : p
    ),
  }));
}

/**
 * Déduit une quantité de poulets du stock, en priorisant :
 * 1. Les lots groupés (quantite), en décrémentant le champ quantite
 * 2. Les poulets individuels, en marquant les premiers non vendus comme vendu
 * Retourne les lots mis à jour + les IDs des poulets vendus
 */
export function deductStockByQuantity(
  stockBatches: StockBatch[],
  quantite: number
): { updated: StockBatch[]; venduIds: string[] } {
  const venduIds: string[] = [];
  let restant = quantite;

  const updated = stockBatches.map(b => {
    if (restant <= 0) return b;

    // 1. Lots groupés : décrémenter quantite
    if (b.quantite && b.quantite > 0) {
      const pris = Math.min(restant, b.quantite);
      restant -= pris;
      return {
        ...b,
        // Garantir tous les champs requis par les règles Firestore
        poulets: b.poulets ?? [],
        typeOrigine: b.typeOrigine || 'PR',
        lettre: b.lettre || '',
        prixKg: b.prixKg || 0,
        coutInitial: b.coutInitial || 0,
        isFinalized: b.isFinalized ?? false,
        quantite: b.quantite - pris,
      };
    }

    // 2. Poulets individuels : marquer comme vendu
    const nonVendus = (b.poulets || []).filter(p => !p.vendu).length;
    if (nonVendus <= 0) return b;

    const aPrendre = Math.min(restant, nonVendus);
    let compteur = 0;
    const nouveauPoulets = (b.poulets || []).map(p => {
      if (compteur >= aPrendre) return p;
      if (p.vendu) return p;
      compteur++;
      restant--;
      venduIds.push(p.id);
      return { ...p, vendu: true };
    });

    return {
      ...b,
      poulets: nouveauPoulets,
      typeOrigine: b.typeOrigine || 'PR',
      lettre: b.lettre || '',
      prixKg: b.prixKg || 0,
      coutInitial: b.coutInitial || 0,
      isFinalized: b.isFinalized ?? false,
    };
  });

  return { updated, venduIds };
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
    poulets: (b.poulets || []).map(p =>
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
