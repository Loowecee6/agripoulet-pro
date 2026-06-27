/**
 * Tests unitaires pour storageService.ts
 *
 * Les helpers purs (sanitize, ensureAppData, getDefaultData, cache)
 * sont testés sans mocking.
 * writeEntities, saveData, loadData utilisent vi.doMock + dynamic import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers de mock ───────────────────────────────────────────────

/** Crée un mock Firebase de base */
function createFirebaseMocks(overrides: Record<string, any> = {}) {
  return {
    collection: vi.fn(),
    doc: vi.fn((_db: any, _coll: string, id: string) => ({ id: _coll + '/' + id })),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    addDoc: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => new Date()),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    // Requis car firebaseConfig.ts appelle getFirestore()
    getFirestore: vi.fn(() => ({})),
    ...overrides,
  };
}

/** Applique les mocks et importe storageService */
async function importWithMocks(firebaseOverrides: Record<string, any> = {}) {
  vi.doMock('firebase/firestore', () => createFirebaseMocks(firebaseOverrides));
  vi.doMock('../firebaseConfig', () => ({ db: {} }));
  vi.doMock('../offlineService', () => ({
    offlineService: {
      saveLocalData: vi.fn().mockResolvedValue(undefined),
      getLocalData: vi.fn().mockResolvedValue(null),
      addToSyncQueue: vi.fn().mockResolvedValue(undefined),
      clearSyncQueue: vi.fn().mockResolvedValue(undefined),
      getSyncQueue: vi.fn().mockResolvedValue([]),
    },
  }));
  return await import('../storageService');
}

// ── Tests des fonctions pures ──────────────────────────────────────

import {
  sanitize,
  ensureAppData,
  getDefaultData,
  knownIdsCache,
  updateCache,
  resetCache,
} from '../storageService';

describe('sanitize', () => {
  it('removes undefined from objects', () => {
    expect(sanitize({ a: 1, b: undefined, c: 'hello' })).toEqual({ a: 1, c: 'hello' });
  });

  it('removes undefined from nested objects', () => {
    expect(sanitize({ a: 1, nested: { x: 10, y: undefined, z: null } }))
      .toEqual({ a: 1, nested: { x: 10, z: null } });
  });

  it('replaces undefined in arrays with null', () => {
    expect(sanitize([1, undefined, 3])).toEqual([1, null, 3]);
  });

  it('preserves empty objects from sanitized arrays', () => {
    expect(sanitize([{ a: undefined }, { b: 2 }])).toEqual([{}, { b: 2 }]);
  });

  it('replaces undefined array items with null', () => {
    expect(sanitize([undefined, { b: 2 }])).toEqual([null, { b: 2 }]);
  });

  it('preserves null, 0, false, empty string', () => {
    expect(sanitize({ a: null, b: 0, c: false, d: '' }))
      .toEqual({ a: null, b: 0, c: false, d: '' });
  });

  it('returns primitives as-is', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize('hello')).toBe('hello');
    expect(sanitize(null)).toBeNull();
    expect(sanitize(true)).toBe(true);
  });

  it('handles deeply nested structures', () => {
    const result = sanitize({
      level1: { level2: { value: 42, gone: undefined, arr: [1, undefined, 3] } },
    });
    expect(result).toEqual({
      level1: { level2: { value: 42, arr: [1, null, 3] } },
    });
    expect('gone' in result.level1.level2).toBe(false);
  });

  it('handles empty objects and arrays', () => {
    expect(sanitize({})).toEqual({});
    expect(sanitize([])).toEqual([]);
  });
});

