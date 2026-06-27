// Script to fix stock quantity in Firestore
// Usage: FIREBASE_EMAIL=xxx FIREBASE_PASSWORD=xxx npx tsx scripts/fix_stock.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const FIXED_QUANTITE = 17;

const firebaseConfig = {
  apiKey: 'AIzaSyD7XQFxRQUpfXdYFaW_Io3-VP_kGx5eqRk',
  authDomain: 'agripoulet-pro.firebaseapp.com',
  projectId: 'agripoulet-pro',
  storageBucket: 'agripoulet-pro.firebasestorage.app',
  messagingSenderId: '874992395752',
  appId: '1:874992395752:web:37d7d6cf351cbc517c705d',
  measurementId: 'G-BRRW95TX9D',
};

async function fixStock() {
  const email = process.env.FIREBASE_EMAIL;
  const password = process.env.FIREBASE_PASSWORD;

  if (!email || !password) {
    console.error('Erreur : définissez les variables FIREBASE_EMAIL et FIREBASE_PASSWORD');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Connexion
  console.log(`Connexion avec ${email}...`);
  await signInWithEmailAndPassword(auth, email, password);
  console.log('✅ Connecté !\n');

  // Explorer les lots de stock
  console.log('=== Exploration des lots de stock ===\n');
  const stockRef = collection(db, 'stockBatches');
  const snap = await getDocs(stockRef);

  if (snap.empty) {
    console.log('❌ Aucun lot de stock trouvé dans Firestore.');
    process.exit(1);
  }

  console.log(`${snap.size} lot(s) trouvé(s) :\n`);

  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(`  📦 Lot: ${data.nom || 'Sans nom'} (ID: ${doc.id})`);
    console.log(`     Type: ${data.typeOrigine}, Lettre: ${data.lettre}`);
    console.log(`     Quantité actuelle: ${data.quantite ?? 'N/A'}`);
    console.log(`     Poulets individuels: ${data.poulets?.length || 0}`);
    console.log(`     Prix/kg: ${data.prixKg} F`);
    console.log('');
  }

  // Trouver le lot avec quantite > 0 (le lot groupé)
  const targetDoc = snap.docs.find(d => d.data().quantite && d.data().quantite > 0);

  if (!targetDoc) {
    console.log('❌ Aucun lot groupé (avec quantite > 0) trouvé.');
    console.log('   Le stock pourrait être géré via des poulets individuels.');
    process.exit(1);
  }

  const currentQte = targetDoc.data().quantite;
  console.log(`\n=== Lot ciblé : "${targetDoc.data().nom}" ===`);
  console.log(`   Quantité actuelle : ${currentQte}`);
  console.log(`   Nouvelle quantité : ${FIXED_QUANTITE}`);
  console.log(`   Différence : ${currentQte} → ${FIXED_QUANTITE} (ajout de ${FIXED_QUANTITE - currentQte})\n`);

  // Mise à jour
  console.log('Mise à jour en cours...');
  await updateDoc(doc(db, 'stockBatches', targetDoc.id), {
    quantite: FIXED_QUANTITE,
  });
  console.log(`✅ Stock mis à jour ! La quantité passe de ${currentQte} à ${FIXED_QUANTITE}.`);

  // Vérification
  console.log('\n=== Vérification ===');
  const verifySnap = await getDocs(stockRef);
  for (const d of verifySnap.docs) {
    console.log(`   ${d.data().nom}: quantite = ${d.data().quantite}`);
  }
}

fixStock().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
