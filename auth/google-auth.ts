import {
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    User,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { deleteTokens, getStoredTokens, storeTokens } from "./token-storage";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_ANDROID_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

export const googleAuthConfig = {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: [
        "openid",
        "profile",
        "email",
        "https://www.googleapis.com/auth/photoslibrary.readonly",
    ],
};

export interface AuthResult {
    user: User;
    accessToken: string;
}

// AuthError
export class AuthError extends Error {
    code: String;
    constructor(code: String, message: String) {
        super(message.toString());
        this.code = code;
        this.name = "AuthError";
    }
}

// handle Auth response
export async function handleGoogleAuthResponse(
    response: any,
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
        const credential = GoogleAuthProvider.credential(
            authentication.idToken,
            authentication.accessToken,
        );
        const userCredential = await signInWithCredential(auth, credential);
        await storeTokens(
            authentication.accessToken,
            authentication.refreshToken,
            authentication.expiresIn,
        );

        return {
            user: userCredential.user,
            accessToken: authentication.accessToken,
        };
    } catch (error: any) {
        throw new AuthError(
            "SIGN_IN_FAILED",
            error.message ?? "sign in failed",
        );
    }
}

// token refresh
export async function refreshAccessToken(): Promise<string> {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) {
        throw new AuthError(
            "TOKEN_REFRESH_FAILED",
            "no refresh token available",
        );
    }

    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: GOOGLE_WEB_CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }).toString(),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`token refresh failed: ${res.body}: ${err}`);
        }

        const data = await res.json();
        await storeTokens(data.access_token, null, data.expires_in);
        return data.access_token;
    } catch (error: any) {
        throw new AuthError(
            "TOKEN_REFRESH_FAILED",
            error.message ?? "failed to refresh token",
        );
    }
}

// get access token
export async function getValidAccessToken(): Promise<string> {
    const { accessToken, tokenExpiry } = await getStoredTokens();

    // 5 minute buffer
    if (
        accessToken &&
        tokenExpiry &&
        Date.now() < tokenExpiry - 5 * 60 * 1000
    ) {
        return accessToken;
    } else {
        return refreshAccessToken();
    }
}

// sign out
export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
    await deleteTokens();
}

// listen for auth state change
export function subscribeToAuthState(
    callback: (user: User | null) => void,
): () => void {
    const unsubscribe = onAuthStateChanged(auth, callback);
    return () => unsubscribe();
}
