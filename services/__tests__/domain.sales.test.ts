/**
 * Tests unitaires pour domain/sales.ts
 *
 * Teste toutes les fonctions pures :
 * - getReservedPouletIds, getAvailableBatches, getSaleChickens
 * - createSale, validateCredit
 * - markChickensAsSold, markChickensAsUnsold
 * - deductStockByQuantity, processPayment
 */

import { describe, it, expect } from 'vitest';
import type { StockBatch, Reservation, Sale, Chicken } from '../../types';
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
} from '../../domain/sales';

// ── Helpers ────────────────────────────────────────────────

function createChicken(id: string, numero: string, options?: Partial<Chicken>): Chicken {
  return {
    id, numero, poids: 2.0, prix: 4000, vendu: false,
    ...options,
  };
}

function createStockBatch(id: string, options?: Partial<StockBatch>): StockBatch {
  return {
    id, nom: `Lot ${id}`, lettre: 'A', prixKg: 2000, coutInitial: 50000,
    typeOrigine: 'PR', poulets: [], isFinalized: true,
    ...options,
  };
}

function createReservation(id: string, options?: Partial<Reservation>): Reservation {
  return {
    id, clientId: 'c1', clientNom: 'Client', pouletIds: ['p1'],
    dateReserve: '2026-07-01', statut: 'pending',
    createdAt: '2026-06-15', ...options,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('getReservedPouletIds', () => {
  it('returns IDs from pending reservations', () => {
    const reservations = [createReservation('r1', { pouletIds: ['p1', 'p2'] })];
    expect(getReservedPouletIds(reservations)).toEqual(new Set(['p1', 'p2']));
  });

  it('includes confirmed reservations', () => {
    const reservations = [createReservation('r1', { statut: 'confirmed', pouletIds: ['p3'] })];
    expect(getReservedPouletIds(reservations)).toEqual(new Set(['p3']));
  });

  it('excludes cancelled reservations', () => {
    const reservations = [createReservation('r1', { statut: 'cancelled', pouletIds: ['p4'] })];
    expect(getReservedPouletIds(reservations)).toEqual(new Set());
  });

  it('excludes completed reservations', () => {
    const reservations = [createReservation('r1', { statut: 'completed', pouletIds: ['p5'] })];
    expect(getReservedPouletIds(reservations)).toEqual(new Set());
  });

  it('handles multiple reservations', () => {
    const reservations = [
      createReservation('r1', { pouletIds: ['p1', 'p2'] }),
      createReservation('r2', { statut: 'confirmed', pouletIds: ['p3'] }),
      createReservation('r3', { statut: 'cancelled', pouletIds: ['p4'] }),
    ];
    expect(getReservedPouletIds(reservations)).toEqual(new Set(['p1', 'p2', 'p3']));
  });

  it('handles empty reservations', () => {
    expect(getReservedPouletIds([])).toEqual(new Set());
  });
});

describe('getAvailableBatches', () => {
  it('includes batches with unsold chickens', () => {
    const batches = [
      createStockBatch('b1', { poulets: [createChicken('p1', 'A001')] }),
    ];
    expect(getAvailableBatches(batches, new Set())).toHaveLength(1);
  });

  it('includes batches with positive quantite', () => {
    const batches = [
      createStockBatch('b1', { poulets: [], quantite: 5 }),
    ];
    expect(getAvailableBatches(batches, new Set())).toHaveLength(1);
  });

  it('excludes batches with no available chickens', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [createChicken('p1', 'A001', { vendu: true })],
      }),
    ];
    expect(getAvailableBatches(batches, new Set())).toHaveLength(0);
  });

  it('excludes batches where all chickens are reserved', () => {
    const batches = [
      createStockBatch('b1', { poulets: [createChicken('p1', 'A001')] }),
    ];
    expect(getAvailableBatches(batches, new Set(['p1']))).toHaveLength(0);
  });

  it('includes batch when some chickens are available and some are reserved', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001'),
          createChicken('p2', 'A002', { vendu: true }),
        ],
      }),
    ];
    expect(getAvailableBatches(batches, new Set())).toHaveLength(1);
  });

  it('handles empty batches', () => {
    expect(getAvailableBatches([], new Set())).toEqual([]);
  });
});

describe('getSaleChickens', () => {
  it('returns chicken details for given IDs', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001'),
          createChicken('p2', 'A002'),
        ],
      }),
      createStockBatch('b2', {
        poulets: [createChicken('p3', 'B001')],
      }),
    ];
    const result = getSaleChickens(batches, ['p1', 'p3']);
    expect(result).toHaveLength(2);
    expect(result[0].numero).toBe('A001');
    expect(result[1].numero).toBe('B001');
  });

  it('returns empty array when no IDs match', () => {
    const batches = [createStockBatch('b1', { poulets: [createChicken('p1', 'A001')] })];
    expect(getSaleChickens(batches, ['p999'])).toEqual([]);
  });
});

