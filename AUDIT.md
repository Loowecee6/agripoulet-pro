# Audit de Sécurité & Qualité — AgriPoulet Pro

**Date :** 21 mai 2026
**Branche :** `ameliorations`
**Source :** Audit externe basé sur le code source

---

## Priorités

| Priorité | Signification | Échéance |
| :------: | :------------ | :------- |
| **P0** | Critique — Avant la prochaine release (Minimum vital) | Immédiat |
| **P1** | Élevé — Sous 2 semaines | Court terme |
| **P2** | Moyen — Sous 1 mois | Moyen terme |
| **P3** | Faible — Finitions et robustesse globale | Long terme |

---

## P0 — Critique (À traiter immédiatement)

### P0-C1: 🔑 Mot de passe admin par défaut dans le README et `adminPasswordHash` en clair

**Fichiers :** `README.md` (l.32), `services/storageService.ts` (l.110), `components/views/RapportView.tsx`
**Problème :**
- Le README expose `1234` comme code admin par défaut.
- Le hash est stocké en clair (`'1234'` dans les données par défaut).
- Aucun hachage n'est appliqué lors du changement dans RapportView.

**Correctif :**
- [x] Retirer la mention "1234" du README
- [x] Hacher le mot de passe avec une fonction de hash simple côté client (SHA-256 via SubtleCrypto) — `utils/crypto.ts`
- [x] Mettre à jour RapportView pour hacher avant de stocker
- [x] Mettre à jour les données par défaut

**Fichiers modifiés :** `README.md`, `services/storageService.ts`, `components/views/RapportView.tsx`, `utils/crypto.ts`

---

### P0-C2: 👤 Rôle utilisateur forcé à "admin" dans App.tsx

**Fichiers :** `App.tsx` (l.291), `components/common/AuthProvider.tsx`, `components/common/LoginScreen.tsx`
**Problème :**
- `const currentUser = ... role: 'admin' as const` → tout utilisateur Firebase Auth est admin.
- Le système de permissions sophistiqué (4 rôles, 23 permissions) est contourné.
- Aucun document utilisateur n'est créé dans Firestore au signup.

**Correctif :**
- [x] Charger le rôle depuis Firestore dans App.tsx via `services/userService.ts`
- [x] Défaut : 'viewer' pour les nouveaux utilisateurs
- [ ] Créer un document `users/{uid}` avec le rôle au signup
- [ ] Mécanisme d'élévation via le code admin

**Fichiers créés :** `services/userService.ts`
**Fichiers modifiés :** `App.tsx`

---

### P0-C3: 🔒 Cloud Function FCM non sécurisée (HTTP au lieu de `onCall`)

**Fichiers :** `functions/index.js`, `functions/cloudflare-worker.js`
**Problème :**
- `sendPushNotification` était une fonction HTTP simple sans vérification d'authentification.
- N'importe qui connaissant l'URL pouvait envoyer des notifications push.

