// Script pour configurer l'URL du Worker Cloudflare dans Firestore
// Usage: npx tsx scripts/set_push_url.ts
//
// Prérequis : avoir les variables Firebase dans .env.local

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PUSH_WORKER_URL = 'https://agripoulet-push.loowecee6.workers.dev';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setPushUrl() {
  const auth = getAuth(app);
  const email = process.env.FIREBASE_TEST_EMAIL;
  const password = process.env.FIREBASE_TEST_PASSWORD;

  if (!email || !password) {
    console.log('❌ Identifiants manquants. Ajoutez à .env.local :');
    console.log('  FIREBASE_TEST_EMAIL=votre@email.com');
    console.log('  FIREBASE_TEST_PASSWORD=votre_mot_de_passe');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Connecté à Firebase');
  } catch (e) {
    console.error('❌ Erreur de connexion:', e);
    return;
  }

  // Vérifier l'existant
  const fcmRef = doc(db, 'fcm', 'config');
  const existing = await getDoc(fcmRef);
  if (existing.exists()) {
    const data = existing.data();
    console.log('📋 Configuration existante :', {
      pushFunctionUrl: data.pushFunctionUrl || '(aucune)',
      token: data.token ? data.token.substring(0, 20) + '…' : '(aucun)',
    });
  } else {
    console.log('📋 Aucune configuration FCM existante');
  }

  // Écrire la nouvelle URL
  const updateData: Record<string, string> = {
    pushFunctionUrl: PUSH_WORKER_URL,
    updatedAt: new Date().toISOString(),
  };

  // Conserver le token FCM s'il existe
  if (existing.exists() && existing.data().token) {
    updateData.token = existing.data().token;
  }

  await setDoc(fcmRef, updateData, { merge: true });
  console.log(`\n✅ URL du Worker configurée : ${PUSH_WORKER_URL}`);
  if (updateData.token) {
    console.log('   Token FCM conservé ✓');
  }
}

setPushUrl().catch(console.error);
