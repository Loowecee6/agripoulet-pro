/**
 * utils/dateFormat.ts
 * Centralisation du formatage de dates pour toute l'application.
 * Utilise Intl.DateTimeFormat('fr-FR') de manière stricte et cohérente.
 *
 * Avant : 22 appels éparpillés à .toLocaleDateString() sans locale fixe
 * Après : Un seul point d'entrée, format français garanti.
 */

// ── Formateurs réutilisables (créés une seule fois) ───────────────

const formatShort = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

const formatLong = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const formatWithTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dayMonthFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'numeric',
});

const formatFull = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const formatInvoice = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const formatInvoiceShort = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatDateTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// ── Fonctions d'export ────────────────────────────────────────────

/**
 * Formate une date en français : "24 mai"
 */
export function formatDateShort(date: Date | string): string {
  return formatShort.format(toDate(date));
}

/**
 * Formate une date en français : "samedi 24 mai 2026"
 */
export function formatDateLong(date: Date | string): string {
  return formatLong.format(toDate(date));
}

/**
 * Formate une date avec heure : "24 mai 14:30"
 */
export function formatDateWithTime(date: Date | string): string {
  return formatWithTime.format(toDate(date));
}

/**
 * Formate une date en JJ/MM : "24/05"
 */
export function formatDayMonth(date: Date | string): string {
  return dayMonthFormatter.format(toDate(date));
}

/**
 * Formate une date abrégée : "sam 24 mai"
 */
export function formatDateFull(date: Date | string): string {
  return formatFull.format(toDate(date));
}

/**
 * Formate une date pour facture : "24 mai 2026"
 */
export function formatDateInvoice(date: Date | string): string {
  return formatInvoice.format(toDate(date));
}

/**
 * Formate une date courte pour facture : "24 mai 2026"
 */
export function formatDateInvoiceShort(date: Date | string): string {
  return formatInvoiceShort.format(toDate(date));
}

/**
 * Formate une date avec heure complète : "24 mai 2026, 14:30"
 */
export function formatDateTimeFR(date: Date | string): string {
  return formatDateTime.format(toDate(date));
}

/**
 * Formate une date pour l'affichage dans les messages WhatsApp
 */
export function formatDateWhatsApp(date: Date | string): string {
  return formatDateShort(date);
}

/**
 * Formate une date pour auto-backup label : "24/05/2026, 14:30:45"
 */
export function formatDateBackup(date: Date): string {
  return date.toLocaleString('fr-FR');
}

// ── Helper interne ────────────────────────────────────────────────

function toDate(input: Date | string): Date {
  return input instanceof Date ? input : new Date(input);
}

export type DateFormatType = 'short' | 'long' | 'withTime' | 'dayMonth' | 'full' | 'invoice' | 'invoiceShort' | 'dateTime' | 'whatsapp';

/**
 * Formate une date selon le type spécifié (utile pour les cas switch/dynamiques)
 */
export function formatDate(date: Date | string, type: DateFormatType = 'short'): string {
  switch (type) {
    case 'short': return formatDateShort(date);
    case 'long': return formatDateLong(date);
    case 'withTime': return formatDateWithTime(date);
    case 'dayMonth': return formatDayMonth(date);
    case 'full': return formatDateFull(date);
    case 'invoice': return formatDateInvoice(date);
    case 'invoiceShort': return formatDateInvoiceShort(date);
    case 'dateTime': return formatDateTimeFR(date);
    case 'whatsapp': return formatDateWhatsApp(date);
    default: return formatDateShort(date);
  }
}