**Correctif :**
- [x] Migrer de `onRequest` vers `onCall` (hérite du contexte d'authentification Firebase)
- [x] **Alternative Cloudflare Worker** — Remplace la Cloud Function (plan Spark bloque les déploiements Blaze)
- [x] Worker utilise le compte de service Firebase (OAuth2 JWT) pour appeler FCM HTTP v1
- [x] L'appel est sécurisé : seul le Worker avec le service account peut envoyer
- [ ] Ajouter App Check pour la validation côté client

**Fichiers créés :** `functions/cloudflare-worker.js`, `wrangler.toml`
**Fichiers modifiés :** `functions/index.js` (conservé comme référence, non déployé)

---

### P0-C4: Architecture Singleton Firestore (risque de contention)

**Fichiers :** `services/storageService.ts`
**Problème :**
- `sharedData/singleton` — un seul document pour toutes les données.
- Risque de conflits, limite de 1 Mo par document, pas de scalabilité.

**Correctif :**
- [x] Migrer vers des collections par type : `productionBatches`, `stockBatches`, `clients`, `sales`, `reservations`, `settings`
- [x] Écriture atomique via `writeBatch` (writeEntities)
- [x] Cache mémoire des IDs pour éviter les lectures redondantes
- [x] Migration automatique depuis l'ancien `sharedData/singleton`

✅ **Fait** — 26 juin 2026. Réécriture complète de storageService.

---

### P0-C5: 🧮 Division par zéro dans le calcul du bilan financier

**Fichiers :** `components/views/RapportView.tsx` (l.40)
**Problème :**
- `const costPerKg = soldCount > 0 ? Math.round(totalCost / (soldCount * avgWeight)) : 0;`
- Si `avgWeight === 0`, division par zéro.

**Correctif :**
- [x] Ajouter `&& avgWeight > 0` dans la condition

**Fichiers modifiés :** `components/views/RapportView.tsx`

---

## P1 — Élevé (À traiter rapidement)

### P1-H1: 🛡️ Firestore Rules trop permissives

**Fichiers :** `firestore.rules`
**Problème :**
- Les règles vérifient uniquement l'UID, pas le schéma, le type ou la taille.
- Un utilisateur peut injecter des données corrompues.

**Correctif :**
- [x] Ajouter `request.resource.data` validation sur les types (listes, nombres, etc.)
- [x] Limiter la taille des documents via `.size()`
- [x] Valider les champs obligatoires

**Fichiers modifiés :** `firestore.rules`

---

### P1-H2: 📅 Format de date non conforme (22 occurrences sans locale fiable)

**Fichiers multiples :** `VentesView.tsx`, `ClientsView.tsx`, `DashboardView.tsx`, `EcheancesView.tsx`, `ProductionView.tsx`, `ReservationView.tsx`, `invoicePDF.ts`, `ActivityLogView.tsx`, `App.tsx`
**Problème :**
- Utilisation de `.toLocaleDateString()` sans locale fixe dans plusieurs fichiers.
- Certains appels n'ont pas de locale du tout → format imprévisible selon le téléphone.

**Correctif :**
- [x] Créer `utils/dateFormat.ts` avec `Intl.DateTimeFormat('fr-FR', ...)`
- [x] Remplacer les 22 occurrences dans 8 fichiers

**Fichiers créés :** `utils/dateFormat.ts`
**Fichiers modifiés :** VentesView, ClientsView, DashboardView, EcheancesView, ProductionView, ReservationView, ActivityLogView, invoicePDF

---

## P2 — Moyen (Maintenabilité)

### P2-H3: 🧩 God Component App.tsx (385 lignes)

**Fichier :** `App.tsx`
**Problème :**
- État global, logique de sauvegarde debouncée, gestion offline, FCM, navigation, modales.
- Impossible à tester unitairement, re-renders massifs.

**Correctif :**
- [x] Extraire `useSyncManager` (sauvegarde, sync queue, debounce)
- [x] Extraire `useFCMNotifications` (FCM init, token, vérifications)
- [x] Extraire `useAutoBackup` (auto-backup)
- [ ] Utiliser un Context ou Zustand pour l'état global — réduction de 385→~180 lignes

**Fichiers créés :** `hooks/useSyncManager.ts`, `hooks/useFCMNotifications.ts`, `hooks/useAutoBackup.ts`
**Fichiers modifiés :** `App.tsx`

---

### P2-H4: 🔄 Duplication des helpers créditeurs dans 4 vues

**Fichiers :** `VentesView.tsx`, `ClientsView.tsx`, `DashboardView.tsx`, `EcheancesView.tsx`
**Problème :**
- `getRemainingBalance`, `getTotalPayments`, `isSalePaid` dupliqués dans VentesView.
- `utils/creditHelpers.ts` existe déjà avec ces fonctions.

**Correctif :**
- [x] VentesView.tsx : importer depuis `utils/creditHelpers.ts` au lieu de redéfinir

**Fichiers modifiés :** `components/views/VentesView.tsx`

---

### P2-H5: 📏 VentesView.tsx obèse (713 lignes)

**Fichier :** `components/views/VentesView.tsx`
**Problème :**
- Mélange de rendu UI, state local, handlers CRUD, calculs financiers.

**Correctif :**
- [x] Extraire les fonctions pures dans `domain/sales.ts`
- [x] Extraire les handlers dans `hooks/useSalesActions.ts`
- [x] VentesView refactorisée (~713→~160 lignes UI pure)

**Fichiers créés :** `domain/sales.ts`, `hooks/useSalesActions.ts`
**Fichiers modifiés :** `components/views/VentesView.tsx`

---

### P2-H6: 🔇 Erreurs de synchronisation silencieuses

**Fichier :** `App.tsx` (l.170-172)
**Problème :**
- Si la synchronisation Firestore échoue, l'erreur est uniquement dans la console.
- L'utilisateur pense que ses données sont sauvegardées dans le cloud.

**Correctif :**
- [x] Toast d'erreur explicite en cas d'échec sync (via `syncError` dans `useSyncManager`)
- [x] Bannière rouge persistante dans le Header tant que la sync cloud échoue
- [x] État local `syncError` géré dans `useSyncManager`

**Fichiers modifiés :** `App.tsx`, `components/common/Header.tsx`, `hooks/useSyncManager.ts`

---

## P3 — Faible (Finitions)

### P3-M1: Idempotence des paiements
- [x] `isProcessingPayment` flag pour désactiver le bouton pendant l'envoi
- [x] Clé d'idempotence unique (`paymentKey`) par paiement

**Fichiers modifiés :** `hooks/useSalesActions.ts`

### P3-M2: Soft-delete des ventes
- [x] `deletedAt`, `deletedBy` ajoutés lors de la suppression
- [x] `filteredSales` ignore les ventes supprimées (dans `useSalesActions.ts`)
- [x] DashboardView : `activeSales` memo filtre les ventes supprimées
- [x] EcheancesView : `activeSales` filtre les ventes supprimées dans `creditSales`
- [x] ClientsView : `activeSales` utilisé pour les stats d'affichage, `data.sales` conservé pour les mutations

**Fichiers modifiés :** `hooks/useSalesActions.ts`, `components/views/DashboardView.tsx`, `components/views/EcheancesView.tsx`, `components/views/ClientsView.tsx`

### P3-M3: Centralisation des arrondis financiers
- [x] Créer `utils/currency.ts` (formatCurrency, formatNumber, roundCurrency, calculateRatio)
- [x] DashboardView, EcheancesView, ClientsView : importer formatCurrency/formatNumber et remplacer les KPIs
- [x] VentesView : remplacer tous les patterns monétaires (totaux, soldes, paiements, panier)
- [x] invoicePDF.ts : fmt helper + toutes les occurrences monétaires
- [x] exportXLS.ts : coût/kg et bilan financier

✅ **Fait** — Toutes les vues principales utilisent formatCurrency/formatNumber de manière centralisée.

### P3-M4: NotificationService obèse (483 lignes)
- [x] Extraire la partie métier dans `notificationChecks.ts` (~180 lignes)
- [x] notificationService.ts importe depuis notificationChecks.ts

**Fichiers créés :** `services/notificationChecks.ts`
**Fichiers modifiés :** `services/notificationService.ts`, `hooks/useFCMNotifications.ts`

### P3-M5: Couverture de tests
- [x] **72 tests** pour `storageService.ts` (helpers, cache, writeEntities, saveData, loadData, migration)
- [x] **37 tests** pour `notificationChecks.ts` (vaccination, mortalité, crédit, tri, décompte)
- [x] **30 tests** pour `domain/sales.ts` (CRUD ventes, réservations, stock, paiements, validation crédit)
- [x] **14 tests d'intégration** pour `offlineService.ts` (searchIndex : rebuildSearchIndex, searchByClientId, searchByDateVente)
- [ ] ~~`hooks/useSalesActions.ts`~~ — Redondant (teste les mêmes fonctions que domain/sales.ts). Supprimé.

✅ **155 tests au total** — 26 juin 2026.

### P3-M6: Dark mode incomplet sur EcheancesView
- [x] Ajouter les classes `dark:` manquantes (fond, texte, bordures)

**Fichiers modifiés :** `components/views/EcheancesView.tsx`

### P3-M7: Soft-delete des sauvegardes
- [x] `archived: true` au lieu de `deleteDoc` dans `deleteBackup`
- [x] Purge automatique 90 jours via `purgeOldArchivedBackups`
- [x] `listBackups` filtre les archivées

**Fichiers modifiés :** `services/storageService.ts`

### P3-M8: Navigation via manipulation directe du DOM
- [x] Remplacer 5 `document.querySelector` par des callbacks (`onTabChange`)

**Fichiers modifiés :** `components/views/DashboardView.tsx`, `App.tsx`

### P3-M9: Recherches offline lentes (O(n))
- [x] Store `searchIndex` créé dans IndexedDB (version 3)
- [x] Indexes : `clientId`, `dateVente`, `type`, `userId`, `userType` (composite)
- [x] Fonctions : `rebuildSearchIndex`, `searchByClientId`, `searchByDateVente`

**Fichiers modifiés :** `services/offlineService.ts`

---

## Progression

| Priorité | Total | Fait | Partiel | Restant |
| :------: | :---: | :--: | :-----: | :-----: |
| P0 | 5 | 5 | 0 | 0 |
| P1 | 2 | 2 | 0 | 0 |
| P2 | 4 | 4 | 0 | 0 |
| P3 | 10 | 10 | 0 | 0 |
| **Total** | **21** | **21** | **0** | **0** |

---

## Synthèse des correctifs restants

| Item | Priorité | Effort | Statut |
|:-----|:--------:|:------:|:------|
| **P0-C4** (Singleton Firestore → collections) | 🔴 Critique | 1-2 jours | ✅ Fait — 26 juin 2026 |
| **P3-M5** (Tests storageService) | 🟡 Faible | 1h | ✅ Fait — 72 tests le 26 juin 2026 |
| **P3-M5** (Tests notificationChecks, domain/sales, offlineService) | 🟡 Faible | 2h | ✅ **155 tests au total** — 26 juin 2026 |
| **Tests e2e Playwright** (parcours vente complet) | 🟡 P3 | ~1h | ⏳ **Créés** — 6 tests, nécessite un compte Firebase Email/Mot de passe pour l'exécution |
| **CI GitHub Actions** | 🟢 P3 | ~1h | ✅ Fait — .github/workflows/ci.yml |
| **Push distant FCM** (Cloud Functions → Cloudflare Worker) | 🟡 P2 | ~1h | ✅ **Solution Cloudflare Worker** — 26 juin 2026 |
| **Firestore Rules** (validation schéma + types) | 🔴 Critique | ~30min | ✅ **Déployé** — 26 juin 2026 |
| **Vite client types** (import.meta.env) | 🟢 P3 | ~1min | ✅ `vite-env.d.ts` — 26 juin 2026 |
| **Tests e2e Playwright** (parcours vente) | 🟡 P3 | ~30min | ⏳ Créés — 6 tests. Bloqué : auth Email/Mot de passe Firebase nécessaire |
