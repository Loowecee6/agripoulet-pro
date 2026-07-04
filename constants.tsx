
import { Vaccination } from './types';

export const PROGRAMME_VACCINATION: Vaccination[] = [
  { jours: [1, 2, 3], traitement: 'Anti Stress', produits: ['COVIT', 'NEMOVIT', 'NEOXYVITAL'], effectuee: false },
  { jours: [9], traitement: 'Gumboro', produits: ['GUMBO-L'], effectuee: false },
  { jours: [16], traitement: 'Rappel Gumboro', produits: ['IBDL'], effectuee: false },
  { jours: [21], traitement: 'Rappel Newcastle', produits: ['LASOTA'], effectuee: false }
];

// Courbe de croissance Sénégal (poids vif en g, J1-J42)
// Basée sur: J1=44g (éclosion) → J42=2000g vidé (≈2740g vif, rendement 73%)
// Échelle: 57.2% du standard Cobb 500 — adaptée aux conditions tropicales
export const POIDS_THEORIQUE_REFERENCE: Record<number, number> = {
  1: 44, 2: 53, 3: 64, 4: 78, 5: 95, 6: 115, 7: 138, 8: 164, 9: 193, 10: 224,
  11: 258, 12: 296, 13: 336, 14: 379, 15: 424, 16: 473, 17: 524, 18: 579, 19: 636, 20: 696,
  21: 759, 22: 825, 23: 893, 24: 965, 25: 1039, 26: 1115, 27: 1196, 28: 1279, 29: 1365, 30: 1453,
  31: 1545, 32: 1639, 33: 1736, 34: 1836, 35: 1939, 36: 2045, 37: 2153, 38: 2265, 39: 2379, 40: 2496,
  41: 2617, 42: 2740
};

// Poids vidé estimé (73% du poids vif)
export const POIDS_VIDE_REFERENCE: Record<number, number> =
  Object.fromEntries(
    Object.entries(POIDS_THEORIQUE_REFERENCE).map(([j, vif]) => [Number(j), Math.round(vif * 0.73)])
  );

// Poids cible à J42 (poids vidé / poids vif)
export const POIDS_CIBLE_J42 = { vif: 2740, vide: 2000 };

export const TABS = [
  { id: 'production', label: 'Production', icon: 'ClipboardList' },
  { id: 'stock', label: 'Stock', icon: 'Box' },
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'ventes', label: 'Ventes', icon: 'ShoppingCart' },
  { id: 'rapport', label: 'Rapports', icon: 'BarChart' }
];