describe('createSale', () => {
  it('creates a cash sale', () => {
    const sale = createSale({
      clientId: 'c1', clientNom: 'Diallo',
      pouletIds: ['p1'], total: 5000, isCredit: false,
    });
    expect(sale.clientId).toBe('c1');
    expect(sale.clientNom).toBe('Diallo');
    expect(sale.total).toBe(5000);
    expect(sale.isCredit).toBe(false);
    expect(sale.isPaid).toBe(true);
    expect(sale.id).toBeDefined();
    expect(sale.dateVente).toBeDefined();
    expect(sale.dueDate).toBeUndefined();
    expect(sale.payments).toBeUndefined();
  });

  it('creates a credit sale with due date', () => {
    const sale = createSale({
      clientId: 'c1', clientNom: 'Faye',
      pouletIds: ['p1', 'p2'], total: 10000, isCredit: true,
      dueDateRaw: '2026-07-01',
    });
    expect(sale.isCredit).toBe(true);
    expect(sale.isPaid).toBe(false);
    expect(sale.dueDate).toBe('2026-07-01');
  });

  it('creates credit sale without due date (optional)', () => {
    const sale = createSale({
      clientId: 'c1', clientNom: 'Ba',
      pouletIds: ['p1'], total: 5000, isCredit: true,
    });
    expect(sale.dueDate).toBeUndefined();
  });

  it('includes factureItems when provided', () => {
    const sale = createSale({
      clientId: 'c1', clientNom: 'Ndiaye',
      pouletIds: ['p1'], total: 4000, isCredit: false,
      factureItems: [{ designation: 'Poulet', qte: 1, prixU: 4000, poids: 2.0 }],
    });
    expect(sale.factureItems).toHaveLength(1);
    expect(sale.factureItems![0].designation).toBe('Poulet');
  });

  it('generates unique IDs for each sale', () => {
    const sale1 = createSale({ clientId: 'c1', clientNom: 'A', pouletIds: [], total: 0, isCredit: false });
    const sale2 = createSale({ clientId: 'c1', clientNom: 'B', pouletIds: [], total: 0, isCredit: false });
    expect(sale1.id).not.toBe(sale2.id);
  });
});

describe('validateCredit', () => {
  it('returns error when no due date', () => {
    expect(validateCredit(undefined)).toBe("Veuillez définir une date d'échéance pour le crédit.");
  });

  it('returns error when due date exceeds 15 days', () => {
    const future = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0];
    expect(validateCredit(future)).toBe('Le crédit ne peut pas dépasser 15 jours. Choisissez une date plus proche.');
  });

  it('returns null when due date is within 15 days', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    expect(validateCredit(future)).toBeNull();
  });

  it('returns null when due date is today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(validateCredit(today)).toBeNull();
  });

  it('handles exactly 15 days (boundary)', () => {
    const fifteenDays = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    expect(validateCredit(fifteenDays)).toBeNull();
  });
});

describe('markChickensAsSold', () => {
  it('marks specified chickens as sold', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001'),
          createChicken('p2', 'A002'),
        ],
      }),
    ];
    const result = markChickensAsSold(batches, ['p1']);
    expect(result[0].poulets[0].vendu).toBe(true);
    expect(result[0].poulets[1].vendu).toBe(false);
  });

  it('does not modify other batches', () => {
    const batches = [
      createStockBatch('b1', { poulets: [createChicken('p1', 'A001')] }),
      createStockBatch('b2', { poulets: [createChicken('p2', 'B001')] }),
    ];
    const result = markChickensAsSold(batches, ['p1']);
    expect(result[1].poulets[0].vendu).toBe(false);
  });

  it('handles empty pouletIds', () => {
    const batches = [createStockBatch('b1', { poulets: [createChicken('p1', 'A001')] })];
    const result = markChickensAsSold(batches, []);
    expect(result[0].poulets[0].vendu).toBe(false);
  });

  it('preserves other chicken properties', () => {
    const batches = [createStockBatch('b1', { poulets: [createChicken('p1', 'A001', { poids: 2.5, prix: 5000 })] })];
    const result = markChickensAsSold(batches, ['p1']);
    expect(result[0].poulets[0].poids).toBe(2.5);
    expect(result[0].poulets[0].prix).toBe(5000);
    expect(result[0].poulets[0].numero).toBe('A001');
  });
});

describe('markChickensAsUnsold', () => {
  it('marks specified chickens as unsold', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001', { vendu: true }),
          createChicken('p2', 'A002', { vendu: true }),
        ],
      }),
    ];
    const result = markChickensAsUnsold(batches, ['p1']);
    expect(result[0].poulets[0].vendu).toBe(false);
    expect(result[0].poulets[1].vendu).toBe(true);
  });
});

