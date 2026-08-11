import {
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    User,
} from "firebase/auth";
import { auth } from "../config/firebase";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_ANDROID_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

// Identity only. Google Photos is reached through the backend proxy using the
// MVT account's own credentials, and the Sheets integration was removed, so the
// app no longer needs photoslibrary.* or spreadsheets access from volunteers.
export const googleAuthConfig = {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
};

export type AuthResult = {
    user: User;
    accessToken: string;
};

export class AuthError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message.toString());
        this.code = code;
        this.name = "AuthError";
    }
}

// Structurally matches expo-auth-session's AuthSessionResult union without
// depending on it, so this module stays testable without the Expo runtime.
type GoogleAuthResponse = {
    type: string;
    error?: { message?: string } | null;
    authentication?: {
        accessToken?: string | null;
        idToken?: string | null;
    } | null;
};

export async function handleGoogleAuthResponse(
    response: GoogleAuthResponse | null,
): Promise<AuthResult | null> {
    if (!response) {
        return null;
    }
    switch (response.type) {
        case "cancel":
            throw new AuthError("CANCELLED", "user cancelled");
        case "dismiss":
            throw new AuthError("DISMISSED", "user dismissed");
        case "error":
            throw new AuthError(
                "UNKNOWN",
                response.error?.message ?? "unknown error",
            );
        case "success":
            break;
        default:
            return null;
    }

    const { authentication } = response;
    if (!authentication?.accessToken) {
        throw new AuthError("NO_ACCESS_TOKEN", "no access token received");
    }

    try {
        // The Google token is only ever used to mint the Firebase credential.
        // Nothing else in the app needs it, so it is never persisted — which is
        // what removed the whole SecureStore/localStorage token layer.
        const credential = GoogleAuthProvider.credential(
            authentication.idToken,
            authentication.accessToken,
        );
        const userCredential = await signInWithCredential(auth, credential);

        return {
            user: userCredential.user,
            accessToken: authentication.accessToken,
        };
    } catch (error) {
        throw new AuthError(
            "SIGN_IN_FAILED",
            error instanceof Error ? error.message : "sign in failed",
        );
    }
}

export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
}

export function subscribeToAuthState(
    callback: (user: User | null) => void,
): () => void {
    return onAuthStateChanged(auth, callback);
}
