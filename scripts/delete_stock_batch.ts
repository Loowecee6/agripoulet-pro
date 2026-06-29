import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
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

async function main() {
  const auth = getAuth(app);
  const email = process.env.FIREBASE_TEST_EMAIL;
  const password = process.env.FIREBASE_TEST_PASSWORD;

  if (!email || !password) {
    console.log('Ajoutez FIREBASE_TEST_EMAIL et FIREBASE_TEST_PASSWORD à .env.local');
    return;
  }

  console.log(`Connexion avec ${email}...`);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Connecté! UID: ${cred.user.uid}\n`);

  const snap = await getDocs(collection(db, 'stockBatches'));
  console.log(`=== ${snap.docs.length} lots de stock trouvés ===\n`);

  for (const d of snap.docs) {
    const data = d.data();
    const count = data.poulets?.length || 0;
    console.log(`ID: ${d.id}`);
    console.log(`  Nom: ${data.nom}`);
    console.log(`  Poulets: ${count}`);
    console.log(`  TypeOrigine: ${data.typeOrigine}`);
    console.log('');
  }

  // Trouver le lot avec 88 poulets (ou le plus proche)
  const target = snap.docs.find(d => {
    const data = d.data();
    const count = data.poulets?.length || 0;
    return count === 88 || (data.nom && data.nom.includes('88'));
  });

  if (target) {
    console.log(`\n>>> Suppression du lot "${target.data().nom}" (ID: ${target.id}, ${target.data().poulets?.length || 0} poulets)...`);
    await deleteDoc(doc(db, 'stockBatches', target.id));
    console.log('>>> Supprimé avec succès!');
  } else {
    console.log('\nAucun lot avec 88 poulets trouvé. Lot(s) disponible(s):');
    for (const d of snap.docs) {
      console.log(`  - ${d.data().nom} (${d.data().poulets?.length || 0} poulets)`);
    }
  }
}

main().catch(e => console.error('Erreur:', e));
