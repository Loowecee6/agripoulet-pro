/**
 * Tests unitaires pour les helpers de crédit
 *
 * Note: on n'utilise PAS vi.useFakeTimers() car le mock de Date
 * cause des incohérences cross-platform (UTC vs local).
 * On utilise plutôt des dates suffisamment écartées pour être
 * déterministes, et on vérifie les patterns plutôt que les valeurs exactes.
 */
import { describe, it, expect } from 'vitest';
import {
  getRemainingBalance,
  isSalePaid,
  getTotalPayments,
  getCreditRisk,
} from '../creditHelpers';
import { Sale } from '../../types';

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    clientId: 'client-1',
    clientNom: 'Test Client',
    dateVente: '2026-05-01',
    pouletIds: ['p1'],
    total: 10000,
    isCredit: false,
    isPaid: false,
    ...overrides,
  } as Sale;
}

describe('getRemainingBalance', () => {
  it('returns 0 for cash sales', () => {
    expect(getRemainingBalance(makeSale())).toBe(0);
  });

  it('calculates remaining balance correctly', () => {
    const s = makeSale({
      isCredit: true,
      total: 20000,
      payments: [
        { id: 'p1', date: '2026-05-10', montant: 5000, methode: 'especes' },
        { id: 'p2', date: '2026-05-15', montant: 5000, methode: 'orange_money' },
      ],
    });
    expect(getRemainingBalance(s)).toBe(10000);
  });

  it('returns 0 when fully paid', () => {
    const s = makeSale({
      isCredit: true,
      total: 20000,
      payments: [
        { id: 'p1', date: '2026-05-10', montant: 10000, methode: 'especes' },
        { id: 'p2', date: '2026-05-15', montant: 10000, methode: 'orange_money' },
      ],
    });
    expect(getRemainingBalance(s)).toBe(0);
  });

  it('returns 0 for overpayment (never negative)', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 15000, methode: 'especes' }],
    });
    expect(getRemainingBalance(s)).toBe(0);
  });

  it('handles empty payments array', () => {
    const s = makeSale({ isCredit: true, total: 20000, payments: [] });
    expect(getRemainingBalance(s)).toBe(20000);
  });

  it('handles undefined payments', () => {
    const s = makeSale({ isCredit: true, total: 20000, payments: undefined });
    expect(getRemainingBalance(s)).toBe(20000);
  });

  it('handles total of 0', () => {
    const s = makeSale({ isCredit: true, total: 0, payments: [] });
    expect(getRemainingBalance(s)).toBe(0);
  });

  it('returns full amount for single payment less than total', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 3000, methode: 'especes' }],
    });
    expect(getRemainingBalance(s)).toBe(7000);
  });
});

describe('isSalePaid', () => {
  it('returns true for cash sales', () => {
    expect(isSalePaid(makeSale())).toBe(true);
  });

  it('returns false for unpaid credit', () => {
    const s = makeSale({
      isCredit: true,
      total: 20000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 5000, methode: 'especes' }],
    });
    expect(isSalePaid(s)).toBe(false);
  });

  it('returns true for fully paid credit', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 10000, methode: 'especes' }],
    });
    expect(isSalePaid(s)).toBe(true);
  });

  it('returns true for overpaid credit', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 12000, methode: 'especes' }],
    });
    expect(isSalePaid(s)).toBe(true);
  });
});

describe('getTotalPayments', () => {
  it('sums all payments', () => {
    const s = makeSale({
      isCredit: true,
      payments: [
        { id: 'p1', date: '2026-05-10', montant: 3000, methode: 'especes' },
        { id: 'p2', date: '2026-05-15', montant: 4500, methode: 'wave' },
      ],
    });
    expect(getTotalPayments(s)).toBe(7500);
  });

  it('returns 0 for empty payments', () => {
    expect(getTotalPayments(makeSale({ isCredit: true, payments: [] }))).toBe(0);
  });

  it('returns 0 for undefined payments', () => {
    expect(getTotalPayments(makeSale({ isCredit: true, payments: undefined }))).toBe(0);
  });

  it('handles single payment', () => {
    const s = makeSale({
      isCredit: true,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 7500, methode: 'wave' }],
    });
    expect(getTotalPayments(s)).toBe(7500);
  });
});

describe('getCreditRisk', () => {
  it('returns none for cash sales', () => {
    expect(getCreditRisk(makeSale())).toEqual({ level: 'none', label: '', days: null });
  });

  it('returns none for paid credit', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 10000, methode: 'especes' }],
    });
    expect(getCreditRisk(s)).toEqual({ level: 'none', label: '', days: null });
  });

  it('returns none when remaining is 0 but isCredit is true', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      payments: [{ id: 'p1', date: '2026-05-10', montant: 10000, methode: 'especes' }],
      dueDate: '2020-01-01',
    });
    expect(getCreditRisk(s)).toEqual({ level: 'none', label: '', days: null });
  });

  it('returns danger with overdue label for past due date', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      dueDate: '2020-01-01',
      payments: [],
    });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('danger');
    expect(risk.label).toMatch(/retard/);
    expect(risk.days).toBeLessThan(0);
  });

  it('marks very overdue (>15 days) with exclamation', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      dueDate: '2020-01-01',
      payments: [],
    });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('danger');
    expect(risk.label).toContain('!');
    expect(risk.days).toBeLessThan(0);
  });

  it('returns warning for credit without due date', () => {
    const s = makeSale({ isCredit: true, total: 10000, payments: [] });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('warning');
    expect(risk.label).toBe('Crédit sans échéance');
    expect(risk.days).toBeNull();
  });

  it('does not crash with undefined dueDate', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      dueDate: undefined,
      payments: [],
    });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('warning');
    expect(risk.days).toBeNull();
  });

  it('returns ok for a future due date (year+ ahead)', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      dueDate: '2030-06-01',
      payments: [],
    });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('ok');
    expect(risk.days).toBeGreaterThanOrEqual(1000);
  });

  it('handles due date far in the past', () => {
    const s = makeSale({
      isCredit: true,
      total: 10000,
      dueDate: '2000-01-01',
      payments: [],
    });
    const risk = getCreditRisk(s);
    expect(risk.level).toBe('danger');
    expect(risk.days).toBeLessThan(-1000);
  });
});
