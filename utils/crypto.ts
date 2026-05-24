/**
 * utils/crypto.ts
 * Fonctions de hachage pour sécuriser les mots de passe côté client.
 * Utilise l'API Web Crypto (SubtleCrypto) disponible dans tous les navigateurs modernes.
 */

/**
 * Hache une chaîne en SHA-256 et retourne son hex digest.
 * Utilisé pour le stockage sécurisé du mot de passe admin.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Vérifie si un mot de passe en clair correspond à un hash stocké.
 */
export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(plainPassword);
  return hash === storedHash;
}

/**
 * Vérifie qu'une chaîne est un hash SHA-256 valide (64 caractères hexadécimaux).
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}