describe('ensureAppData', () => {
  it('fills missing fields with defaults', () => {
    expect(ensureAppData({})).toEqual({
      productionBatches: [],
      stockBatches: [],
      clients: [],
      sales: [],
      reservations: [],
      settings: { adminPasswordHash: '' },
      activityLog: undefined,
      userPermissions: undefined,
      fcmToken: undefined,
      fcmPushFunctionUrl: undefined,
    });
  });

  it('preserves existing data', () => {
    const result = ensureAppData({
      productionBatches: [{
        id: 'b1', nom: 'Batch 1', dateMisePlace: '2026-01-01',
        nbPoussinsInitial: 100, prixAchatPoussin: 500,
        suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active' as const,
      }],
      settings: { adminPasswordHash: 'hash123' },
    });
    expect(result.productionBatches).toHaveLength(1);
    expect(result.productionBatches[0].nom).toBe('Batch 1');
    expect(result.settings.adminPasswordHash).toBe('hash123');
  });

  it('preserves optional fields', () => {
    const result = ensureAppData({
      activityLog: [{
        id: 'log1', date: '2026-01-01', userId: 'u1',
        userName: 'Admin', userRole: 'super_admin' as const,
        action: 'login' as const, description: 'Login',
      }],
      userPermissions: { u1: ['production.view'] },
      fcmToken: 'fcm-token-123',
      fcmPushFunctionUrl: 'https://example.com/push',
    });
    expect(result.activityLog).toHaveLength(1);
    expect(result.activityLog?.[0].action).toBe('login');
    expect(result.userPermissions).toEqual({ u1: ['production.view'] });
    expect(result.fcmToken).toBe('fcm-token-123');
    expect(result.fcmPushFunctionUrl).toBe('https://example.com/push');
  });
});

describe('getDefaultData', () => {
  it('returns correct default structure', () => {
    const data = getDefaultData();
    expect(data.productionBatches).toEqual([]);
    expect(data.stockBatches).toEqual([]);
    expect(data.settings).toHaveProperty('adminPasswordHash');
    expect(data.settings.notifications?.enabled).toBe(true);
  });
});

// ── Cache memory tests ─────────────────────────────────────────────

describe('Cache mémoire', () => {
  beforeEach(() => resetCache());

  it('initial state: all null', () => {
    expect(knownIdsCache.productionBatches).toBeNull();
    expect(knownIdsCache.stockBatches).toBeNull();
    expect(knownIdsCache.clients).toBeNull();
    expect(knownIdsCache.sales).toBeNull();
    expect(knownIdsCache.reservations).toBeNull();
  });

  it('updateCache sets the cache entry', () => {
    updateCache('productionBatches', new Set(['id1', 'id2']));
    expect(knownIdsCache.productionBatches?.has('id1')).toBe(true);
    expect(knownIdsCache.productionBatches?.has('id2')).toBe(true);
  });

  it('updateCache only affects the specified key', () => {
    updateCache('productionBatches', new Set(['p1']));
    updateCache('clients', new Set(['c1']));
    expect(knownIdsCache.productionBatches).toEqual(new Set(['p1']));
    expect(knownIdsCache.clients).toEqual(new Set(['c1']));
    expect(knownIdsCache.stockBatches).toBeNull();
  });

  it('updateCache overwrites previous value', () => {
    updateCache('sales', new Set(['s1']));
    updateCache('sales', new Set(['s2', 's3']));
    expect(knownIdsCache.sales).toEqual(new Set(['s2', 's3']));
    expect(knownIdsCache.sales?.has('s1')).toBe(false);
  });

  it('resetCache resets all entries to null', () => {
    for (const k of ['productionBatches', 'stockBatches', 'clients', 'sales', 'reservations'] as const) {
      updateCache(k, new Set(['x']));
    }
    resetCache();
    expect(knownIdsCache.productionBatches).toBeNull();
    expect(knownIdsCache.stockBatches).toBeNull();
    expect(knownIdsCache.clients).toBeNull();
    expect(knownIdsCache.sales).toBeNull();
    expect(knownIdsCache.reservations).toBeNull();
  });
});

// ── getDeletedIdsCached ────────────────────────────────────────────

