// signup_test.ts – Diagnostic complet Firebase + test création de compte
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// Configuration Firebase (identique à firebaseConfig.ts)
const firebaseConfig = {
  apiKey: "AIzaSyD7XQFxRQUpfXdYFaW_Io3-VP_kGx5eqRk",
  authDomain: "agripoulet-pro.firebaseapp.com",
  projectId: "agripoulet-pro",
  storageBucket: "agripoulet-pro.firebasestorage.app",
  messagingSenderId: "874992395752",
  appId: "1:874992395752:web:37d7d6cf351cbc517c705d",
  measurementId: "G-BRRW95TX9D",
};

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  🔍 DIAGNOSTIC FIREBASE – AgriPoulet Pro  ");
  console.log("═══════════════════════════════════════════\n");

  // ── Étape 1 : Initialisation Firebase ──
  console.log("📦 Étape 1 : Initialisation de Firebase...");
  let app;
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    console.log("  ✅ Firebase App initialisé avec succès");
    console.log("  📋 Project ID :", firebaseConfig.projectId);
    console.log("  📋 Auth Domain :", firebaseConfig.authDomain);
  } catch (e: any) {
    console.error("  ❌ Échec initialisation Firebase :", e.message);
    return;
  }

  // ── Étape 2 : Vérification Auth ──
  console.log("\n🔐 Étape 2 : Vérification Firebase Auth...");
  const auth = getAuth(app);
  console.log("  ✅ Instance Auth obtenue");
  console.log("  📋 Auth config :", JSON.stringify(auth.config, null, 2));

  // ── Étape 3 : Test Firestore (écriture/lecture) ──
  console.log("\n📄 Étape 3 : Test Firestore...");
  const db = getFirestore(app);
  try {
    const testDocRef = doc(db, "_diagnostic", "test_" + Date.now());
    await setDoc(testDocRef, { test: true, timestamp: new Date().toISOString() });
    console.log("  ✅ Firestore écriture OK – doc:", testDocRef.id);

    const snap = await getDoc(testDocRef);
    if (snap.exists()) {
      console.log("  ✅ Firestore lecture OK – données:", JSON.stringify(snap.data()));
    } else {
      console.warn("  ⚠️ Document écrit mais non retrouvé");
    }
  } catch (e: any) {
    console.error("  ❌ Firestore erreur :", e.code ?? e.message);
  }

  // ── Étape 4 : Test création de compte ──
  console.log("\n👤 Étape 4 : Test création de compte email/password...");
  const testEmail = `test_${Date.now()}@agripoulet-test.com`;
  const testPassword = "TestPass123!";
  console.log("  📧 Email de test :", testEmail);

  try {
    const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    console.log("  ✅ Compte créé avec succès !");
    console.log("  📋 UID :", userCred.user.uid);
    console.log("  📋 Email :", userCred.user.email);
    console.log("  📋 Créé le :", userCred.user.metadata.creationTime);
  } catch (e: any) {
    console.error("  ❌ Erreur création de compte :", e.code);
    console.error("  📋 Message :", e.message);

    if (e.code === "auth/configuration-not-found") {
      console.error("\n  ╔══════════════════════════════════════════════════════════════╗");
      console.error("  ║  🚨 SOLUTION REQUISE :                                      ║");
      console.error("  ║                                                              ║");
      console.error("  ║  L'authentification Email/Password n'est PAS activée.        ║");
      console.error("  ║                                                              ║");
      console.error("  ║  Allez dans la console Firebase :                            ║");
      console.error("  ║  1. https://console.firebase.google.com/                     ║");
      console.error("  ║  2. Sélectionnez le projet 'agripoulet-pro'                  ║");
      console.error("  ║  3. Menu: Authentication → Sign-in method                    ║");
      console.error("  ║  4. Activez 'Email/Password'                                 ║");
      console.error("  ║  5. Cliquez 'Enregistrer'                                    ║");
      console.error("  ║                                                              ║");
      console.error("  ╚══════════════════════════════════════════════════════════════╝");
    } else if (e.code === "auth/email-already-in-use") {
      console.log("  ℹ️ Ce compte existe déjà — l'Auth fonctionne correctement !");
    } else if (e.code === "auth/network-request-failed") {
      console.error("  ℹ️ Problème réseau — vérifiez votre connexion internet.");
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Diagnostic terminé");
  console.log("═══════════════════════════════════════════");
}

main().catch((e) => console.error("💥 Erreur inattendue:", e));
