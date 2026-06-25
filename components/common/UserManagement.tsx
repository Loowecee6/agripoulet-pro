// components/common/UserManagement.tsx
// Gestion multi-utilisateurs : rôles, permissions personnalisées, journal d'activité

import React, { useState, useMemo, useEffect } from 'react';
import { ShieldCheck, Users, KeyRound, Activity, X, Check, ChevronDown, ChevronUp, Settings, Loader2 } from 'lucide-react';
import { AppData, User, UserRole, ALL_PERMISSIONS, Permission } from '../../types';
import { getRoleLabel, canManageRole, getUserPermissions } from '../../utils/permissions';
import { ActivityLogView } from './ActivityLogView';
import { withActivityLog } from '../../services/activityLogger';
import { getAllUsers as fetchAllUsers, setUserRole } from '../../services/userService';

interface UserManagementProps {
  data: AppData;
  setData: (d: AppData) => void;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'users' | 'permissions' | 'activity';

export const UserManagement = ({ data, setData, currentUser, isOpen, onClose }: UserManagementProps) => {
  const [tab, setTab] = useState<Tab>('users');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [customPerms, setCustomPerms] = useState<string[]>([]);
  const [firestoreUsers, setFirestoreUsers] = useState<{ id: string; name: string; role: UserRole }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Charger les vrais utilisateurs Firestore à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      fetchAllUsers().then(users => {
        setFirestoreUsers(users);
        setLoadingUsers(false);
      }).catch(() => setLoadingUsers(false));
    }
  }, [isOpen]);

  // Fusion : currentUser (toujours visible) + utilisateurs Firestore
  const knownUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: UserRole }>();
    map.set(currentUser.id, currentUser);
    firestoreUsers.forEach(u => {
      if (!map.has(u.id)) {
        map.set(u.id, u);
      }
    });
    return Array.from(map.values());
  }, [currentUser, firestoreUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!canManageRole(currentUser.role, newRole)) {
      alert('Vous ne pouvez pas attribuer un rôle égal ou supérieur au vôtre.');
      return;
    }

    const user = knownUsers.find(u => u.id === userId);
    if (!user) return;

    try {
      await setUserRole(userId, newRole);
      // Mettre à jour la liste locale
      setFirestoreUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setData(withActivityLog(
        data, currentUser, 'users.edit',
        `${currentUser.name} a changé le rôle de ${user.name} → ${getRoleLabel(newRole)}`,
        { targetUser: user.name, oldRole: user.role, newRole },
      ));
      alert(`✅ Rôle de ${user.name} changé : ${getRoleLabel(newRole)}`);
    } catch (e) {
      alert('❌ Erreur lors de la mise à jour du rôle.');
    }
  };

  const handleCustomPermissionToggle = (userId: string, permId: string) => {
    const newPerms = customPerms.includes(permId)
      ? customPerms.filter(p => p !== permId)
      : [...customPerms, permId];
    setCustomPerms(newPerms);

    const user = knownUsers.find(u => u.id === userId);
    if (!user) return;

    const action = newPerms.includes(permId) ? 'ajoutée à' : 'retirée de';
    const permLabel = ALL_PERMISSIONS.find(p => p.id === permId)?.label || permId;

    setData(withActivityLog(
      data, currentUser, 'users.edit',
      `${currentUser.name} a ${action} la permission "${permLabel}" pour ${user.name}`,
      { targetUser: user.name, permission: permId, customPermissions: newPerms },
    ));
  };

  const openCustomPerms = (userId: string) => {
    const user = knownUsers.find(u => u.id === userId);
    if (!user) return;
    const existing = data.userPermissions?.[userId] || [];
    setCustomPerms(existing);
    setEditingPermissions(userId);
  };

  const saveCustomPerms = (userId: string) => {
    const user = knownUsers.find(u => u.id === userId);
    if (!user) return;

    setData(withActivityLog(
      {
        ...data,
        userPermissions: {
          ...(data.userPermissions || {}),
          [userId]: customPerms,
        },
      },
      currentUser, 'users.edit',
      `${currentUser.name} a personnalisé les permissions de ${user.name}`,
      { targetUser: user.name, permissions: customPerms },
    ));

    setEditingPermissions(null);
    alert('✅ Permissions personnalisées enregistrées !');
  };

  if (!isOpen) return null;

  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-blue-100 text-blue-700',
    facturier: 'bg-orange-100 text-orange-700',
    viewer: 'bg-gray-100 text-gray-600',
  };

  const allPermissions = ALL_PERMISSIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-gray-800">Gestion des utilisateurs</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 bg-gray-50 mx-4 mt-3 rounded-xl">
          {(['users', 'permissions', 'activity'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                tab === t ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'users' && <Users className="w-3 h-3" />}
              {t === 'permissions' && <KeyRound className="w-3 h-3" />}
              {t === 'activity' && <Activity className="w-3 h-3" />}
              {t === 'users' ? 'Utilisateurs' : t === 'permissions' ? 'Permissions' : 'Journal'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* ── TAB : Utilisateurs ── */}
          {tab === 'users' && (
            <div className="space-y-2">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement des utilisateurs...
                </div>
              ) : knownUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Aucun utilisateur trouvé.
                </div>
              ) :
              knownUsers.map(user => {
                const isSelf = user.id === currentUser.id;
                const canChange = canManageRole(currentUser.role, user.role);
                const isExpanded = expandedUser === user.id;

                return (
                  <div key={user.id} className={`border ${isSelf ? 'border-orange-200 bg-orange-50' : 'border-gray-100'} rounded-2xl overflow-hidden`}>
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${
                          isSelf ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">
                            {user.name}
                            {isSelf && <span className="text-[9px] text-orange-600 ml-1">(Vous)</span>}
                          </div>
                          <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${roleColors[user.role]}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3">
                        {/* Sélecteur de rôle */}
                        {canChange && (
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase mb-1.5 block">Changer le rôle</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(Object.keys(roleColors) as UserRole[]).map(role => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(user.id, role)}
                                  disabled={role === user.role}
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                    role === user.role
                                      ? roleColors[role] + ' ring-2 ring-offset-1'
                                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  }`}
                                >
                                  {getRoleLabel(role)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Permissions personnalisées */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => openCustomPerms(user.id)}
                            className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-200 transition-colors"
                          >
                            <Settings className="w-3 h-3 inline mr-1" />
                            Permissions personnalisées
                          </button>
                        </div>

                        {/* Info courante */}
                        <div className="bg-gray-50 rounded-xl p-2.5 text-[9px] text-gray-500">
                          <div>ID: {user.id.slice(0, 12)}...</div>
                          <div>Permissions: {getUserPermissions(user.role, data.userPermissions?.[user.id]).length}/{allPermissions.length}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!loadingUsers && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-700">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                Les modifications de rôles sont appliquées en temps réel dans Firestore.
              </div>
              )}
            </div>
          )}

          {/* ── TAB : Permissions ── */}
          {tab === 'permissions' && (
            <div className="space-y-1">
              {}
              <p className="text-[10px] text-gray-500 mb-3">
                {editingPermissions
                  ? `Personnaliser les permissions pour ${knownUsers.find(u => u.id === editingPermissions)?.name || 'cet utilisateur'}`
                  : 'Sélectionnez un utilisateur dans l\'onglet Utilisateurs pour personnaliser ses permissions.'}
              </p>

              {editingPermissions ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700">
                      {allPermissions.length} permissions disponibles
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCustomPerms(allPermissions.map(p => p.id))}
                        className="px-2 py-1 bg-gray-100 rounded-lg text-[8px] font-bold text-gray-600"
                      >
                        Tout sélectionner
                      </button>
                      <button
                        onClick={() => setCustomPerms([])}
                        className="px-2 py-1 bg-gray-100 rounded-lg text-[8px] font-bold text-gray-600"
                      >
                        Tout désél.
                      </button>
                    </div>
                  </div>

                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {allPermissions.map(perm => {
                      const isSelected = customPerms.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          onClick={() => handleCustomPermissionToggle(editingPermissions, perm.id)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors ${
                            isSelected ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-orange-600 text-white' : 'bg-gray-200 text-transparent'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-700">{perm.label}</div>
                            <div className="text-[8px] text-gray-400">{perm.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setEditingPermissions(null)}
                      className="flex-1 py-2.5 bg-gray-100 rounded-xl text-xs font-bold text-gray-600"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => saveCustomPerms(editingPermissions)}
                      className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold"
                    >
                      Enregistrer ({customPerms.length} perm.)
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400 text-xs">
                  <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Ouvrez un utilisateur dans l'onglet Utilisateurs<br />
                  puis cliquez sur "Permissions personnalisées"
                </div>
              )}
            </div>
          )}

          {/* ── TAB : Journal d'activité ── */}
          {tab === 'activity' && (
            <ActivityLogView log={data.activityLog || []} currentUser={currentUser} />
          )}
        </div>
      </div>
    </div>
  );
};
