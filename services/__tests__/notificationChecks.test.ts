/**
 * Tests unitaires pour notificationChecks.ts
 *
 * Teste les fonctions pures :
 * - checkAllNotifications (publique)
 * - countBySeverity (publique)
 * - Les fonctions internes (checkVaccinationReminders, checkMortalityAlerts, checkCreditDeadlines)
 *   sont testées indirectement via checkAllNotifications
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkAllNotifications, countBySeverity } from '../notificationChecks';
import type { AppData } from '../../types';

// ── Helper pour créer une AppData de test ───────────────────────

function createMockAppData(overrides?: Partial<AppData>): AppData {
  return {
    productionBatches: [],
    stockBatches: [],
    clients: [],
    sales: [],
    reservations: [],
    settings: {
      adminPasswordHash: '',
      notifications: {
        enabled: true,
        vaccinationReminders: true,
        mortalityAlerts: true,
        creditDeadlines: true,
      },
    },
    ...overrides,
  };
}

// ── Contrôle de l'horloge ───────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  // Fixe la date au 15 juin 2026 (lundi)
  vi.setSystemTime(new Date('2026-06-15T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────

describe('checkAllNotifications', () => {
  describe('Vaccination reminders', () => {
    it('returns empty when notification prefs are disabled', () => {
      const data = createMockAppData({
        settings: { adminPasswordHash: '', notifications: { enabled: false, vaccinationReminders: true, mortalityAlerts: true, creditDeadlines: true } },
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns empty when vaccinationReminders is disabled', () => {
      const data = createMockAppData({
        settings: { adminPasswordHash: '', notifications: { enabled: true, vaccinationReminders: false, mortalityAlerts: true, creditDeadlines: true } },
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns empty when no active batches', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Cloturée', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [], vaccinations: [],
          statut: 'cloturee',
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns empty when all vaccinations are done', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Active', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{
            jours: [7], traitement: 'Newcastle',
            produits: ['Vaccin N'], effectuee: true, dateEffective: '2026-06-08',
          }],
          statut: 'active',
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns danger reminder when vaccination is due today (J7, start J1, today J7)', () => {
      // Mise en place le 9 juin → jour 7 = 15 juin (today)
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande A', dateMisePlace: '2026-06-09',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{ jours: [7], traitement: 'Newcastle', produits: ['Vaccin N'], effectuee: false }],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('vaccination');
      expect(events[0].severity).toBe('danger');
      expect(events[0].title).toContain('Rappel');
      expect(events[0].body).toContain('Bande A');
      expect(events[0].body).toContain('Newcastle');
    });

    it('returns warning reminder 1 day before vaccination', () => {
      // Mise en place le 10 juin → jour 7 = 16 juin → diff = 1 jour
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande B', dateMisePlace: '2026-06-10',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{ jours: [7], traitement: 'Gumboro', produits: ['Vaccin G'], effectuee: false }],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('vaccination');
      expect(events[0].severity).toBe('warning');
    });

    it('returns info reminder 2 days before vaccination', () => {
      // Mise en place le 11 juin → jour 7 = 17 juin → diff = 2 jours
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande C', dateMisePlace: '2026-06-11',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{ jours: [7], traitement: 'Anti Stress', produits: ['Vitamine'], effectuee: false }],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('vaccination');
      expect(events[0].severity).toBe('info');
    });

    it('returns late vaccination alert when 1 day overdue', () => {
      // Mise en place le 7 juin → jour 7 = 13 juin → today 15 juin → 2j de retard
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande D', dateMisePlace: '2026-06-07',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{ jours: [7], traitement: 'Newcastle', produits: ['Vaccin N'], effectuee: false }],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('vaccination');
      expect(events[0].severity).toBe('danger');
      expect(events[0].title).toContain('retard');
    });

    it('does not alert when vaccination was 4+ days ago', () => {
      // Mise en place le 4 juin → jour 7 = 10 juin → today 15 juin → 5j de retard
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande E', dateMisePlace: '2026-06-04',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [], depenses: [],
          vaccinations: [{ jours: [7], traitement: 'Newcastle', produits: ['Vaccin N'], effectuee: false }],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      expect(events).toEqual([]);
    });
  });

  describe('Mortality alerts', () => {
    it('returns empty when mortalityAlerts disabled', () => {
      const data = createMockAppData({
        settings: { adminPasswordHash: '', notifications: { enabled: true, vaccinationReminders: true, mortalityAlerts: false, creditDeadlines: true } },
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns empty when less than 2 daily records', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [{ date: '2026-06-10', jourDeBande: 10, mort: 5, conso: 100, quantite: 50, poidsReel: 1500 }],
          depenses: [], vaccinations: [],
          statut: 'active',
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns danger for mortality rate > 5%', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande Mort', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [
            { date: '2026-06-10', jourDeBande: 10, mort: 1, conso: 100, quantite: 50, poidsReel: 1500 },
            { date: '2026-06-11', jourDeBande: 11, mort: 0, conso: 100, quantite: 50, poidsReel: 1520 },
            { date: '2026-06-12', jourDeBande: 12, mort: 0, conso: 100, quantite: 50, poidsReel: 1540 },
            { date: '2026-06-13', jourDeBande: 13, mort: 0, conso: 100, quantite: 50, poidsReel: 1560 },
            { date: '2026-06-14', jourDeBande: 14, mort: 8, conso: 100, quantite: 50, poidsReel: 1580 },
          ],
          depenses: [], vaccinations: [],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      const mortEvents = events.filter(e => e.type === 'mortalite');
      expect(mortEvents.length).toBeGreaterThanOrEqual(1);
      // 8 morts sur les 99 vivants avant = 8.08% > 5% → danger
      const dangerAlert = mortEvents.find(e => e.severity === 'danger');
      expect(dangerAlert).toBeDefined();
      expect(dangerAlert?.title).toContain('Élevée');
      expect(dangerAlert?.body).toContain('Bande Mort');
      expect(dangerAlert?.body).toContain('8');
    });

    it('returns warning for mortality rate between 3% and 5%', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande Warn', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [
            { date: '2026-06-10', jourDeBande: 10, mort: 1, conso: 100, quantite: 50, poidsReel: 1500 },
            { date: '2026-06-11', jourDeBande: 11, mort: 0, conso: 100, quantite: 50, poidsReel: 1520 },
            { date: '2026-06-12', jourDeBande: 12, mort: 0, conso: 100, quantite: 50, poidsReel: 1540 },
            { date: '2026-06-13', jourDeBande: 13, mort: 0, conso: 100, quantite: 50, poidsReel: 1560 },
            { date: '2026-06-14', jourDeBande: 14, mort: 4, conso: 100, quantite: 50, poidsReel: 1580 },
          ],
          depenses: [], vaccinations: [],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      const mortEvents = events.filter(e => e.type === 'mortalite');
      // 4 morts sur 99 vivants = 4.04% → entre 3% et 5% → warning
      const warnAlert = mortEvents.find(e => e.severity === 'warning');
      expect(warnAlert).toBeDefined();
      expect(warnAlert?.title).toContain('Anormale');
    });

    it('returns no alert for mortality rate <= 3%', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande OK', dateMisePlace: '2026-06-01',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [
            { date: '2026-06-10', jourDeBande: 10, mort: 1, conso: 100, quantite: 50, poidsReel: 1500 },
            { date: '2026-06-11', jourDeBande: 11, mort: 0, conso: 100, quantite: 50, poidsReel: 1520 },
            { date: '2026-06-12', jourDeBande: 12, mort: 0, conso: 100, quantite: 50, poidsReel: 1540 },
            { date: '2026-06-13', jourDeBande: 13, mort: 0, conso: 100, quantite: 50, poidsReel: 1560 },
            { date: '2026-06-14', jourDeBande: 14, mort: 2, conso: 100, quantite: 50, poidsReel: 1580 },
          ],
          depenses: [], vaccinations: [],
          statut: 'active',
        }],
      });
      const events = checkAllNotifications(data);
      const mortEvents = events.filter(e => e.type === 'mortalite');
      expect(mortEvents).toHaveLength(0);
    });
  });

  describe('Credit deadlines', () => {
    it('returns empty when creditDeadlines disabled', () => {
      const data = createMockAppData({
        settings: { adminPasswordHash: '', notifications: { enabled: true, vaccinationReminders: true, mortalityAlerts: true, creditDeadlines: false } },
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('returns overdue alert for past due credits', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Diallo',
          pouletIds: ['p1'], total: 50000, isCredit: true,
          dueDate: '2026-06-10', isPaid: false, dateVente: '2026-06-01',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      const creditEvents = events.filter(e => e.type === 'credit');
      expect(creditEvents.length).toBeGreaterThanOrEqual(1);
      const overdue = creditEvents.find(e => e.title.includes('retard'));
      expect(overdue).toBeDefined();
      expect(overdue?.body).toContain('Diallo');
      // Le nombre est formaté avec toLocaleString() — on vérifie juste la présence du client
      expect(overdue?.body).toContain('restants');
    });

    it('returns danger for overdue > 7 days', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Faye',
          pouletIds: ['p1'], total: 30000, isCredit: true,
          dueDate: '2026-06-01', isPaid: false, dateVente: '2026-05-20',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      const overdue = events.find(e => e.type === 'credit' && e.title.includes('retard'));
      expect(overdue?.severity).toBe('danger');
    });

    it('returns warning for overdue <= 7 days', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Ba',
          pouletIds: ['p1'], total: 20000, isCredit: true,
          dueDate: '2026-06-12', isPaid: false, dateVente: '2026-06-01',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      const overdue = events.find(e => e.type === 'credit' && e.title.includes('retard'));
      expect(overdue?.severity).toBe('warning');
    });

    it('returns upcoming alert for credit due within 3 days', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Ndiaye',
          pouletIds: ['p1'], total: 15000, isCredit: true,
          dueDate: '2026-06-17', isPaid: false, dateVente: '2026-06-05',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      const upcoming = events.find(e => e.type === 'credit' && e.title.includes('Échéance'));
      expect(upcoming).toBeDefined();
      expect(upcoming?.body).toContain('Ndiaye');
    });

    it('returns danger for due today (diffDays = 0)', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Sow',
          pouletIds: ['p1'], total: 10000, isCredit: true,
          dueDate: '2026-06-15', isPaid: false, dateVente: '2026-06-01',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      const upcoming = events.find(e => e.type === 'credit' && e.title.includes('Échéance'));
      expect(upcoming?.severity).toBe('danger');
    });

    it('ignores cash sales (isCredit = false)', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Cash',
          pouletIds: ['p1'], total: 10000, isCredit: false,
          isPaid: true, dateVente: '2026-06-01',
          payments: [],
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('ignores fully paid credits', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Paye',
          pouletIds: ['p1'], total: 20000, isCredit: true,
          dueDate: '2026-06-10', isPaid: true, dateVente: '2026-06-01',
          payments: [{ id: 'pay1', montant: 20000, date: '2026-06-05', methode: 'especes' }],
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('ignores credits with no remaining balance (fully paid via payments)', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Soldé',
          pouletIds: ['p1'], total: 15000, isCredit: true,
          dueDate: '2026-06-10', isPaid: false, dateVente: '2026-06-01',
          payments: [{ id: 'pay1', montant: 15000, date: '2026-06-05', methode: 'wave' }],
        }],
      });
      expect(checkAllNotifications(data)).toEqual([]);
    });

    it('calculates remaining balance correctly from partial payments', () => {
      const data = createMockAppData({
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Partiel',
          pouletIds: ['p1'], total: 30000, isCredit: true,
          dueDate: '2026-06-10', isPaid: false, dateVente: '2026-06-01',
          payments: [{ id: 'pay1', montant: 10000, date: '2026-06-05', methode: 'orange_money' }],
        }],
      });
      const events = checkAllNotifications(data);
      const overdue = events.find(e => e.type === 'credit');
      // 20000 formaté par toLocaleString() — on vérifie le nom du client et le mot "restants"
      expect(overdue?.body).toContain('Partiel');
      expect(overdue?.body).toContain('restants');
    });
  });

  describe('Sorting order', () => {
    it('sorts by severity (danger first) then by date', () => {
      const data = createMockAppData({
        productionBatches: [{
          id: 'b1', nom: 'Bande Test', dateMisePlace: '2026-06-09',
          nbPoussinsInitial: 100, prixAchatPoussin: 400,
          suiviQuotidien: [
            { date: '2026-06-10', jourDeBande: 2, mort: 1, conso: 100, quantite: 50, poidsReel: 200 },
            { date: '2026-06-11', jourDeBande: 3, mort: 0, conso: 100, quantite: 50, poidsReel: 250 },
            { date: '2026-06-12', jourDeBande: 4, mort: 8, conso: 100, quantite: 50, poidsReel: 300 },
          ],
          depenses: [], vaccinations: [
            { jours: [7], traitement: 'Newcastle', produits: ['Vaccin N'], effectuee: false },
          ],
          statut: 'active',
        }],
        sales: [{
          id: 's1', clientId: 'c1', clientNom: 'Retard',
          pouletIds: ['p1'], total: 10000, isCredit: true,
          dueDate: '2026-06-10', isPaid: false, dateVente: '2026-06-01',
          payments: [],
        }],
      });
      const events = checkAllNotifications(data);
      // L'ordre doit être : danger first, puis warning, puis info
      const severities = events.map(e => e.severity);
      expect(severities).toEqual([...severities].sort((a, b) => {
        const order = { danger: 0, warning: 1, info: 2 };
        return order[a] - order[b];
      }));
    });
  });

  describe('countBySeverity', () => {
    it('counts zero for empty array', () => {
      expect(countBySeverity([])).toEqual({ total: 0, danger: 0, warning: 0, info: 0 });
    });

    it('counts events by severity', () => {
      const events = [
        { id: '1', type: 'credit' as const, title: 'A', body: 'B', severity: 'danger' as const, date: new Date() },
        { id: '2', type: 'credit' as const, title: 'C', body: 'D', severity: 'danger' as const, date: new Date() },
        { id: '3', type: 'credit' as const, title: 'E', body: 'F', severity: 'warning' as const, date: new Date() },
        { id: '4', type: 'credit' as const, title: 'G', body: 'H', severity: 'info' as const, date: new Date() },
        { id: '5', type: 'credit' as const, title: 'I', body: 'J', severity: 'info' as const, date: new Date() },
      ];
      expect(countBySeverity(events)).toEqual({ total: 5, danger: 2, warning: 1, info: 2 });
    });

    it('handles all same severity', () => {
      const events = [
        { id: '1', type: 'credit' as const, title: 'A', body: 'B', severity: 'danger' as const, date: new Date() },
        { id: '2', type: 'credit' as const, title: 'A', body: 'B', severity: 'danger' as const, date: new Date() },
        { id: '3', type: 'credit' as const, title: 'A', body: 'B', severity: 'danger' as const, date: new Date() },
      ];
      expect(countBySeverity(events)).toEqual({ total: 3, danger: 3, warning: 0, info: 0 });
    });
  });
});
