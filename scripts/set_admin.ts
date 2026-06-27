/**
 * Script pour attribuer un rôle Firestore à un utilisateur par email
 * Usage: npx tsx scripts/set_admin.ts <email> <role>
 * Exemple: npx tsx scripts/set_admin.ts loowecee6@gmail.com admin
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setRoleByEmail(targetEmail: string, role: string) {
  console.log(`🔍 Recherche de ${targetEmail}...`);

  const snap = await getDocs(collection(db, 'users'));
  let found = false;

  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    if (data.email?.toLowerCase() === targetEmail.toLowerCase()) {
      await setDoc(userDoc.ref, { role, updatedAt: serverTimestamp() }, { merge: true });
      console.log(`✅ Rôle "${role}" attribué à ${targetEmail} (UID: ${userDoc.id})`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(`⚠️ Aucun document trouvé pour ${targetEmail}`);
    console.log('💡 L\'utilisateur doit d\'abord se connecter une fois.');
    console.log('📝 Le code dans userService.ts attribuera auto le rôle admin à la prochaine connexion.');
  }

  process.exit(0);
}

const targetEmail = process.argv[2] || 'loowecee6@gmail.com';
const role = process.argv[3] || 'admin';
setRoleByEmail(targetEmail, role);
