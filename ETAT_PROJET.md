# AgriPoulet Pro - État du projet

**Dernière mise à jour :** 21 mai 2026
**URL de production :** https://agripoulet-pro.web.app
**Projet Firebase :** agripoulet-pro

---

## ✅ Fonctionnalités implémentées

### Authentification
- Connexion par email/mot de passe (Firebase Auth)
- Rôles : Admin / Employé
- Les données sont isolées par utilisateur (Firestore)

### Production
- Création de bandes (nom, date mise en place, nb poussins, prix/poussin)
- Suivi quotidien : mortalité, consommation (g), quantité aliment (kg), poids moyen, notes
- **Pesée par échantillon** : nb pesés + poids total → moyenne calculée automatiquement
- Saisie du poids moyen direct (alternative à l'échantillon)
- Programme de vaccination pré-configuré (Anti Stress, Gumboro, Newcastle)
- Gestion des dépenses par bande (ajout, modification, suppression)
- **Export XLS des dépenses** (compatible Excel)
- Modification/suppression de chaque entrée (bande, suivi, dépense)
- Clôture de bande → passage à la phase d'abattage/étiquetage

### Abattage & Étiquetage
- Prix au kilo défini par l'utilisateur (variable selon la période)
- Chaque poulet est pesé individuellement et reçoit un code auto (`PR-A001`, `PR-A002`...)
- Prix calculé automatiquement (poids × prix/kg)
- Compteur de poulets étiquetés

### Stock
- Lots de stock (Production interne ou Importation)
- Ajout/modification/suppression de poulets
- Modification du lot (nom, origine, lettre, prix/kg, coût)
- Modification individuelle d'un poulet (numéro, poids, prix)

### Ventes
- Panier de vente par sélection de poulets (code visible)
- Vente au comptant ou à crédit avec échéance
- Facture/reçu détaillé par vente
- Marquer un crédit comme payé
- **Modification d'une vente** (client, total, crédit, échéance, statut)
- **Suppression d'une vente** (poulets remis en stock automatiquement)

### Clients
- CRUD complet (ajout, modification, suppression)
- Recherche par nom ou téléphone

### Rapports & Bilans
- Bilan financier par bande (investi, recettes, bénéfice/perte)
- Compte de résultat détaillé (achat poussins + détail dépenses + total)
- **Export XLS du bilan** et **Export XLS des dépenses**
- Comparaison entre bandes clôturées

### Sauvegarde & Récupération
- **Auto-backup** : sauvegarde automatique quand une bande est ajoutée/supprimée
- **Backup manuel** : bouton "Sauvegarder" dans l'onglet Rapport
- **Restauration** : chaque backup peut être restauré d'un clic
- **Suppression** de backups anciens
- Données synchronisées dans Firestore (cloud)

### Analytiques (panneau 📊 dans Production)
- **Indice de Consommation (IC)** calculé automatiquement
- **Alertes** : mortalité anormale, vaccins en retard
- **Prévision date de vente** (basée sur poids cible 2.5 kg)
- **Poids vs théorique** (écart % par rapport aux références)
- **Comparaison des bandes** (durée, IC, mortalité, poids final, coût)

### Indicateurs de synchronisation
- Icône verte ✅ = données sauvegardées
- Icône rouge ⚠️ = erreur de sauvegarde
- Icône tournante 🔄 = sauvegarde en cours
- Logs console détaillés pour le debug

---

## 🔧 Reste à faire (propositions)

### Ventes
- [ ] **Impression d'étiquettes** avec QR code pour chaque poulet
- [ ] **Réservations** : un client réserve des poulets à l'avance
- [ ] **Historique des prix par client** (voir qui paie combien)

### Général
- [ ] **Dashboard** : vue d'ensemble avec KPIs du jour (poulets vivants, crédits en cours, etc.)
- [ ] **Notifications push** : rappel vaccination, échéance crédit
- [ ] **Statistiques saisonnières** : quels mois sont les plus rentables
- [ ] **Objectifs de production** : définir un poids cible et suivre la progression

---

## 📁 Structure du projet

```
agripoulet-pro/
├── App.tsx                          # Composant principal
├── types.ts                         # Types TypeScript
├── constants.tsx                    # Programme vaccination, poids théoriques
├── firebase.json                    # Config Firebase (hosting + firestore rules)
├── firestore.rules                  # Règles de sécurité Firestore
├── .env.local                       # Variables d'environnement Firebase
├── services/
│   ├── firebaseConfig.ts            # Initialisation Firebase
│   └── storageService.ts            # CRUD Firestore + backups
├── components/
│   ├── common/
│   │   ├── AuthProvider.tsx         # Context d'authentification
│   │   ├── LoginScreen.tsx          # Écran de connexion
│   │   ├── Header.tsx               # En-tête avec sync indicator
│   │   ├── BottomNav.tsx            # Navigation inférieure
│   │   ├── Modal.tsx                # Modal réutilisable
│   │   ├── SearchBar.tsx            # Barre de recherche
│   │   ├── QuickAddGrid.tsx         # Grille d'ajout rapide (prix)
│   │   ├── ToastContext.tsx         # Notifications toast
│   │   ├── DataMigration.tsx        # Migration localStorage → Firestore
│   │   ├── BackupManager.tsx        # Gestion des sauvegardes
│   │   └── BatchAnalytics.tsx       # Analytiques de production
│   └── views/
│       ├── ProductionView.tsx       # Gestion des bandes
│       ├── StockView.tsx            # Gestion du stock
│       ├── VentesView.tsx           # Gestion des ventes
│       ├── ClientsView.tsx          # Gestion des clients
│       └── RapportView.tsx          # Bilans et rapports
├── utils/
│   └── exportXLS.ts                 # Export vers Excel (CSV)
└── scripts/
    └── explore_firestore.ts         # Script d'exploration Firestore
```

---

## 🚀 Déploiement

```bash
# Build
npm run build

# Déployer hosting + rules
firebase deploy --only "hosting,firestore:rules"

# Déployer uniquement hosting
firebase deploy --only hosting

# Déployer uniquement les règles
firebase deploy --only firestore:rules
```

---

## 🔑 Comptes & Accès

- **Ancien système** : admin / 1234 (sans email, données locales perdues)
- **Nouveau système** : authentification Firebase par email/mot de passe
- Les données sont stockées dans Firestore sous `users/{uid}/appData/singleton`
- Les backups sont dans `users/{uid}/backups`
