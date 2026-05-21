// Script to explore all data in Firestore
// Usage: npx tsx scripts/explore_firestore.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function exploreFirestore() {
  const auth = getAuth(app);

  // Prompt for credentials
  const email = process.env.FIREBASE_TEST_EMAIL;
  const password = process.env.FIREBASE_TEST_PASSWORD;

  if (!email || !password) {
    console.log('Ajoutez ces variables à .env.local avec vos identifiants:');
    console.log('  FIREBASE_TEST_EMAIL=votre@email.com');
    console.log('  FIREBASE_TEST_PASSWORD=votre_mot_de_passe');
    console.log('\nOu connectez-vous manuellement et vérifiez dans la console Firebase.');
    return;
  }

  console.log(`Connexion avec: ${email}`);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`Connecté! UID: ${cred.user.uid}\n`);
  } catch (e) {
    console.error('Erreur de connexion:', e);
    return;
  }

  console.log('=== Exploration de Firestore ===\n');

  try {
    // Try to list all collections at root level
    // Note: Firestore doesn't have a direct "list all collections" API from client SDK
    // We need to check known paths

    // Check users collection
    console.log('Vérification de la collection "users"...');
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    if (usersSnap.empty) {
      console.log('Aucun document dans "users"');
    } else {
      console.log(`${usersSnap.size} document(s) trouvé(s) dans "users":\n`);
      for (const userDoc of usersSnap.docs) {
        console.log(`  User ID: ${userDoc.id}`);

        // Check subcollection appData
        const appDataRef = doc(db, 'users', userDoc.id, 'appData', 'singleton');
        const appDataSnap = await getDoc(appDataRef);

        if (appDataSnap.exists()) {
          const data = appDataSnap.data();
          console.log(`    → Données appData trouvées:`);
          console.log(`      - Production batches: ${data.productionBatches?.length || 0}`);
          console.log(`      - Stock batches: ${data.stockBatches?.length || 0}`);
          console.log(`      - Clients: ${data.clients?.length || 0}`);
          console.log(`      - Sales: ${data.sales?.length || 0}`);

          if (data.productionBatches?.length > 0) {
            console.log(`      - Bandes:`);
            for (const batch of data.productionBatches) {
              console.log(`        * ${batch.nom} (mise en place: ${batch.dateMisePlace}, poussins: ${batch.nbPoussinsInitial})`);
            }
          }
        } else {
          console.log(`    → Aucune donnée appData`);
        }
        console.log('');
      }
    }

    // Try other common collections
    const collectionsToCheck = ['productionBatches', 'stockBatches', 'clients', 'sales'];
    for (const colName of collectionsToCheck) {
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        console.log(`Collection "${colName}": ${snap.size} document(s)`);
      }
    }

  } catch (error) {
    console.error('Erreur:', error);
  }
}

exploreFirestore();
