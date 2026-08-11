import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// firebase v11 does not re-export getReactNativePersistence from its typed
// entrypoint, so this is the only way to reach it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require("firebase/auth");

const REQUIRED_CONFIG = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(REQUIRED_CONFIG)
    .filter(([, value]) => !value)
    .map(([key]) => key);

// Without this the app boots and then fails deep inside an unrelated screen
// with an opaque Firebase error — most often on an EAS build where the
// EXPO_PUBLIC_* vars were never added to the build environment.
if (missing.length > 0) {
    throw new Error(
        `Firebase config is incomplete — missing ${missing.join(", ")}. ` +
            `Check that every EXPO_PUBLIC_FIREBASE_* variable is set (see .env.example).`,
    );
}

const firebaseConfig = {
    ...REQUIRED_CONFIG,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;
try {
    auth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
} catch (error) {
    // initializeAuth throws if it has already run for this app (Fast Refresh,
    // duplicate import). Anything else means persistence is genuinely
    // unavailable and sessions will not survive a restart, so say so.
    const alreadyInitialized =
        error instanceof Error && error.message.includes("already-initialized");
    if (!alreadyInitialized) {
        console.error(
            "Firebase auth persistence unavailable; sign-in will not survive an app restart:",
            error,
        );
    }
    auth = getAuth(firebaseApp);
}

export const db = getFirestore(firebaseApp);

export { auth };
