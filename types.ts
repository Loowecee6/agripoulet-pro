
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'viewer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface Permission {
  id: string;
  label: string;
  description: string;
}

export const ALL_PERMISSIONS: Permission[] = [
  { id: 'production.create', label: 'Créer une bande', description: 'Ajouter une nouvelle production' },
  { id: 'production.edit', label: 'Modifier bande', description: 'Éditer les infos d\'une bande' },
  { id: 'production.delete', label: 'Supprimer bande', description: 'Supprimer une bande (actions critiques)' },
  { id: 'production.view', label: 'Voir production', description: 'Consulter les bandes de production' },
  { id: 'production.suivi', label: 'Saisir suivi', description: 'Ajouter/modifier le suivi quotidien' },
  { id: 'production.abattage', label: 'Lancer abattage', description: 'Clôturer une bande et créer le stock' },
  { id: 'stock.create', label: 'Ajouter stock', description: 'Créer/modifier des lots de stock' },
  { id: 'stock.edit', label: 'Modifier stock', description: 'Éditer les poulets en stock' },
  { id: 'stock.delete', label: 'Supprimer stock', description: 'Supprimer des poulets du stock' },
  { id: 'stock.view', label: 'Voir stock', description: 'Consulter le stock' },
  { id: 'ventes.create', label: 'Créer vente', description: 'Enregistrer une vente' },
  { id: 'ventes.edit', label: 'Modifier vente', description: 'Modifier/supprimer une vente' },
  { id: 'ventes.view', label: 'Voir ventes', description: 'Consulter les ventes' },
  { id: 'clients.create', label: 'Créer client', description: 'Ajouter un client' },
  { id: 'clients.edit', label: 'Modifier client', description: 'Éditer/supprimer un client' },
  { id: 'clients.view', label: 'Voir clients', description: 'Consulter les clients' },
  { id: 'reservations.create', label: 'Créer réservation', description: 'Enregistrer une réservation' },
  { id: 'reservations.edit', label: 'Modifier réservation', description: 'Modifier/supprimer réservation' },
  { id: 'rapports.view', label: 'Voir rapports', description: 'Consulter les bilans financiers' },
  { id: 'settings.view', label: 'Voir paramètres', description: 'Accéder aux paramètres' },
  { id: 'settings.edit', label: 'Modifier paramètres', description: 'Modifier la configuration' },
  { id: 'users.manage', label: 'Gérer utilisateurs', description: 'Gérer les comptes et permissions' },
  { id: 'activity.view', label: 'Voir journal', description: 'Consulter le journal d\'activité' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ALL_PERMISSIONS.map(p => p.id),
  admin: ALL_PERMISSIONS.map(p => p.id),
  manager: [
    'production.view', 'production.suivi',
    'stock.view', 'stock.create', 'stock.edit',
    'ventes.create', 'ventes.view', 'ventes.edit',
    'clients.create', 'clients.edit', 'clients.view',
    'reservations.create', 'reservations.edit',
    'rapports.view',
  ],
  viewer: [
    'production.view',
    'stock.view',
    'ventes.view',
    'clients.view',
    'rapports.view',
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrateur',
  admin: 'Administrateur',
  manager: 'Gestionnaire',
  viewer: 'Consultation',
};

export interface NotificationPrefs {
  enabled: boolean;
  vaccinationReminders: boolean;
  mortalityAlerts: boolean;
  creditDeadlines: boolean;
}

export interface AppSettings {
  adminPasswordHash: string;
  notifications?: NotificationPrefs;
  darkMode?: boolean;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  duration?: number; // ms, optional defaults to 3000
}

export interface DailyRecord {
  date: string;
  jourDeBande: number;
  mort: number;
  conso: number; // in g
  quantite: number; // in kg
  poidsReel: number; // in g (poids moyen)
  sampleCount?: number; // nombre de poulets pesés
  sampleTotalWeight?: number; // poids total de l'échantillon en g
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
  typeOrigine: 'PR' | 'IM';
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
  notes?: string;
}

export type ReservationStatut = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Reservation {
  id: string;
  clientId: string;
  clientNom: string;
  pouletIds: string[];
  dateReserve: string; // date de retrait prévue
  statut: ReservationStatut;
  notes?: string;
  createdAt: string;
  acompte?: number; // acompte optionnel
}

export type PaymentMethod = 'especes' | 'orange_money' | 'wave';

export interface Payment {
  id: string;
  montant: number;
  date: string;
  methode?: PaymentMethod;
  note?: string;
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
  payments?: Payment[];
}

export type ActivityAction =
  | 'production.create' | 'production.edit' | 'production.delete' | 'production.close'
  | 'production.suivi' | 'production.vaccination' | 'production.expense'
  | 'stock.create' | 'stock.edit' | 'stock.delete' | 'stock.finalize'
  | 'ventes.create' | 'ventes.edit' | 'ventes.delete' | 'ventes.payment'
  | 'clients.create' | 'clients.edit' | 'clients.delete'
  | 'reservations.create' | 'reservations.edit' | 'reservations.delete'
  | 'settings.edit' | 'settings.password'
  | 'users.create' | 'users.edit' | 'users.delete'
  | 'backup.create' | 'backup.restore' | 'backup.delete'
  | 'login' | 'logout';

export interface ActivityLogEntry {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: ActivityAction;
  description: string;
  details?: Record<string, unknown>;
}

export interface AppData {
  productionBatches: ProductionBatch[];
  stockBatches: StockBatch[];
  clients: Client[];
  sales: Sale[];
  reservations: Reservation[];
  settings: AppSettings;
  activityLog?: ActivityLogEntry[];
  userPermissions?: Record<string, string[]>; // userId → permission ids (for custom per-user overrides)
  fcmToken?: string; // FCM push token for remote notifications
  fcmPushFunctionUrl?: string; // URL of the Cloud Function for sending push notifications
}
