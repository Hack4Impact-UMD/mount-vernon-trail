import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Configuration values should come from environment variables or secure storage.
// You'll need to register a Firebase project and obtain these values.
const firebaseConfig = {
  apiKey: process.env.EXPO_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_FIREBASE_APP_ID || "",
};

// initialize app/exports so other modules can import
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
