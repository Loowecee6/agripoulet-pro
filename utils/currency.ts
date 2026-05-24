/**
 * utils/currency.ts
 * Centralisation de la gestion monétaire et des arrondis
 * Usage : formatCurrency(montant) => "5 000 F"
 */

/**
 * Formate un montant en francs CFA
 * Ajoute les séparateurs de milliers et le suffixe "F"
 */
export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} F`;
}

/**
 * Formate un montant sans suffixe (pour usage dans des calculs ou du texte)
 */
export function formatNumber(amount: number): string {
  return Math.round(amount).toLocaleString('fr-FR');
}

/**
 * Arrondit un montant à l'entier le plus proche
 * Les francs CFA n'ont pas de sous-unités
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount);
}

/**
 * Calcule le ratio coût/bénéfice avec arrondi sécurisé
 */
export function calculateRatio(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100) / 100;
}
