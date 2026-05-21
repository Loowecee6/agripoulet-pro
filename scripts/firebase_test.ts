// firebase_test.ts
// Simple verification script for Firebase configuration, Auth, Firestore, and Storage (if used)
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import firebaseConfig from "../services/firebaseConfig";

async function main() {
  console.log("Initializing Firebase...");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Auth test (anonymous sign‑in)
  try {
    const userCred = await signInAnonymously(auth);
    console.log("✅ Auth: Anonymous sign‑in succeeded, uid=", userCred.user.uid);
  } catch (e) {
    console.error("❌ Auth error:", e);
    return;
  }

  // Firestore test – add a document
  try {
    const testCol = collection(db, "firebase_test_demo");
    const docRef = await addDoc(testCol, { test: true, ts: Date.now() });
    console.log("✅ Firestore: Document added with id", docRef.id);
    const snapshot = await getDocs(testCol);
    console.log("✅ Firestore: Retrieved", snapshot.size, "documents in collection.");
  } catch (e) {
    console.error("❌ Firestore error:", e);
    return;
  }

  // Storage test – upload a tiny text blob (if storage bucket exists)
  try {
    const blob = new Blob(["Firebase test file"], { type: "text/plain" });
    const storageRef = ref(storage, "firebase_test_demo.txt");
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    console.log("✅ Storage: File uploaded, download URL:", url);
  } catch (e) {
    console.warn("⚠️ Storage test skipped or failed:", e);
  }
}

main().then(() => console.log("✅ Firebase verification script completed."))
  .catch((e) => console.error("❌ Unexpected error", e));
