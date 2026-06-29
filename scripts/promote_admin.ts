import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
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
  
  // Try multiple password variants
  const passwords = [
    process.env.FIREBASE_TEST_PASSWORD,
    'W0rk4M0ney@2026',
    'W0rk4M0ney',
  ].filter(Boolean);

  let cred = null;
  for (const pw of passwords) {
    try {
      console.log(`Essai avec mot de passe: ${pw.substring(0, 3)}***`);
      cred = await signInWithEmailAndPassword(auth, 'loowecee6@gmail.com', pw);
      console.log(`Connecté! UID: ${cred.user.uid}`);
      break;
    } catch (e: any) {
      console.log(`  → Échec: ${e.code}`);
    }
  }

  if (!cred) {
    console.log('\nAucun mot de passe fonctionne.');
    console.log('Essayons de lire le document utilisateur sans auth...');
    
    // Try direct Firestore access (will likely fail due to rules)
    try {
      const userDoc = await getDoc(doc(db, 'users', 'test'));
      console.log('Test doc exists:', userDoc.exists());
    } catch (e: any) {
      console.log('Fire rules bloquent:', e.message?.substring(0, 100));
    }
    return;
  }

  const uid = cred.user.uid;
  console.log(`\nVérification du rôle pour UID: ${uid}`);
  
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    const data = snap.data();
    console.log(`Rôle actuel: ${data.role}`);
    
    if (data.role !== 'admin' && data.role !== 'super_admin') {
      console.log('Promotion vers admin...');
      await setDoc(userRef, { role: 'admin', updatedAt: new Date() }, { merge: true });
      console.log('✅ Rôle mis à jour vers admin!');
      
      // Verify
      const verify = await getDoc(userRef);
      console.log(`Vérification: rôle = ${verify.data()?.role}`);
    } else {
      console.log('✅ Déjà admin!');
    }
  } else {
    console.log('Document utilisateur introuvable, création...');
    await setDoc(userRef, {
      role: 'admin',
      email: 'loowecee6@gmail.com',
      displayName: '',
      createdAt: new Date(),
    });
    console.log('✅ Document créé avec rôle admin!');
  }
}

main().catch(e => console.error('Erreur:', e));
