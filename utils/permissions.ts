// utils/permissions.ts — Système de permissions basé sur les rôles

import { UserRole, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from '../types';

/**
 * Récupère les permissions accordées à un rôle.
 */
export function getRolePermissions(role: UserRole): string[] {
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.viewer;
}

/**
 * Récupère les permissions effectives d'un utilisateur, en tenant compte
 * des éventuels overrides individuels stockés dans userPermissions.
 */
export function getUserPermissions(
  role: UserRole,
  customPermissions?: string[],
): string[] {
  if (customPermissions) return customPermissions;
  return getRolePermissions(role);
}

/**
 * Vérifie si un utilisateur possède une permission spécifique.
 */
export function can(
  permissions: string[],
  permission: string,
): boolean {
  return permissions.includes(permission);
}

/**
 * Vérifie si un utilisateur possède au moins une des permissions listées.
 */
export function canAny(
  permissions: string[],
  required: string[],
): boolean {
  return required.some(p => permissions.includes(p));
}

/**
 * Vérifie si un utilisateur possède toutes les permissions listées.
 */
export function canAll(
  permissions: string[],
  required: string[],
): boolean {
  return required.every(p => permissions.includes(p));
}

/**
 * Retourne le libellé d'un rôle.
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}

/**
 * Vérifie si un rôle peut en gérer un autre (hiérarchie).
 * super_admin > admin > manager > viewer
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    super_admin: 4,
    admin: 3,
    manager: 2,
    viewer: 1,
  };
  return (hierarchy[actorRole] || 0) > (hierarchy[targetRole] || 0);
}
