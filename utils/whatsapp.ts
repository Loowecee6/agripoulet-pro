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
 * Génère une URL WhatsApp avec numéro international (code 225 pour la Côte d'Ivoire)
 * et message optionnel pré-rempli.
 * 
 * @param tel - Numéro de téléphone (format local ou international)
 * @param message - Message optionnel à pré-remplir
 * @returns URL WhatsApp complète, ou null si numéro invalide
 * 
 * @example
 * formatWhatsAppUrl("0102030405", "Bonjour") 
 * // → "https://wa.me/2250102030405?text=Bonjour"
 * 
 * formatWhatsAppUrl("2250102030405")
 * // → "https://wa.me/2250102030405"
 */
export const formatWhatsAppUrl = (tel: string, message?: string): string | null => {
  const digits = tel.replace(/\D/g, '');
  if (!digits) return null;

  // Si commence déjà par 225, garder tel quel; sinon préfixer avec 225
  const international = digits.startsWith('225') ? digits : `225${digits.replace(/^0+/, '')}`;
  const base = `https://wa.me/${international}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
};
