import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBgKjYI1imoWpWhyfqYIKwhGYN77_1i9qI",
  authDomain: "inside-edge-51a39.firebaseapp.com",
  projectId: "inside-edge-51a39",
  storageBucket: "inside-edge-51a39.firebasestorage.app",
  messagingSenderId: "1063989581858",
  appId: "1:1063989581858:web:a4c4aa76604a1a7411927b",
  measurementId: "G-JJVT2PH412"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export default app;
