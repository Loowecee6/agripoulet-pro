/**
 * services/notificationChecks.ts
 * Vérifications métier des notifications — extrait de notificationService.ts
 * pour améliorer la maintenabilité du service (483 → ~180 lignes)
 */

import { AppData } from '../types';

// Types de notifications
export interface NotificationEvent {
  id: string;
  type: 'vaccination' | 'mortalite' | 'credit';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'danger';
  date: Date;
  link?: string; // navigation hint
}

type CheckResult = NotificationEvent[];

/**
 * Vérifie les rappels de vaccination
 */
function checkVaccinationReminders(data: AppData): CheckResult {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.vaccinationReminders) return results;

  const today = new Date();

  for (const batch of data.productionBatches) {
    if (batch.statut !== 'active') continue;

    const startDate = new Date(batch.dateMisePlace);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
    const currentJour = Math.max(1, daysSinceStart + 1);

    for (const vax of batch.vaccinations) {
      if (vax.effectuee) continue;

      for (const jour of vax.jours) {
        const diff = jour - currentJour;
        if (diff >= 0 && diff <= 2) {
          results.push({
            id: `vax-${batch.id}-${vax.traitement}-${jour}`,
            type: 'vaccination',
            title: '💉 Rappel Vaccination',
            body: `"${batch.nom}" : ${vax.traitement} prévu au jour ${jour}`,
            severity: diff === 0 ? 'danger' : diff === 1 ? 'warning' : 'info',
            date: new Date(today.getTime() + diff * 86400000),
          });
        }

        if (diff < 0 && Math.abs(diff) <= 3) {
          results.push({
            id: `vax-late-${batch.id}-${vax.traitement}-${jour}`,
            type: 'vaccination',
            title: '⚠️ Vaccination en retard',
            body: `"${batch.nom}" : ${vax.traitement} (jour ${jour}) - Retard de ${Math.abs(diff)}j`,
            severity: 'danger',
            date: today,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Vérifie les alertes de mortalité anormale
 */
function checkMortalityAlerts(data: AppData): CheckResult {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.mortalityAlerts) return results;

  for (const batch of data.productionBatches) {
    if (batch.statut !== 'active') continue;

    const records = batch.suiviQuotidien;
    if (records.length < 2) continue;

    const recentRecords = records.slice(-3);

    for (const record of recentRecords) {
      if (record.mort > 0) {
        const prevTotalMort = records
          .filter(r => new Date(r.date) < new Date(record.date))
          .reduce((sum, r) => sum + r.mort, 0);

        const aliveBefore = batch.nbPoussinsInitial - prevTotalMort;
        if (aliveBefore <= 0) continue;

        const mortalityRate = (record.mort / aliveBefore) * 100;

        if (mortalityRate > 5) {
          results.push({
            id: `mort-${batch.id}-${record.date}`,
            type: 'mortalite',
            title: '🚨 Alerte Mortalité Élevée',
            body: `"${batch.nom}" : ${record.mort} mort(s) le jour ${record.jourDeBande} (${mortalityRate.toFixed(1)}%)`,
            severity: 'danger',
            date: new Date(record.date),
          });
        } else if (mortalityRate > 3) {
          results.push({
            id: `mort-${batch.id}-${record.date}-warn`,
            type: 'mortalite',
            title: '⚠️ Mortalité Anormale',
            body: `"${batch.nom}" : ${record.mort} mort(s) le jour ${record.jourDeBande} (${mortalityRate.toFixed(1)}%)`,
            severity: 'warning',
            date: new Date(record.date),
          });
        }
      }
    }
  }

  return results;
}

/**
 * Vérifie les échéances de crédit
 */
function checkCreditDeadlines(data: AppData): CheckResult {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.creditDeadlines) return results;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const sale of data.sales) {
    if (!sale.isCredit || sale.isPaid || !sale.dueDate) continue;

    const dueDate = new Date(sale.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);

    const totalPayments = (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
    const remaining = Math.max(0, sale.total - totalPayments);
    if (remaining <= 0) continue;

    if (diffDays < 0) {
      results.push({
        id: `credit-overdue-${sale.id}`,
        type: 'credit',
        title: '🔴 Crédit en retard',
        body: `${sale.clientNom} : ${remaining.toLocaleString()} Frs restants (${Math.abs(diffDays)}j de retard)`,
        severity: diffDays <= -7 ? 'danger' : 'warning',
        date: dueDate,
      });
    }

    if (diffDays >= 0 && diffDays <= 3) {
      results.push({
        id: `credit-upcoming-${sale.id}`,
        type: 'credit',
        title: '🟡 Échéance imminente',
        body: `${sale.clientNom} : ${remaining.toLocaleString()} Frs à payer d'ici ${diffDays === 0 ? "aujourd'hui" : `${diffDays}j`}`,
        severity: diffDays <= 1 ? 'danger' : 'warning',
        date: dueDate,
      });
    }
  }

  return results;
}

/**
 * Vérifie toutes les conditions et retourne les alertes actives
 */
export function checkAllNotifications(data: AppData): CheckResult {
  const prefs = data.settings.notifications;
  if (!prefs?.enabled) return [];

  const results: CheckResult = [
    ...checkVaccinationReminders(data),
    ...checkMortalityAlerts(data),
    ...checkCreditDeadlines(data),
  ];

  results.sort((a, b) => {
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return a.date.getTime() - b.date.getTime();
  });

  return results;
}

/**
 * Compte les notifications non lues par sévérité
 */
export function countBySeverity(events: NotificationEvent[]): {
  total: number;
  danger: number;
  warning: number;
  info: number;
} {
  return {
    total: events.length,
    danger: events.filter(e => e.severity === 'danger').length,
    warning: events.filter(e => e.severity === 'warning').length,
    info: events.filter(e => e.severity === 'info').length,
  };
}