describe('getDeletedIdsCached', () => {
  beforeEach(() => vi.resetModules());

  it('reads from Firestore on first call (cache null)', async () => {
    const mod = await importWithMocks({
      getDocs: vi.fn().mockResolvedValue({
        docs: [{ id: 'a' }, { id: 'b' }, { id: 'to-delete' }],
      }),
    });
    const deleted = await mod.getDeletedIdsCached('productionBatches', new Set(['a', 'b']));
    expect(deleted).toEqual(['to-delete']);
    expect(mod.knownIdsCache.productionBatches).toEqual(new Set(['a', 'b', 'to-delete']));
  });

  it('uses cache on subsequent calls (no Firestore read)', async () => {
    const mockGetDocs = vi.fn();
    const mod = await importWithMocks({ getDocs: mockGetDocs });
    mod.updateCache('productionBatches', new Set(['a', 'b', 'c']));

    const deleted = await mod.getDeletedIdsCached('productionBatches', new Set(['a', 'c']));
    expect(deleted).toEqual(['b']);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns empty array if no deletions', async () => {
    const mod = await importWithMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [{ id: 'a' }, { id: 'b' }] }),
    });
    const deleted = await mod.getDeletedIdsCached('clients', new Set(['a', 'b']));
    expect(deleted).toEqual([]);
  });

  it('handles Firestore error gracefully', async () => {
    const mod = await importWithMocks({
      getDocs: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const deleted = await mod.getDeletedIdsCached('stockBatches', new Set(['s1']));
    expect(deleted).toEqual([]);
  });
});

// ── writeEntities ──────────────────────────────────────────────────

describe('writeEntities', () => {
  beforeEach(() => vi.resetModules());

  it('creates a writeBatch and commits it', async () => {
    const mockCommit = vi.fn().mockResolvedValue(undefined);
    const mod = await importWithMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
      writeBatch: vi.fn(() => ({
        set: vi.fn(), delete: vi.fn(), commit: mockCommit,
      })),
    });

    const data = getDefaultData();
    data.productionBatches = [{
      id: 'b1', nom: 'Test', dateMisePlace: '2026-01-01',
      nbPoussinsInitial: 100, prixAchatPoussin: 400,
      suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active',
    }];
    data.clients = [{ id: 'c1', nom: 'Client A', tel: '771234567', adresse: 'Dakar' }];

    await mod.storageService.writeEntities(data);
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it('updates the cache after successful commit', async () => {
    const mod = await importWithMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    });

    const data = getDefaultData();
    data.productionBatches = [{
      id: 'b1', nom: 'B1', dateMisePlace: '2026-01-01',
      nbPoussinsInitial: 100, prixAchatPoussin: 400,
      suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active',
    }];

    await mod.storageService.writeEntities(data);
    expect(mod.knownIdsCache.productionBatches).toEqual(new Set(['b1']));
    // Les autres collections doivent aussi être dans le cache (vides)
    expect(mod.knownIdsCache.clients).toEqual(new Set());
    expect(mod.knownIdsCache.stockBatches).toEqual(new Set());
    expect(mod.knownIdsCache.sales).toEqual(new Set());
    expect(mod.knownIdsCache.reservations).toEqual(new Set());
  });

  it('deletes docs that are no longer in the data', async () => {
    const mockDelete = vi.fn();
    const mod = await importWithMocks({
      // Firestore a 'old-b1' mais pas dans les nouvelles données
      getDocs: vi.fn().mockResolvedValue({ docs: [{ id: 'old-b1' }] }),
      writeBatch: vi.fn(() => ({
        set: vi.fn(), delete: mockDelete, commit: vi.fn().mockResolvedValue(undefined),
      })),
    });

    const data = getDefaultData();
    data.productionBatches = [{
      id: 'new-b1', nom: 'New B1', dateMisePlace: '2026-01-01',
      nbPoussinsInitial: 100, prixAchatPoussin: 400,
      suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active',
    }];

    await mod.storageService.writeEntities(data);
    // 'old-b1' a été supprimé de productionBatches → delete appelé
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ── saveData ───────────────────────────────────────────────────────

describe('saveData', () => {
  beforeEach(() => vi.resetModules());

  it('saves locally then syncs to Firestore', async () => {
    const mockSaveLocal = vi.fn().mockResolvedValue(undefined);
    const mockClearQueue = vi.fn().mockResolvedValue(undefined);
    const mockCommit = vi.fn().mockResolvedValue(undefined);

    vi.doMock('firebase/firestore', () => createFirebaseMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
      writeBatch: vi.fn(() => ({
        set: vi.fn(), delete: vi.fn(), commit: mockCommit,
      })),
    }));
    vi.doMock('../firebaseConfig', () => ({ db: {} }));
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: mockSaveLocal,
        getLocalData: vi.fn(),
        addToSyncQueue: vi.fn(),
        clearSyncQueue: mockClearQueue,
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));

    const { storageService: svc } = await import('../storageService');
    const data = getDefaultData();
    await svc.saveData('user-1', data);
    expect(mockSaveLocal).toHaveBeenCalledWith('user-1', data);
    expect(mockClearQueue).toHaveBeenCalled();
  });

  it('queues data when Firestore fails (offline)', async () => {
    const mockAddToQueue = vi.fn().mockResolvedValue(undefined);
    vi.doMock('firebase/firestore', () => createFirebaseMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
      writeBatch: vi.fn(() => ({
        set: vi.fn(), delete: vi.fn(),
        commit: vi.fn().mockRejectedValue(new Error('Write failed - offline')),
      })),
    }));
    vi.doMock('../firebaseConfig', () => ({ db: {} }));
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: vi.fn().mockResolvedValue(undefined),
        getLocalData: vi.fn(),
        addToSyncQueue: mockAddToQueue,
        clearSyncQueue: vi.fn(),
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));

    const { storageService: svc } = await import('../storageService');
    await svc.saveData('user-1', getDefaultData());
    expect(mockAddToQueue).toHaveBeenCalled();
  });

  it('does nothing if userId is empty', async () => {
    const mockSaveLocal = vi.fn();
    vi.doMock('../offlineService', () => ({
      offlineService: { saveLocalData: mockSaveLocal },
    }));
    vi.doMock('firebase/firestore', () => createFirebaseMocks());
    vi.doMock('../firebaseConfig', () => ({ db: {} }));

    const { storageService: svc } = await import('../storageService');
    await svc.saveData('', getDefaultData());
    expect(mockSaveLocal).not.toHaveBeenCalled();
  });
});

