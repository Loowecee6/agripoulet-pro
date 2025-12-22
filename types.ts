
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface AppSettings {
  adminPasswordHash: string; // Stocké en clair pour cette version simple, ou hashé
}

export interface DailyRecord {
  date: string;
  jourDeBande: number;
  mort: number;
  conso: number; // in g
  quantite: number; // in kg
  poidsReel: number; // in g
  note?: string;
}

export interface Expense {
  id: string;
  libelle: string;
  montant: number;
  date: string;
}

export interface Vaccination {
  jours: number[];
  traitement: string;
  produits: string[];
  effectuee: boolean;
  dateEffective?: string;
}

export interface ProductionBatch {
  id: string;
  nom: string;
  dateMisePlace: string;
  nbPoussinsInitial: number;
  prixAchatPoussin: number;
  suiviQuotidien: DailyRecord[];
  depenses: Expense[];
  vaccinations: Vaccination[];
  statut: 'active' | 'cloturee';
}

export interface Chicken {
  id: string;
  numero: string;
  poids: number;
  prix: number;
  vendu: boolean;
}

export interface StockBatch {
  id: string;
  productionBatchId?: string;
  lettre: string;
  nom: string;
  prixKg: number;
  coutInitial: number;
  poulets: Chicken[];
  isFinalized: boolean;
}

export interface Client {
  id: string;
  nom: string;
  adresse: string;
  tel: string;
}

export interface Sale {
  id: string;
  clientId: string;
  clientNom: string;
  pouletIds: string[];
  total: number;
  isCredit: boolean;
  dueDate?: string;
  isPaid: boolean;
  dateVente: string;
}

export interface AppData {
  productionBatches: ProductionBatch[];
  stockBatches: StockBatch[];
  clients: Client[];
  sales: Sale[];
  settings: AppSettings;
}
