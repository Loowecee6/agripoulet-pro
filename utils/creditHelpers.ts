/**
 * utils/creditHelpers.ts
 * Helpers partagés pour la gestion des crédits clients
 *
 * Centralise les fonctions dupliquées dans :
 * - ClientsView.tsx
 * - EcheancesView.tsx
 * - DashboardView.tsx
 */

import { Sale } from '../types';

/**
 * Calcule le solde restant d'une vente à crédit
 */
export const getRemainingBalance = (sale: Sale): number => {
  if (!sale.isCredit) return 0;
  const totalPayments = (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
  return Math.max(0, sale.total - totalPayments);
};

/**
 * Vérifie si une vente à crédit est entièrement payée
 */
export const isSalePaid = (sale: Sale): boolean => {
  if (!sale.isCredit) return true;
  return getRemainingBalance(sale) <= 0;
};

/**
 * Calcule le total des paiements effectués pour une vente
 */
export const getTotalPayments = (sale: Sale): number => {
  return (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
};

export type CreditRiskLevel = 'none' | 'ok' | 'warning' | 'danger';

export interface CreditRisk {
  level: CreditRiskLevel;
  label: string;
  days: number | null;
}

/**
 * Évalue le niveau de risque d'un crédit en fonction de l'échéance
 *
 * - danger: échu (retard)
 * - warning: échéance dans ≤ 7 jours
 * - ok: échéance dans > 7 jours
 * - none: pas de crédit ou soldé
 */
export const getCreditRisk = (sale: Sale): CreditRisk => {
  if (!sale.isCredit || isSalePaid(sale)) return { level: 'none', label: '', days: null };
  const remaining = getRemainingBalance(sale);
  if (remaining <= 0) return { level: 'none', label: '', days: null };

  if (!sale.dueDate) return { level: 'warning', label: 'Crédit sans échéance', days: null };

  const now = new Date();
  const due = new Date(sale.dueDate);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) {
    const daysLate = Math.abs(diffDays);
    if (daysLate >= 15) return { level: 'danger', label: `${daysLate}j de retard !`, days: -daysLate };
    return { level: 'danger', label: `${daysLate}j de retard`, days: -daysLate };
  }
  if (diffDays <= 3) return { level: 'warning', label: `Échéance J-${diffDays}`, days: diffDays };
  if (diffDays <= 7) return { level: 'warning', label: `J-${diffDays}`, days: diffDays };
  return { level: 'ok', label: `Échéance J-${diffDays}`, days: diffDays };
};
