import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppData, User, UserRole } from './types';
import { useAuth } from './components/common/AuthProvider';
import { LoginScreen } from './components/common/LoginScreen';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ProductionView } from './components/views/ProductionView';
import { StockView } from './components/views/StockView';
import { VentesView } from './components/views/VentesView';
import { ClientsView } from './components/views/ClientsView';
import { RapportView } from './components/views/RapportView';
import { DashboardView } from './components/views/DashboardView';
import { ReservationView } from './components/views/ReservationView';
import { EcheancesView } from './components/views/EcheancesView';
import { FacturierView } from './components/views/FacturierView';
import { NotificationSettings } from './components/common/NotificationSettings';
import { getUserPermissions } from './utils/permissions';
import { UserManagement } from './components/common/UserManagement';
import { ProductionGoals } from './components/common/ProductionGoals';
import { useCurrentSeason } from './hooks/useCurrentSeason';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useRealtimeData } from './hooks/useRealtimeData';
import { useFCMNotifications } from './hooks/useFCMNotifications';
import { getUserRole } from './services/userService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { exportFullBackup } from './utils/exportXLS';
import { db } from './services/firebaseConfig';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { calculateTotalSoldFromSales } from './domain/sales';

const APP_VERSION = 'v6';

export default function App() {
  const { user, signOutUser } = useAuth();
  const { data: cloudData, isLoading: isInitialLoading, error: syncError, updateData } = useRealtimeData(user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // ── Vérification version ──
  const [versionChecked, setVersionChecked] = useState(false);
  useEffect(() => {
    const cached = localStorage.getItem('app_version');
    if (cached !== APP_VERSION) {
      localStorage.setItem('app_version', APP_VERSION);
      setTimeout(() => window.location.reload(), 50);
    } else {
      setVersionChecked(true);
    }
  }, []);

  // ── Connexion réseau ──
  const isOnline = useOnlineStatus();

  // ── Hook : Auto-backup ──
  useAutoBackup(cloudData, user, isInitialLoading);

  // ── Hook : Notifications FCM ──
  const {
    notificationEvents,
    notifications,
    overdueCount,
  } = useFCMNotifications({ user, data: cloudData, isInitialLoading, setData: updateData });

  // ── Chargement du rôle ──
  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    getUserRole(user.uid, user.email || undefined, user.displayName || undefined).then(setUserRole).catch(console.error);
  }, [user]);

  // ── État local : saison ──
  const [seasonOffset, setSeasonOffset] = useState(0);
  useEffect(() => {
    if (cloudData?.settings.seasonOffset !== undefined) {
      setSeasonOffset(cloudData.settings.seasonOffset);
    }
  }, [cloudData?.settings.seasonOffset]);
  const season = useCurrentSeason(seasonOffset);

  // ── Sync darkMode avec class Tailwind ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!cloudData?.settings.darkMode);
  }, [cloudData?.settings.darkMode]);

  // ── Blocage du rendu tant que la version n'est pas vérifiée ──
  if (!versionChecked) return null;

  // ── Écran de chargement initial ──
  if (isInitialLoading && !cloudData) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
        <p className="text-orange-900 font-bold animate-pulse">Connexion au Cloud...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
        <p className="text-orange-900 font-bold animate-pulse">Chargement du profil...</p>
      </div>
    );
  }

  // ── Helpers ──
  const currentUser = user
    ? ({ id: user.uid, name: user.displayName || user.email || 'Utilisateur', role: userRole || 'viewer' } as User)
    : null;

  const userPermissions = currentUser ? getUserPermissions(currentUser.role) : [];

  const updateNotificationPrefs = (prefs: AppData['settings']['notifications']) => {
    if (!cloudData) return;
    updateData({
      ...cloudData,
      settings: {
        ...cloudData.settings,
        notifications: prefs,
      },
    });
  };

  const handleSeasonOffsetChange = (newOffset: number) => {
    const clamped = Math.max(-90, Math.min(90, newOffset));
    setSeasonOffset(clamped);
    if (!cloudData) return;
    updateData({
      ...cloudData,
      settings: {
        ...cloudData.settings,
        seasonOffset: clamped,
      },
    });
  };

  const toggleDarkMode = () => {
    if (!cloudData) return;
    const next = !cloudData.settings.darkMode;
    updateData({ ...cloudData, settings: { ...cloudData.settings, darkMode: next } });
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <ErrorBoundary>
      <div
        className={`min-h-screen ${cloudData?.settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'} max-w-md mx-auto relative shadow-2xl flex flex-col ${cloudData?.settings.darkMode ? 'border-gray-800' : 'border-x border-gray-100'} font-sans selection:bg-orange-100`}
      >
        <Header
          user={currentUser}
          onLogout={signOutUser}
          notifications={notifications}
          overdueCount={overdueCount}
          notificationEvents={notificationEvents}
          isOnline={isOnline}
          onBackup={cloudData ? () => exportFullBackup(cloudData) : undefined}
          onRepairStock={cloudData ? async () => {
            const lots = cloudData.stockBatches;
            if (lots.length === 0) { alert('Aucun stock.'); return; }

            // Calculer le stock actuel total
            const stockActuel = lots.reduce((s, b) => s + (b.quantite || 0) + b.poulets.filter(p => !p.vendu).length, 0);
            // Calculer le total vendu à partir des factures
            const totalVendus = calculateTotalSoldFromSales(cloudData.sales);
            // Stock final après déduction des ventes
            const stockFinal = Math.max(0, stockActuel - totalVendus);

            // Diagnostic détaillé
            const diagLots = lots.map((b, i) =>
              `  Lot ${i + 1}: "${b.nom}" → ${b.quantite || 0} poulets`
            ).join('\n');
            const nbFactures = cloudData.sales.filter(s => !('deletedAt' in s)).length;
            alert(
              `📊 DIAGNOSTIC COMPLET\n\n` +
              `${diagLots}\n\n` +
              `📋 Ventes enregistrées : ${nbFactures} facture(s)\n` +
              `🐔 Poulets vendus (total) : ${totalVendus}\n` +
              `📦 Stock actuel total : ${stockActuel}\n` +
              `🎯 Stock après correction : ${stockFinal}`
            );

            if (!confirm(
              `Corriger le stock ?\n\n` +
              `📦 Stock total : ${stockActuel} poulets\n` +
              `📋 Déjà vendus : ${totalVendus} poulets\n` +
              `🎯 Stock final : ${stockFinal} poulets\n\n` +
              `Les factures existantes sont conservées.`
            )) return;

            // Garder seulement le 1er lot avec la quantité corrigée
            const firstBatch = lots[0];
            const kept = {
              ...firstBatch,
              poulets: firstBatch.poulets ?? [],
              typeOrigine: firstBatch.typeOrigine || 'PR',
              lettre: firstBatch.lettre || 'A',
              prixKg: firstBatch.prixKg || 0,
              coutInitial: firstBatch.coutInitial || 0,
              isFinalized: firstBatch.isFinalized ?? false,
              quantite: stockFinal,
            };

            try {
              // 1. Écrire le lot conservé dans Firestore
              await setDoc(doc(db, 'stockBatches', firstBatch.id), kept);
              // 2. Supprimer les autres lots
              for (let i = 1; i < lots.length; i++) {
                await deleteDoc(doc(db, 'stockBatches', lots[i].id));
              }
              // 3. Mettre à jour l'état local
              updateData({ ...cloudData, stockBatches: [kept] });
              alert(
                `✅ Stock synchronisé avec les ventes !\n\n` +
                `📦 ${stockActuel} → ${stockFinal} poulets\n` +
                `📋 ${totalVendus} poulets déduits (${nbFactures} factures conservées)\n` +
                `${lots.length - 1} lot(s) en trop supprimé(s).\n\n` +
                `Les modifications sont persistées dans Firestore.`
              );
            } catch (e: any) {
              alert(
                `❌ ÉCHEC DE L'ÉCRITURE FIRESTORE\n\n` +
                `Erreur: ${e?.message || e || 'Erreur inconnue'}\n\n` +
                `Code: ${e?.code || 'N/A'}\n\n` +
                `Veuillez copier ce message et me le transmettre.`
              );
            }
          } : undefined}
          syncError={syncError}
          onOpenNotifSettings={() => setShowNotifSettings(true)}
          darkMode={cloudData?.settings.darkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenUserManagement={() => setShowUserManagement(true)}
          currentSeason={season.active || undefined}
          seasonWarning={season.data?.warning || null}
          onSeasonOffsetChange={handleSeasonOffsetChange}
          seasonOffset={seasonOffset}
        />
        <main className="flex-1 p-4 pb-24 overflow-y-auto scroll-smooth">
          {cloudData && activeTab === 'dashboard' && <DashboardView data={cloudData} onTabChange={setActiveTab} permissions={userPermissions} />}
          {cloudData && activeTab === 'dashboard' && <ProductionGoals data={cloudData} />}
          {cloudData && activeTab === 'production' && userPermissions.includes('production.view') && (
            <ProductionView data={cloudData} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {cloudData && activeTab === 'stock' && userPermissions.includes('stock.view') && (
            <StockView data={cloudData} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {cloudData && activeTab === 'ventes' && userPermissions.includes('ventes.view') && (
            <VentesView data={cloudData} setData={updateData} onTabChange={setActiveTab} permissions={userPermissions} />
          )}
          {cloudData && activeTab === 'clients' && userPermissions.includes('clients.view') && (
            <ClientsView data={cloudData} setData={updateData} />
          )}
          {cloudData && activeTab === 'echeances' && userPermissions.includes('ventes.view') && (
            <EcheancesView data={cloudData} />
          )}
          {cloudData && activeTab === 'reservations' && (userPermissions.includes('reservations.create') || userPermissions.includes('reservations.edit')) && (
            <ReservationView data={cloudData} setData={updateData} darkMode={cloudData.settings.darkMode} />
          )}
          {cloudData && activeTab === 'rapport' && userPermissions.includes('rapports.view') && (
            <RapportView data={cloudData} setData={updateData} user={currentUser} permissions={userPermissions} />
          )}
          {cloudData && activeTab === 'facturier' && userPermissions.includes('ventes.facturier') && (
            <FacturierView data={cloudData} setData={updateData} onBack={() => setActiveTab('dashboard')} darkMode={cloudData.settings.darkMode} />
          )}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} permissions={userPermissions} />

        {cloudData && (
          <NotificationSettings
            prefs={
              cloudData.settings.notifications || {
                enabled: true,
                vaccinationReminders: true,
                mortalityAlerts: true,
                creditDeadlines: true,
              }
            }
            onSave={updateNotificationPrefs}
            isOpen={showNotifSettings}
            onClose={() => setShowNotifSettings(false)}
          />
        )}

        {cloudData && currentUser && (
          <UserManagement
            data={cloudData}
            setData={updateData}
            currentUser={currentUser}
            isOpen={showUserManagement}
            onClose={() => setShowUserManagement(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
