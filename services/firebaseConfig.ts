// Firebase configuration and initialization for AgriPoulet Pro
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Clé VAPID pour FCM Web Push.
 * Obtenez-la dans Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
 * Ajoutez VITE_FIREBASE_VAPID_KEY=votre_cle dans le fichier .env.local
 */
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore and export it for use in services
export const db = getFirestore(firebaseApp);

// Initialize Auth and export it
export const auth = getAuth(firebaseApp);

export default firebaseApp;
