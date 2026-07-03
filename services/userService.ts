/**
 * services/userService.ts
 * Gestion des rôles et profils utilisateur dans Firestore.
 * 
 * Structure : users/{uid}
 *   - role: UserRole (admin | manager | viewer, etc.)
 *   - email: string
 *   - displayName: string
 *   - createdAt: Firestore Timestamp
 */

import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { UserRole } from '../types';
import { hashPassword } from '../utils/crypto';

const DEFAULT_ROLE: UserRole = 'viewer';

/**
 * Récupère le rôle d'un utilisateur depuis Firestore.
 * Sauvegarde aussi l'email/displayName si fournis.
 * Retourne 'viewer' par défaut si le document n'existe pas.
 */
export async function getUserRole(uid: string, email?: string, displayName?: string): Promise<UserRole> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('sandbox_mode') === 'true') {
    return 'super_admin';
  }
  try {
    const userDoc = doc(db, 'users', uid);
    const snap = await getDoc(userDoc);
    if (snap.exists()) {
      const data = snap.data();
      const updates: Record<string, unknown> = {};
      if (email && email !== data.email) updates.email = email;
      if (displayName && displayName !== data.displayName) updates.displayName = displayName;

      // Vérifier si l'email correspond à un admin connu → upgrade automatique du rôle
      const isAdminEmail = email && ['loowecee6@gmail.com', 'destigny@gmail.com', 'admin@agripoulet-pro.com'].includes(email.toLowerCase());
      const currentRole = (data.role as UserRole) || DEFAULT_ROLE;
      const targetRole: UserRole = isAdminEmail ? 'admin' : currentRole;
      if (currentRole !== targetRole) {
        updates.role = targetRole;
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(userDoc, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      }
      return targetRole;
    }
    // Document non trouvé → créer avec rôle par défaut
    const isAdminEmail = email && ['loowecee6@gmail.com', 'destigny@gmail.com', 'admin@agripoulet-pro.com'].includes(email.toLowerCase());
    const initialRole: UserRole = isAdminEmail ? 'admin' : DEFAULT_ROLE;
    await setDoc(userDoc, {
      role: initialRole,
      email: email || '',
      displayName: displayName || '',
      createdAt: serverTimestamp(),
    });
    return initialRole;
  } catch (e) {
    console.warn('[userService] Erreur chargement rôle, fallback viewer:', e);
    return DEFAULT_ROLE;
  }
}

/**
 * Liste tous les utilisateurs enregistrés dans Firestore.
 * Nécessite que les règles Firestory permettent la lecture.
 */
export async function getAllUsers(): Promise<{ id: string; name: string; role: UserRole }[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: (d.displayName as string) || (d.email as string) || doc.id.slice(0, 8),
        role: (d.role as UserRole) || DEFAULT_ROLE,
      };
    });
  } catch (e) {
    console.warn('[userService] Erreur liste utilisateurs:', e);
    return [];
  }
}

/**
 * Met à jour le rôle d'un utilisateur.
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  try {
    const userDoc = doc(db, 'users', uid);
    await setDoc(userDoc, { role, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.error('[userService] Erreur mise à jour rôle:', e);
    throw new Error('Impossible de mettre à jour le rôle');
  }
}

/**
 * Vérifie si un code admin en clair correspond au hash stocké.
 * Le hash global est stocké dans AppData.settings.adminPasswordHash.
 */
export async function verifyAdminPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash) return false;
  const hashed = await hashPassword(plainPassword);
  return hashed === storedHash;
}

/**
 * Élève le rôle d'un utilisateur à 'admin' si le code admin est correct.
 * Retourne true si l'opération a réussi.
 */
export async function claimAdminRole(
  uid: string,
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  const isValid = await verifyAdminPassword(plainPassword, storedHash);
  if (!isValid) return false;
  await setUserRole(uid, 'admin');
  return true;
}