describe('deductStockByQuantity', () => {
  it('deducts from grouped batch (quantite)', () => {
    const batches = [createStockBatch('b1', { poulets: [], quantite: 10 })];
    const { updated, venduIds } = deductStockByQuantity(batches, 3);
    expect(updated[0].quantite).toBe(7);
    expect(venduIds).toEqual([]);
  });

  it('deducts exactly what is available from grouped batch', () => {
    const batches = [createStockBatch('b1', { poulets: [], quantite: 5 })];
    const { updated, venduIds } = deductStockByQuantity(batches, 5);
    expect(updated[0].quantite).toBe(0);
    expect(venduIds).toEqual([]);
  });

  it('deducts from individual chickens when no grouped batch', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001'),
          createChicken('p2', 'A002'),
          createChicken('p3', 'A003'),
        ],
      }),
    ];
    const { updated, venduIds } = deductStockByQuantity(batches, 2);
    expect(updated[0].poulets[0].vendu).toBe(true);
    expect(updated[0].poulets[1].vendu).toBe(true);
    expect(updated[0].poulets[2].vendu).toBe(false);
    expect(venduIds).toEqual(['p1', 'p2']);
  });

  it('deducts from grouped batch first, then individual', () => {
    const batches = [
      createStockBatch('b1', { poulets: [], quantite: 3 }),
      createStockBatch('b2', {
        poulets: [
          createChicken('p4', 'A004'),
          createChicken('p5', 'A005'),
        ],
      }),
    ];
    const { updated, venduIds } = deductStockByQuantity(batches, 4);
    expect(updated[0].quantite).toBe(0); // 3 pris du groupe
    expect(updated[1].poulets[0].vendu).toBe(true); // 1 pris individuel
    expect(updated[1].poulets[1].vendu).toBe(false);
    expect(venduIds).toEqual(['p4']);
  });

  it('handles quantity larger than available stock', () => {
    const batches = [createStockBatch('b1', { poulets: [], quantite: 5 })];
    const { updated } = deductStockByQuantity(batches, 10);
    expect(updated[0].quantite).toBe(0); // Prend tout ce qui est dispo
  });

  it('returns empty venduIds when deducting from grouped batch only', () => {
    const batches = [createStockBatch('b1', { poulets: [], quantite: 5 })];
    const { venduIds } = deductStockByQuantity(batches, 3);
    expect(venduIds).toEqual([]);
  });

  it('preserves already sold chickens', () => {
    const batches = [
      createStockBatch('b1', {
        poulets: [
          createChicken('p1', 'A001', { vendu: true }),
          createChicken('p2', 'A002'),
        ],
      }),
    ];
    const { venduIds } = deductStockByQuantity(batches, 2);
    expect(venduIds).toEqual(['p2']);
    // p1 est déjà vendu, on n'en prend qu'un
  });
});

describe('processPayment', () => {
  it('creates a payment and marks sale as paid when fully covered', () => {
    const sale: Sale = {
      id: 's1', clientId: 'c1', clientNom: 'Diallo',
      pouletIds: ['p1'], total: 10000, isCredit: true,
      dueDate: '2026-07-01', isPaid: false, dateVente: '2026-06-15',
    };
    const { updatedSale, payment } = processPayment(sale, 10000, 'especes');
    expect(payment.montant).toBe(10000);
    expect(payment.methode).toBe('especes');
    expect(updatedSale.isPaid).toBe(true);
    expect(updatedSale.payments).toHaveLength(1);
  });

  it('keeps sale unpaid when payment is partial', () => {
    const sale: Sale = {
      id: 's1', clientId: 'c1', clientNom: 'Faye',
      pouletIds: ['p1'], total: 20000, isCredit: true,
      dueDate: '2026-07-01', isPaid: false, dateVente: '2026-06-15',
    };
    const { updatedSale } = processPayment(sale, 5000, 'orange_money');
    expect(updatedSale.isPaid).toBe(false);
    expect(updatedSale.payments).toHaveLength(1);
    expect(updatedSale.payments![0].montant).toBe(5000);
  });

  it('accumulates payments correctly', () => {
    const sale: Sale = {
      id: 's1', clientId: 'c1', clientNom: 'Ba',
      pouletIds: ['p1'], total: 15000, isCredit: true,
      dueDate: '2026-07-01', isPaid: false, dateVente: '2026-06-15',
      payments: [{ id: 'pay1', montant: 5000, date: '2026-06-20', methode: 'especes' }],
    };
    const { updatedSale } = processPayment(sale, 10000, 'wave');
    expect(updatedSale.payments).toHaveLength(2);
    expect(updatedSale.isPaid).toBe(true);
  });

  it('generates unique payment IDs', () => {
    const sale: Sale = {
      id: 's1', clientId: 'c1', clientNom: 'Ndiaye',
      pouletIds: ['p1'], total: 10000, isCredit: true,
      dueDate: '2026-07-01', isPaid: false, dateVente: '2026-06-15',
    };
    const { payment: p1 } = processPayment(sale, 5000);
    const { payment: p2 } = processPayment(sale, 5000);
    expect(p1.id).not.toBe(p2.id);
  });

  it('handles payment method and note', () => {
    const sale: Sale = {
      id: 's1', clientId: 'c1', clientNom: 'Sow',
      pouletIds: ['p1'], total: 10000, isCredit: true,
      dueDate: '2026-07-01', isPaid: false, dateVente: '2026-06-15',
    };
    const { payment } = processPayment(sale, 10000, 'wave', 'Paiement complet');
    expect(payment.methode).toBe('wave');
    expect(payment.note).toBe('Paiement complet');
  });
});
