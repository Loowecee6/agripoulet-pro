/**
 * Tests d'intégration pour offlineService.ts (searchIndex)
 *
 * Utilise fake-indexeddb pour simuler IndexedDB en mémoire.
 * Teste les 3 fonctions de recherche :
 * - rebuildSearchIndex
 * - searchByClientId
 * - searchByDateVente
 *
 * ATTENTION : fake-indexeddb/auto doit être importé AVANT tout module
 * qui utilise IndexedDB, pour que tous les globaux (IDBRequest, IDBObjectStore,
 * IDBTransaction, etc.) soient disponibles.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── Initialisation fake-indexeddb (polyfill complet) ───────
// fake-indexeddb/auto ajoute automatiquement tous les globaux IndexedDB
import 'fake-indexeddb/auto';

// Maintenant on peut importer le module qui utilise idb
const { offlineService } = await import('../offlineService');

// ── Helpers ────────────────────────────────────────────────

const TEST_USER = 'user-test-123';

const mockAppData = {
  productionBatches: [],
  stockBatches: [],
  clients: [
    { id: 'c1', nom: 'Diallo', adresse: 'Dakar', tel: '771234567' },
    { id: 'c2', nom: 'Faye', adresse: 'Thies', tel: '772345678' },
    { id: 'c3', nom: 'Ndiaye', adresse: 'Saint-Louis', tel: '773456789' },
  ],
  sales: [
    { id: 's1', clientId: 'c1', clientNom: 'Diallo', pouletIds: ['p1'], total: 15000, isCredit: true, isPaid: false, dateVente: '2026-06-15', dueDate: '2026-07-01' },
    { id: 's2', clientId: 'c1', clientNom: 'Diallo', pouletIds: ['p2'], total: 8000, isCredit: false, isPaid: true, dateVente: '2026-06-20' },
    { id: 's3', clientId: 'c2', clientNom: 'Faye', pouletIds: ['p3'], total: 25000, isCredit: true, isPaid: false, dateVente: '2026-06-15', dueDate: '2026-06-30' },
  ],
  reservations: [],
  settings: { adminPasswordHash: '' },
};

// ── Tests ──────────────────────────────────────────────────

describe('offlineService - Search Index', () => {
  beforeAll(async () => {
    // Reconstruire l'index avant les tests
    await offlineService.rebuildSearchIndex(TEST_USER, mockAppData);
  });

  describe('rebuildSearchIndex', () => {
    it('reconstruit l\'index avec les ventes et clients', async () => {
      // Vérifier via les recherches que l'index a bien été construit
      const dialloSales = await offlineService.searchByClientId(TEST_USER, 'c1');
      const fayeSales = await offlineService.searchByClientId(TEST_USER, 'c2');
      const ndiayeResult = await offlineService.searchByClientId(TEST_USER, 'c3');

      // C1 (Diallo) : 2 ventes + 1 client = 3 entrées
      expect(dialloSales.length).toBeGreaterThanOrEqual(2);
      // C2 (Faye) : 1 vente + 1 client = 2 entrées
      expect(fayeSales.length).toBeGreaterThanOrEqual(1);
      // C3 (Ndiaye) : 0 vente + 1 client = 1 entrée
      expect(ndiayeResult.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('searchByClientId', () => {
    it('retourne les entrées d\'index pour un client donné', async () => {
      const results = await offlineService.searchByClientId(TEST_USER, 'c1');
      expect(results.length).toBeGreaterThanOrEqual(2);

      const saleEntries = results.filter((r: any) => r.type === 'sale');
      expect(saleEntries.length).toBeGreaterThanOrEqual(2);

      // Vérifier les IDs formatés
      const saleIds = saleEntries.map((r: any) => r.id);
      expect(saleIds).toContain('sale-s1');
      expect(saleIds).toContain('sale-s2');
    });

    it('inclut les entrées client dans les résultats', async () => {
      const results = await offlineService.searchByClientId(TEST_USER, 'c3');
      const clientEntries = results.filter((r: any) => r.type === 'client');
      expect(clientEntries.length).toBe(1);
      expect(clientEntries[0].id).toBe('client-c3');
      expect(clientEntries[0].clientNom).toBe('Ndiaye');
    });

    it('retourne les bonnes informations de vente', async () => {
      const results = await offlineService.searchByClientId(TEST_USER, 'c2');
      const salesForC2 = results.filter((r: any) => r.type === 'sale');
      expect(salesForC2).toHaveLength(1);
      expect(salesForC2[0].total).toBe(25000);
      expect(salesForC2[0].clientNom).toBe('Faye');
    });

    it('retourne un tableau vide pour un client inconnu', async () => {
      const results = await offlineService.searchByClientId(TEST_USER, 'unknown-client');
      expect(results).toEqual([]);
    });

    it('ne mélange pas les données entre utilisateurs', async () => {
      const otherUser = 'user-other';
      const results = await offlineService.searchByClientId(otherUser, 'c1');
      expect(results).toEqual([]);
    });
  });

  describe('searchByDateVente', () => {
    it('retourne les ventes pour une date donnée', async () => {
      const results = await offlineService.searchByDateVente(TEST_USER, '2026-06-15');
      expect(results.length).toBeGreaterThanOrEqual(2);
      const sales = results.filter((r: any) => r.type === 'sale');
      expect(sales.length).toBeGreaterThanOrEqual(2);
    });

    it('retourne un tableau vide pour une date sans vente', async () => {
      const results = await offlineService.searchByDateVente(TEST_USER, '2026-01-01');
      const sales = results.filter((r: any) => r.type === 'sale');
      expect(sales).toEqual([]);
    });

    it('filtre par userId', async () => {
      const results = await offlineService.searchByDateVente('other-user', '2026-06-15');
      expect(results).toEqual([]);
    });
  });

  describe('Intégration : rebuild puis recherche', () => {
    it('searcher après un rebuild avec nouvelles données', async () => {
      const newData = {
        ...mockAppData,
        clients: [
          ...mockAppData.clients,
          { id: 'c4', nom: 'Ba', adresse: 'Kaolack', tel: '774567890' },
        ],
        sales: [
          ...mockAppData.sales,
          { id: 's4', clientId: 'c4', clientNom: 'Ba', pouletIds: ['p4'], total: 12000, isCredit: false, isPaid: true, dateVente: '2026-06-25' },
        ],
      };

      await offlineService.rebuildSearchIndex(TEST_USER, newData);

      const baResults = await offlineService.searchByClientId(TEST_USER, 'c4');
      expect(baResults.length).toBeGreaterThanOrEqual(1);

      const sale = baResults.find((r: any) => r.type === 'sale');
      expect(sale?.total).toBe(12000);
    });

    it('nettoie les anciennes entrées après rebuild', async () => {
      // Le rebuild précédent n'avait pas c3 (Ndiaye) dans les ventes
      // Vérifier qu'il n'y a pas de vente orpheline
      const results = await offlineService.searchByClientId(TEST_USER, 'c3');
      const salesForC3 = results.filter((r: any) => r.type === 'sale');
      // C3 n'a pas de vente, mais a un client
      expect(salesForC3).toEqual([]);
    });

    it('maintient l\'index utilisateur séparé', async () => {
      const otherData = {
        ...mockAppData,
        clients: [{ id: 'c100', nom: 'Autre', adresse: 'X', tel: '700000000' }],
        sales: [],
      };
      await offlineService.rebuildSearchIndex('user-b', otherData);

      const c1Results = await offlineService.searchByClientId('user-b', 'c1');
      expect(c1Results).toEqual([]);

      const c100Results = await offlineService.searchByClientId('user-b', 'c100');
      expect(c100Results.length).toBe(1);
    });
  });

  describe('Cas d\'erreur', () => {
    it('gère les données vides (no sales, no clients)', async () => {
      await offlineService.rebuildSearchIndex('empty-user', {
        productionBatches: [], stockBatches: [], clients: [], sales: [],
        reservations: [], settings: { adminPasswordHash: '' },
      });

      const results = await offlineService.searchByClientId('empty-user', 'anything');
      expect(results).toEqual([]);
    });

    it('gère les ventes sans clientId correspondant', async () => {
      await offlineService.rebuildSearchIndex(TEST_USER, {
        ...mockAppData,
        sales: [
          { id: 's-orphan', clientId: 'nonexistent', clientNom: 'Ghost', pouletIds: [], total: 5000, isCredit: false, isPaid: true, dateVente: '2026-06-30' },
        ],
        clients: [],
      });

      const results = await offlineService.searchByClientId(TEST_USER, 'nonexistent');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
