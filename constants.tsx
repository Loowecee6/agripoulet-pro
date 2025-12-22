
import { Vaccination } from './types';

export const PROGRAMME_VACCINATION: Vaccination[] = [
  { jours: [1, 2, 3], traitement: 'Anti Stress', produits: ['COVIT', 'NEMOVIT', 'NEOXYVITAL'], effectuee: false },
  { jours: [9], traitement: 'Gumboro', produits: ['GUMBO-L'], effectuee: false },
  { jours: [16], traitement: 'Rappel Gumboro', produits: ['IBDL'], effectuee: false },
  { jours: [21], traitement: 'Rappel Newcastle', produits: ['LASOTA'], effectuee: false }
];

export const POIDS_THEORIQUE_REFERENCE: Record<number, number> = {
  1: 55, 2: 71, 3: 90, 4: 112, 5: 138, 6: 168, 7: 202, 8: 240, 9: 283, 10: 330,
  11: 382, 12: 440, 13: 503, 14: 570, 15: 639, 16: 711, 17: 786, 18: 864, 19: 945, 20: 1029,
  21: 1116, 22: 1205, 23: 1296, 24: 1390, 25: 1486, 26: 1583, 27: 1682, 28: 1783, 29: 1886, 30: 1989,
  31: 2094, 32: 2200, 33: 2306, 34: 2413, 35: 2521
};

export const TABS = [
  { id: 'production', label: 'Production', icon: 'ClipboardList' },
  { id: 'stock', label: 'Stock', icon: 'Box' },
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'ventes', label: 'Ventes', icon: 'ShoppingCart' },
  { id: 'rapport', label: 'Rapports', icon: 'BarChart' }
];
