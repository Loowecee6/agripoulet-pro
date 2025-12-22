
# 🐓 AgriPoulet Pro Cloud

AgriPoulet Pro est une application mobile (PWA) de gestion d'élevage avicole conçue pour fonctionner en temps réel sur plusieurs appareils.

## 🚀 Fonctionnalités

- **Suivi de Production** : Mortalité, consommation d'aliment, suivi de poids (comparaison courbe théorique).
- **Gestion des Stocks** : Inventaire des poulets prêts à la vente.
- **Ventes & Clients** : Gestion des commandes, suivi des crédits et base de données clients.
- **Bilans Financiers** : Calcul automatique de la rentabilité par bande.
- **Cloud Sync** : Synchronisation en temps réel via Google Firebase (infrastructure prête).
- **Sécurité** : Accès Administrateur protégé par code secret, accès Employé libre.

## 📱 Installation sur Mobile (iOS/Android)

Cette application est une **PWA (Progressive Web App)** :
1. Ouvrez l'URL de l'application dans votre navigateur mobile.
2. Appuyez sur **Partager** (iOS) ou sur les **trois points** (Android).
3. Sélectionnez **"Sur l'écran d'accueil"**.

## 🛠️ Configuration Technique

L'application utilise :
- **React 19** & **TypeScript**
- **Tailwind CSS** pour l'interface
- **Lucide React** pour les icônes
- **Recharts** pour les analyses graphiques
- **Firebase Firestore** (optionnel) pour la synchronisation multi-utilisateurs.

## 🔒 Sécurité
Le code admin par défaut est `1234`. Il peut être modifié dans l'onglet **Bilan** une fois connecté en tant qu'administrateur.

---
Développé pour l'écosystème Google Cloud.
