// Firebase configuration and initialization for AgriPoulet Pro
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase project credentials (keep them secure in production)
const firebaseConfig = {
  apiKey: "AIzaSyD7XQFxRQUpfXdYFaW_Io3-VP_kGx5eqRk",
  authDomain: "agripoulet-pro.firebaseapp.com",
  projectId: "agripoulet-pro",
  storageBucket: "agripoulet-pro.firebasestorage.app",
  messagingSenderId: "874992395752",
  appId: "1:874992395752:web:37d7d6cf351cbc517c705d",
  measurementId: "G-BRRW95TX9D"
};

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore and export it for use in services
export const db = getFirestore(firebaseApp);

// Initialize Auth and export it
export const auth = getAuth(firebaseApp);

export default firebaseApp;
