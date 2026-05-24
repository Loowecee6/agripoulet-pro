// services/activityLogger.ts — Journal d'activité pour le multi-utilisateur

import { ActivityAction, ActivityLogEntry, AppData, User } from '../types';

/**
 * Ajoute une entrée au journal d'activité.
 * Retourne le nouveau tableau d'entries.
 */
export function logActivity(
  currentLog: ActivityLogEntry[] | undefined,
  user: User,
  action: ActivityAction,
  description: string,
  details?: Record<string, unknown>,
): ActivityLogEntry[] {
  const entry: ActivityLogEntry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    description,
    details,
  };

  // Garder les 500 dernières entrées maximum
  const newLog = [entry, ...(currentLog || [])].slice(0, 500);
  return newLog;
}

/**
 * Enregistre une activité et retourne le nouveau state AppData.
 */
export function withActivityLog(
  data: AppData,
  user: User,
  action: ActivityAction,
  description: string,
  details?: Record<string, unknown>,
): AppData {
  return {
    ...data,
    activityLog: logActivity(data.activityLog, user, action, description, details),
  };
}

/**
 * Filtre le journal d'activité par type d'action.
 */
export function filterLogByAction(
  log: ActivityLogEntry[],
  action: ActivityAction | 'all',
): ActivityLogEntry[] {
  if (action === 'all') return log;
  return log.filter(e => e.action === action);
}

/**
 * Filtre le journal par période (nb de jours).
 */
export function filterLogByDays(
  log: ActivityLogEntry[],
  days: number,
): ActivityLogEntry[] {
  const since = Date.now() - days * 86400000;
  return log.filter(e => new Date(e.date).getTime() >= since);
}

/**
 * Formate une action en texte lisible.
 */
export function formatAction(action: ActivityAction): string {
  const labels: Record<string, string> = {
    'production.create': 'Création bande',
    'production.edit': 'Modification bande',
    'production.delete': 'Suppression bande',
    'production.close': 'Clôture bande',
    'production.suivi': 'Suivi quotidien',
    'production.vaccination': 'Vaccination',
    'production.expense': 'Dépense bande',
    'stock.create': 'Ajout stock',
    'stock.edit': 'Modification stock',
    'stock.delete': 'Suppression stock',
    'stock.finalize': 'Finalisation stock',
    'ventes.create': 'Nouvelle vente',
    'ventes.edit': 'Modification vente',
    'ventes.delete': 'Suppression vente',
    'ventes.payment': 'Paiement enregistré',
    'clients.create': 'Nouveau client',
    'clients.edit': 'Modification client',
    'clients.delete': 'Suppression client',
    'reservations.create': 'Nouvelle réservation',
    'reservations.edit': 'Modification réservation',
    'reservations.delete': 'Suppression réservation',
    'settings.edit': 'Modification paramètres',
    'settings.password': 'Changement mot de passe',
    'users.create': 'Ajout utilisateur',
    'users.edit': 'Modification utilisateur',
    'users.delete': 'Suppression utilisateur',
    'backup.create': 'Sauvegarde créée',
    'backup.restore': 'Restauration',
    'backup.delete': 'Sauvegarde supprimée',
    'login': 'Connexion',
    'logout': 'Déconnexion',
  };
  return labels[action] || action;
}
