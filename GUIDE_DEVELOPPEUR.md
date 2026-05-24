# 🐔 AgriPoulet Pro — Guide du Développeur

> **Application mobile-first** de gestion d'élevage de poulets de chair (Sénégal / Afrique de l'Ouest).
> PWA hors-ligne first, synchronisation cloud Firestore, notifications push FCM.

---

## 📑 Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Stack technique](#2-stack-technique)
3. [Structure du projet](#3-structure-du-projet)
4. [Types & Data Model](#4-types--data-model)
5. [Services clés](#5-services-clés)
6. [Composants principaux](#6-composants-principaux)
7. [Fonctionnalités détaillées](#7-fonctionnalités-détaillées)
8. [Système de permissions](#8-système-de-permissions)
9. [Saisons Sénégal & Détection climatique](#9-saisons-sénégal--détection-climatique)
10. [Notifications Push & FCM](#10-notifications-push--fcm)
11. [Stockage & Offline](#11-stockage--offline)
12. [Tests](#12-tests)
13. [Déploiement & Firebase](#13-déploiement--firebase)
14. [Bonnes pratiques & Conventions](#14-bonnes-pratiques--conventions)
15. [FAQ Développeur](#15-faq-développeur)

---

## 1. Architecture générale

```
┌─────────────────────────────────────────┐
│              App.tsx (Root)              │
│  ┌───────────┐  ┌──────────────────┐   │
│  │ AuthProvider│  │  ToastProvider    │   │
│  └─────┬─────┘  └──────────────────┘   │
│        │                               │
│  ┌─────▼──────────────────────────┐    │
│  │  Header (icône saison + notifs) │    │
│  │  ┌──────────────────────────┐   │    │
│  │  │      Contenu (vues)      │   │    │
│  │  │  DashboardView           │   │    │
│  │  │  ProductionView (intégré)│   │    │
│  │  │  StockView               │   │    │
│  │  │  ClientsView             │   │    │
│  │  │  VentesView              │   │    │
│  │  │  EcheancesView           │   │    │
│  │  │  ReservationView         │   │    │
│  │  │  RapportView             │   │    │
│  │  └──────────────────────────┘   │    │
│  │  BottomNav (8 onglets)          │    │
│  └──────────────────────────────────┘    │
│                                           │
│  Services (Firestore, Offline, Notifs...)│
└─────────────────────────────────────────┘
```

### Flux de données

```
User Action → setData() → storageService.saveData()
                                ├─ IndexedDB (offline-first, instant)
                                └─ Firestore (async, background)
```

L'application est **offline-first** : toute action est d'abord écrite en local (IndexedDB), puis synchronisée avec Firestore dès que la connexion est disponible.

---

## 2. Stack technique

| Technologie | Usage |
|---|---|
| **React 18** | UI |
| **TypeScript** | Typage |
| **Vite 5** | Build |
| **Tailwind CSS** | Styles |
| **Firebase Auth** | Authentification |
| **Firebase Firestore** | Cloud DB |
| **Firebase Cloud Messaging** | Notifications push |
| **Firebase Cloud Functions** | Push distant via HTTP |
| **IndexedDB (idb library)** | Cache offline |
| **Recharts** | Graphiques |
| **jsPDF + jspdf-autotable** | Factures PDF |
| **qrcode** | QR codes pour étiquettes |
| **lucide-react** | Icônes |
| **Vitest** | Tests unitaires |
| **Open-Meteo API** | Données météo (gratuit, sans clé) |

---

## 3. Structure du projet

```
agripoulet-pro/
├── index.html                    # PWA entry (inclut Firebase SDK)
├── index.tsx                     # React entry point
├── App.tsx                       # Root component (toute la logique app)
├── constants.tsx                 # Vaccination schedule, weight refs, tabs
├── types.ts                      # Tous les types TypeScript
├── tsconfig.json                 # Configuration TS (inclut vite/client)
├── vite.config.ts                # Vite config (PWA, proxy)
├── package.json                  # Dépendances
├── components/
│   ├── common/
│   │   ├── Header.tsx            # Header avec badge saison + notifs + dark mode
│   │   ├── BottomNav.tsx         # Navigation à 8 onglets
│   │   ├── AuthProvider.tsx      # Contexte d'authentification Firebase
│   │   ├── Modal.tsx             # Modale réutilisable
│   │   ├── SearchBar.tsx         # Barre de recherche
│   │   ├── QuickAddGrid.tsx      # Grille de prix rapide
│   │   ├── ToastContext.tsx      # Système de toasts
│   │   ├── ToastContainer.tsx    # Affichage des toasts
│   │   ├── ConnectionStatus.tsx  # Statut en ligne/hors-ligne
│   │   ├── SeasonalStats.tsx     # Statistiques saisonnières (Sénégal)
│   │   ├── ProductionGoals.tsx   # Objectifs de production
│   │   ├── BatchAnalytics.tsx    # Analyse détaillée par bande
│   │   ├── NotificationSettings.tsx # Paramètres de notifications
│   │   ├── UserManagement.tsx    # Gestion multi-utilisateurs
│   │   ├── ActivityLogView.tsx   # Journal d'activité
│   │   ├── BackupManager.tsx     # Sauvegardes cloud
│   │   ├── DataMigration.tsx     # Migration données locales -> cloud
│   │   └── ...
│   └── views/
│       ├── DashboardView.tsx     # Tableau de bord principal
│       ├── StockView.tsx         # Gestion des lots de stock
│       ├── ClientsView.tsx       # Base clients
│       ├── VentesView.tsx        # Ventes & crédits
│       ├── EcheancesView.tsx     # Calendrier des échéances
│       ├── ReservationView.tsx   # Réservations clients
│       └── RapportView.tsx       # Bilans financiers + Backup + Migration
├── services/
│   ├── firebaseConfig.ts         # Config Firebase + VAPID key
│   ├── storageService.ts         # Offline-first storage (IDB + Firestore)
│   ├── offlineService.ts         # IndexedDB CRUD + sync queue
│   ├── notificationService.ts    # Notifications push FCM + locales
│   ├── weatherService.ts         # Météo Open-Meteo + détection saisons
│   └── activityLogger.ts         # Journal d'activité utilisateur
├── hooks/
│   └── useCurrentSeason.ts       # Hook saison dynamique (API + calendaire)
├── utils/
│   ├── permissions.ts            # Système de permissions RBAC
│   ├── whatsapp.ts               # Génération liens WhatsApp
│   ├── creditHelpers.ts          # Helpers crédit (solde, risque, paiements)
│   ├── invoicePDF.ts             # Génération factures PDF
│   ├── labelPrint.ts             # Étiquettes QR code A4
│   └── exportXLS.ts              # Export CSV/Excel
├── scripts/
│   ├── explore_firestore.ts      # Script exploration Firestore
│   └── firebase_test.ts          # Tests Firebase
├── functions/                    # Cloud Functions Firebase
│   ├── index.js                  # Fonction sendNotificationPush
│   ├── package.json
│   └── .gitignore
├── public/
│   ├── firebase-messaging-sw.js  # Service Worker FCM v2
│   └── ... (PWA assets)
├── utils/__tests__/
│   ├── whatsapp.test.ts          # Tests WhatsApp
│   └── creditHelpers.test.ts     # Tests crédit
└── ETAT_PROJET.md                # État d'avancement du projet
```

---

## 4. Types & Data Model

Tous les types sont dans **`types.ts`**. Voici les principales entités :

### 👤 User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole; // 'super_admin' | 'admin' | 'manager' | 'viewer'
  permissions?: string[];
  createdAt: string;
}
```

### 🐣 ProductionBatch (Bande de production)
```typescript
interface ProductionBatch {
  id: string;
  nom: string;
  dateMisePlace: string;
  nbPoussinsInitial: number;
  prixAchatPoussin: number;
  suiviQuotidien: DailyRecord[]; // suivis journaliers
  depenses: Expense[];
  vaccinations: Vaccination[];
  statut: 'active' | 'cloturee';
  notes?: string;
}
```

### 📦 StockBatch (Lot de stock)
```typescript
interface StockBatch {
  id: string;
  typeOrigine: 'PR' | 'IM'; // Production ou Importation
  lettre: string;
  nom: string;
  prixKg: number;
  coutInitial: number;
  poulets: Chicken[];        // poulets étiquetés
  isFinalized: boolean;
  productionBatchId?: string; // lien vers la bande d'origine
}
```

### 🐔 Chicken
```typescript
interface Chicken {
  id: string;
  numero: string;        // ex: PR-A001
  poids: number;         // kg
  prix: number;          // Frs
  vendu: boolean;
}
```

### 👥 Client
```typescript
interface Client {
  id: string;
  nom: string;
  tel: string;
  adresse: string;
  notes?: string;
}
```

### 💰 Sale (Vente)
```typescript
interface Sale {
  id: string;
  clientId: string;
  clientNom: string;
  pouletIds: string[];
  total: number;
  isCredit: boolean;
  dueDate?: string;
  isPaid: boolean;
  dateVente: string;
  payments?: Payment[];
}
```

### 📅 Reservation
```typescript
interface Reservation {
  id: string;
  clientId: string;
  clientNom: string;
  pouletIds: string[];
  dateReserve: string;
  statut: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  acompte?: number;
}
```

### AppData (State global)
```typescript
interface AppData {
  productionBatches: ProductionBatch[];
  stockBatches: StockBatch[];
  clients: Client[];
  sales: Sale[];
  reservations: Reservation[];
  settings: AppSettings;
  users?: User[];
  activityLog?: ActivityLogEntry[];
  fcmToken?: string;
  fcmPushFunctionUrl?: string;
}
```

### AppSettings
```typescript
interface AppSettings {
  adminPasswordHash: string;
  notifications: NotificationPrefs;
  seasonOffset?: number; // décalage saisonnier en jours (climat)
  darkMode?: boolean;
}
```

---

## 5. Services clés

### 🔥 `services/firebaseConfig.ts`
- Initialise Firebase avec les variables d'environnement `VITE_FIREBASE_*`
- Exporte `auth`, `db` (Firestore), `VAPID_KEY` (pour FCM)
- La clé VAPID est lue depuis `.env.local` via `VITE_FIREBASE_VAPID_KEY`

### 💾 `services/storageService.ts` (Offline-first)
- **`saveData(userId, data)`** : Écrit localement dans IndexedDB (instantané), puis tente Firestore. Si hors-ligne, la donnée est mise en file d'attente (`syncQueue`)
- **`loadData(userId)`** : Lit Firestore d'abord, puis cache local si hors-ligne
- **`createBackup/restoreBackup/deleteBackup`** : Sauvegardes cloud Firestore
- **`forceSync(userId, data)`** : Synchronisation forcée

### 📡 `services/offlineService.ts`
- Interface bas niveau avec IndexedDB via la librairie `idb`
- `syncQueue` : stocke les opérations en attente de synchronisation
- FIFO : les opérations sont rejouées dans l'ordre quand la connexion revient

### 🔔 `services/notificationService.ts`
- **FCM (Firebase Cloud Messaging)** : Service Worker enregistré, token généré avec VAPID, push distant via Cloud Function
- **Notifications locales** : vaccination (J-2 à J+3), mortalité (>3% ou >5%), crédit (échéance J-3 à J+7)
- Déduplication des notifications via Set d'IDs
- Push distant envoyé via `sendRemotePush()` → Cloud Function HTTP

### 🌤️ `services/weatherService.ts` (Saisons Sénégal)
- Détection dynamique de la saison via l'API Open-Meteo (gratuite, sans clé)
- Analyse des précipitations sur 14 jours pour détecter l'hivernage
- Cache 1h pour limiter les appels API
- `getCurrentSeasonData(offset)` : Combine calendrier + météo
- `getSeasonFromMonth(month, offset)` : Saison calendaire avec décalage

### 📝 `services/activityLogger.ts`
- Journalise toutes les actions utilisateur (création, modification, suppression)
- Limité à 500 entrées
- Actions typées : `production.create`, `ventes.create`, `users.edit`, etc.

---

## 6. Composants principaux

### `App.tsx` — Le hub central
- Gère **tout l'état** (`data`, `setData`) — il n'y a pas de state management externe
- Comporte ~900 lignes. **C'est le fichier le plus volumineux et le plus critique.**
- Gère l'authentification, la synchronisation, les notifications, la navigation
- Le pattern est : chaque vue reçoit `data` et `setData` en props et modifie l'état global

> ⚠️ **Attention** : `setData` provoque une sauvegarde complète via `storageService.saveData()`. Évitez les appels trop fréquents.

### `Header.tsx`
- Badge de saison actuelle avec popover de réglage d'offset (±7 jours, limité ±90j)
- Icônes de notifications (cloche avec compteur)
- Menu utilisateur avec déconnexion
- Mode sombre (dark mode)
- Indicateur de connexion/synchronisation

### `BottomNav.tsx`
- Navigation à 8 onglets : Accueil, Prod., Stock, Client, Ventes, Échéanc., Réserv., Bilan

### `DashboardView.tsx`
- KPIs : poulets vivants, crédits en cours, ventes du jour/mois
- Graphiques : évolution des ventes (30 jours), répartition, top clients, poids des bandes
- Alertes : crédit, mortalité, vaccins, stock
- Relance WhatsApp groupée
- Statistiques saisonnières
- Raccourcis rapides vers les fonctionnalités principales

---

## 7. Fonctionnalités détaillées

### 📊 Production (intégré dans App.tsx)
- Création de bandes avec programme de vaccination
- Suivi quotidien : mortalité, consommation, poids (échantillonnage)
- Courbe de poids vs théorique (référence Hubbard)
- Calcul automatique de l'indice de consommation (IC)
- Alertes vaccination et mortalité

### 📦 Stock
- Lots de production (PR) ou importation (IM)
- Système d'étiquetage avec matricules automatiques
- Calcul réciproque poids ⇔ prix (basé sur prix/kg)
- Impression d'étiquettes avec QR code (6 par page A4)

### 👥 Clients
- Base de données clients avec téléphone, adresse, notes
- Filtres par activité (30j, 60j+) et risque crédit
- Tri par nom, récent, dépense
- Fiche client détaillée avec historique d'achats, crédits, réservations
- Relance WhatsApp directe

### 💰 Ventes & Crédits
- Panier de vente avec sélection par lot de stock
- Prix calculé automatiquement (poids × prix/kg)
- Vente à crédit possible (max 15 jours d'échéance)
- Paiements partiels (espèces, Orange Money, Wave)
- Génération de facture PDF avec QR code
- Barre de progression du remboursement

### 📅 Échéances
- Vue calendrier des crédits avec filtres (en retard, à venir, soldées)
- Relance WhatsApp intégrée avec message pré-rempli
- Compteurs : retard, imminent, soldé

### 📆 Réservations
- Bloquer des poulets du stock pour un client
- 4 statuts : en attente, confirmée, annulée, terminée
- Acompte optionnel
- Rappel WhatsApp automatique
- Les poulets réservés sont exclus du stock disponible

### 📈 Bilans
- Compte de résultat par lot (coût poussins + dépenses vs recettes)
- Export CSV des dépenses et du bilan
- Clôture des lots
- Changement de code secret admin
- Sauvegardes cloud + migration données locales

### 🎯 Objectifs de production
- Poids cible (2.5kg à J42)
- Taux de mortalité (max 5%)
- FCR (cible 1.8)
- Prix de vente moyen (cible 2500 F/kg)
- Taux de survie (cible 95%)
- Progression temps réel avec barres et indicateurs

---

## 8. Système de permissions

Dans `utils/permissions.ts` avec des rôles RBAC :

```typescript
type UserRole = 'super_admin' | 'admin' | 'manager' | 'viewer';
```

| Rôle | Droits |
|---|---|
| **super_admin** | Tout : gestion utilisateurs, suppression, paramètres, finalisation |
| **admin** | CRUD complet, paramètres, mais pas de gestion des utilisateurs |
| **manager** | CRUD production, stock, clients, ventes. Pas de suppression, pas de paramètres |
| **viewer** | Lecture seule |

Les permissions par défaut sont définies dans `types.ts` via `DEFAULT_ROLE_PERMISSIONS`.

---

## 9. Saisons Sénégal & Détection climatique

### Les 3 saisons sénégalaises

| Saison | Période | Température | Caractéristiques |
|---|---|---|---|
| **Sèche (fraîche)** 🌤️ | Novembre – Février | 20–30 °C | Harmattan, nuits fraîches |
| **Sèche (chaude)** ☀️ | Mars – Juin | 30–45 °C | Forte chaleur intérieure |
| **Pluies (hivernage)** 🌧️ | Juillet – Octobre | 30–35 °C | Pluies abondantes, humidité |

### Détection hybride (3 niveaux)

1. **Calendrier fixe** : `getSeasonFromMonth()` avec les dates traditionnelles
2. **API Open-Meteo** : `detectSeasonFromWeather()` analyse les précipitations des 14 derniers jours
3. **Ajustement manuel** : L'utilisateur peut décaler les saisons de ±90 jours via le popover dans le Header

La fonction `getCurrentSeasonData(offset)` combine ces 3 sources et retourne :
- `calendarSeason` : saison selon le calendrier
- `weatherAdjustedSeason` : saison ajustée par la météo (si disponible)
- `warning` : alerte climatique (ex: sécheresse en période d'hivernage)
- `isLoading`, `error`

### Hook React
```typescript
// hooks/useCurrentSeason.ts
const { data: seasonData, loading, error, refresh } = useCurrentSeason(offset);
```

Le hook rafraîchit automatiquement toutes les heures. En cas d'échec de l'API, il utilise le calendrier comme fallback.

---

## 10. Notifications Push & FCM

### Architecture
```
App (Client)                     Cloud Function              App (Client)
┌─────────┐    HTTP POST     ┌──────────────┐    FCM      ┌─────────┐
│ Envoie   │ ──────────────> │ sendNotification│ ──────> │ Reçoit   │
│ token    │                 │ Push (Firebase) │          │ notif    │
│ + titre  │ <────────────── │  Functions     │          │ (SW)     │
└─────────┘    Réponse       └──────────────┘          └─────────┘
```

### Configuration requise
1. Ajouter `VITE_FIREBASE_VAPID_KEY` dans `.env.local`
2. Déployer la Cloud Function : `cd functions && firebase deploy --only functions`
3. Définir `fcmPushFunctionUrl` dans les données utilisateur (via les paramètres notification)

### Service Worker
Le fichier `public/firebase-messaging-sw.js` est un Service Worker v2 spécial FCM qui :
- Écoute les messages push Firebase en arrière-plan
- Affiche les notifications même quand l'application est fermée

---

## 11. Stockage & Offline

### Stratégie offline-first
```
setData() ──> IndexedDB (écriture instantanée)
              └──> Firestore (async, silencieux en cas d'échec)
```

### Sync Queue
- Quand Firestore est indisponible, les opérations sont stockées dans `syncQueue`
- À la reconnexion, `App.tsx` vide la queue et synchronise tout
- FIFO : les opérations sont rejouées dans l'ordre

### Cache IndexedDB
- Base : `agripoulet-pro`, version 2
- Stores : `appData` (clé = userId), `syncQueue` (auto-increment)
- Les données locales sont toujours disponibles même hors-ligne

---

## 12. Tests

### Tests unitaires (Vitest)
```bash
npx vitest run          # Exécuter tous les tests
npx vitest              # Mode watch
```

**Tests existants** (37 tests) :
- `utils/__tests__/whatsapp.test.ts` — Génération de liens WhatsApp, validation numéros
- `utils/__tests__/creditHelpers.test.ts` — Calcul soldes, statuts paiement, risque crédit

### Compilation TypeScript
```bash
npx tsc --noEmit
```

**Erreurs pré-existantes connues** (à ignorer) :
- `scripts/*.ts` — Scripts utilitaires non inclus dans le build
- Certaines erreurs dans `firebaseConfig.ts` liées à l'environnement Vite

---

## 13. Déploiement & Firebase

### Prérequis
```bash
npm install          # Installer les dépendances
```

### Variables d'environnement
Créer un fichier `.env.local` à la racine :
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_FIREBASE_VAPID_KEY=xxx   # Clé de Cloud Messaging
```

### Build production
```bash
npm run build
```

### Cloud Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

### Règles Firestore
Le fichier `firestore.rules` définit les règles de sécurité. Actuellement en mode test (ouvert).

---

## 14. Bonnes pratiques & Conventions

### Code
- **TypeScript strict** : toujours typer les interfaces et props
- **useMemo** pour les calculs coûteux (stats, graphiques)
- **crypto.randomUUID()** pour les IDs (disponible dans tous les navigateurs modernes)
- Éviter les `any` — typer correctement

### Composants
- Les composants reçoivent `data` et `setData` en props (pas de store externe)
- Utiliser `useToast()` pour les feedback utilisateur
- Modales via `<Modal>` sauf pour les confirmations simples où `confirm()` suffit

### Styles
- Tailwind CSS, design mobile-first (max-w-md centré)
- Palette orange (#ea580c) = couleur principale
- Bordures arrondies généreuses (rounded-2xl, rounded-3xl)
- Ombres douces (shadow-sm)
- Mode sombre géré via la classe `dark:` + toggle dans les settings

### Données
- Toute modification passe par `setData()` (pas de mutations directes)
- `storageService.saveData()` est appelée automatiquement à chaque `setData`
- Les IDs sont des UUIDs générés côté client

---

## 15. FAQ Développeur

### ❓ Pourquoi tout est dans App.tsx ?
C'est un défaut architectural connu. L'application a été construite rapidement sans state management externe. **Priorité pour la refactorisation** — idéalement, extraire dans des hooks ou un contexte.

### ❓ Comment ajouter une nouvelle vue ?
1. Créer le composant dans `components/views/`
2. Ajouter l'onglet dans `BottomNav.tsx`
3. Ajouter le `case` dans le switch de `App.tsx`

### ❓ Comment gérer la base de données ?
Il n'y a pas de migrations. `storageService.loadData()` retourne `getDefaultData()` si aucune donnée n'existe. Pour ajouter un champ, il faut :
1. L'ajouter dans `AppData` dans `types.ts`
2. L'initialiser dans `getDefaultData()` dans `storageService.ts`
3. Le rendre optionnel (`?`) pour la rétrocompatibilité

### ❓ Comment tester les notifications push ?
1. Configurer VAPID key dans `.env.local`
2. Déployer la Cloud Function
3. Lancer l'application, autoriser les notifications
4. Déclencher une condition (ex: échéance crédit)

### ❓ L'API Open-Meteo a-t-elle une limite ?
Oui, mais généreuse : ~10 000 appels/jour gratuit, sans clé. La détection saisonnière appelle l'API à chaque chargement de page, avec un cache de 1h.

### ❓ Comment déployer les Cloud Functions ?
```bash
cd functions
npm install
# Retour à la racine
cd ..
firebase deploy --only functions
```

---

## 🚀 Pour commencer rapidement

```bash
# 1. Cloner
git clone -b ameliorations https://github.com/Loowecee6/agripoulet-pro.git

# 2. Installer
npm install

# 3. Configurer .env.local (voir section 13)

# 4. Lancer en développement
npm run dev

# 5. Tests
npx vitest run

# 6. Build
npm run build
```

---

> **Documentation générée le 21 mai 2026** — Pour toute question, ouvrir une issue sur GitHub.