// ── forceSync ──────────────────────────────────────────────────────

describe('forceSync', () => {
  beforeEach(() => vi.resetModules());

  it('returns true on success', async () => {
    const mod = await importWithMocks({ getDocs: vi.fn().mockResolvedValue({ docs: [] }) });
    const result = await mod.storageService.forceSync('user-1', getDefaultData());
    expect(result).toBe(true);
  });

  it('returns false if saveLocalData fails', async () => {
    // saveData ne catch PAS les erreurs de saveLocalData (hors try/catch)
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: vi.fn().mockRejectedValue(new Error('IndexedDB full')),
        getLocalData: vi.fn(),
        addToSyncQueue: vi.fn(),
        clearSyncQueue: vi.fn(),
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));
    vi.doMock('firebase/firestore', () => createFirebaseMocks());
    vi.doMock('../firebaseConfig', () => ({ db: {} }));

    const { storageService: svc } = await import('../storageService');
    const result = await svc.forceSync('user-1', getDefaultData());
    expect(result).toBe(false);
  });
});

// ── loadData ───────────────────────────────────────────────────────

describe('loadData', () => {
  beforeEach(() => vi.resetModules());

  it('loads from Firestore collections when data exists', async () => {
    // Simuler getDocs qui retourne des données pour productionBatches
    let callCount = 0;
    const mockGetDocs = vi.fn().mockImplementation(() => {
      callCount++;
      // Premier appel = productionBatches
      if (callCount === 1) {
        return Promise.resolve({
          docs: [{
            id: 'b1',
            data: () => ({ nom: 'B1', dateMisePlace: '2026-01-01', nbPoussinsInitial: 100, prixAchatPoussin: 400, suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active' }),
          }],
        });
      }
      // Autres collections = vides
      return Promise.resolve({ docs: [] });
    });

    const mod = await importWithMocks({ getDocs: mockGetDocs });
    const data = await mod.storageService.loadData('user-1');
    expect(data.productionBatches).toHaveLength(1);
    expect(data.productionBatches[0].nom).toBe('B1');
    expect(data.settings.adminPasswordHash).toBe('');
  });

  it('migrates from old singleton when new collections are empty', async () => {
    const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
    let getDocCallCount = 0;

    const mockGetDoc = vi.fn().mockImplementation(() => {
      getDocCallCount++;
      // Premier getDoc = settings (vides)
      // Deuxième getDoc = userPermissions (vides)
      // Troisième getDoc = fcmConfig (vide)
      // Quatrième getDoc = sharedData/singleton => existe
      if (getDocCallCount >= 4) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            productionBatches: [{
              id: 'old-b1', nom: 'Old Batch', dateMisePlace: '2026-01-01',
              nbPoussinsInitial: 50, prixAchatPoussin: 300,
              suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active',
            }],
            stockBatches: [], clients: [], sales: [], reservations: [],
            settings: { adminPasswordHash: 'old-hash' },
          }),
        });
      }
      return Promise.resolve({ exists: () => false });
    });

    vi.doMock('firebase/firestore', () => createFirebaseMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
      getDoc: mockGetDoc,
      deleteDoc: mockDeleteDoc,
    }));
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: vi.fn(),
        getLocalData: vi.fn().mockResolvedValue(null),
        addToSyncQueue: vi.fn(),
        clearSyncQueue: vi.fn(),
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));

    const { storageService: svc } = await import('../storageService');
    const data = await svc.loadData('user-1');

    expect(data.productionBatches).toHaveLength(1);
    expect(data.productionBatches[0].nom).toBe('Old Batch');
    expect(data.settings.adminPasswordHash).toBe('old-hash');
  });

  it('falls back to local cache when Firestore is empty', async () => {
    const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
    const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false });

    vi.doMock('firebase/firestore', () => createFirebaseMocks({
      getDocs: mockGetDocs,
      getDoc: mockGetDoc,
    }));
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: vi.fn(),
        // getLocalData retourne directement AppData (pas l'objet IndexedDB complet)
        getLocalData: vi.fn().mockResolvedValue({
          productionBatches: [{
            id: 'local-b1', nom: 'Local Batch', dateMisePlace: '2026-01-01',
            nbPoussinsInitial: 100, prixAchatPoussin: 400,
            suiviQuotidien: [], depenses: [], vaccinations: [], statut: 'active',
          }],
          stockBatches: [],
          clients: [],
          sales: [],
          reservations: [],
          settings: { adminPasswordHash: 'local-hash' },
        }),
        addToSyncQueue: vi.fn(),
        clearSyncQueue: vi.fn(),
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));

    const { storageService: svc } = await import('../storageService');
    const data = await svc.loadData('user-1');

    expect(data.productionBatches).toHaveLength(1);
    expect(data.productionBatches[0].nom).toBe('Local Batch');
    expect(data.settings.adminPasswordHash).toBe('local-hash');
  });

  it('returns defaults when no data found anywhere', async () => {
    vi.doMock('firebase/firestore', () => createFirebaseMocks({
      getDocs: vi.fn().mockResolvedValue({ docs: [] }),
      getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    }));
    vi.doMock('../offlineService', () => ({
      offlineService: {
        saveLocalData: vi.fn(),
        getLocalData: vi.fn().mockResolvedValue(null),
        addToSyncQueue: vi.fn(),
        clearSyncQueue: vi.fn(),
        getSyncQueue: vi.fn().mockResolvedValue([]),
      },
    }));

    const { storageService: svc } = await import('../storageService');
    const data = await svc.loadData('user-1');
    expect(data.productionBatches).toEqual([]);
    expect(data.settings.adminPasswordHash).toBe('');
  });

  it('returns defaults if userId is empty', async () => {
    const { storageService: svc } = await import('../storageService');
    const data = await svc.loadData('');
    expect(data.productionBatches).toEqual([]);
    expect(data.settings.adminPasswordHash).toBe('');
  });
});
