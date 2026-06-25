/**
 * utils/whatsapp.ts
 * Utilitaire partagé pour générer les liens WhatsApp
 * 
 * Centralise formatWhatsAppUrl() qui était dupliqué dans 3 composants :
 * - ClientsView.tsx
 * - EcheancesView.tsx
 * - DashboardView.tsx
 */

/**
 * Génère une URL WhatsApp avec numéro international (code +221 pour le Sénégal)
 * et message optionnel pré-rempli.
 * 
 * @param tel - Numéro de téléphone (format local ou international)
 * @param message - Message optionnel à pré-remplir
 * @returns URL WhatsApp complète, ou null si numéro invalide
 * 
 * @example
 * formatWhatsAppUrl("771234567", "Bonjour") 
 * // → "https://wa.me/221771234567?text=Bonjour"
 * 
 * formatWhatsAppUrl("221771234567")
 * // → "https://wa.me/221771234567"
 */
export const formatWhatsAppUrl = (tel: string, message?: string): string | null => {
  const digits = tel.replace(/\D/g, '');
  if (!digits) return null;

  // Si commence déjà par 221, garder tel quel; sinon préfixer avec 221
  const international = digits.startsWith('221') ? digits : `221${digits.replace(/^0+/, '')}`;
  const base = `https://wa.me/${international}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
};
