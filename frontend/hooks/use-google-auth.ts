import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
    AuthError,
    googleAuthConfig,
    handleGoogleAuthResponse,
    signOut,
    subscribeToAuthState,
} from "../auth/google-auth";
import { getErrorMessage } from "@/utils/errors";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<AuthError | null>(null);

    const redirectUri = Platform.select({
        ios: makeRedirectUri({
            native: `com.googleusercontent.apps.${googleAuthConfig.iosClientId.split(".apps.")[0]}:/`,
        }),
        android: makeRedirectUri({
            native: `com.googleusercontent.apps.${googleAuthConfig.androidClientId.split(".apps.")[0]}:/`,
        }),
        default: makeRedirectUri(),
    });

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: googleAuthConfig.webClientId,
        androidClientId: googleAuthConfig.androidClientId,
        iosClientId: googleAuthConfig.iosClientId,
        scopes: googleAuthConfig.scopes,
        redirectUri,
    });

    // listen to auth state
    useEffect(() => {
        const unsubscribe = subscribeToAuthState((firebaseUser) => {
            setUser(firebaseUser);
            setInitializing(false);
        });

        return () => unsubscribe();
    }, []);

    // handle OAuth response
    useEffect(() => {
        if (!response) {
            return;
        }

        (async () => {
            setLoading(true);
            setError(null);
            try {
                await handleGoogleAuthResponse(response);
            } catch (err) {
                setError(
                    err instanceof AuthError
                        ? err
                        : new AuthError("UNKNOWN", getErrorMessage(err)),
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [response]);

    // sign in
    const promptSignIn = useCallback(async () => {
        if (!request) {
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await promptAsync();
        } catch (err) {
            setError(new AuthError("UNKNOWN", getErrorMessage(err)));
        } finally {
            setLoading(false);
        }
    }, [request, promptAsync]);

    // sign out
    const handleSignOut = useCallback(async () => {
        setLoading(true);
        try {
            await signOut();
            setUser(null);
            setError(null);
        } catch (err) {
            setError(toAuthError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        user,
        loading,
        initializing,
        error,
        promptSignIn,
        handleSignOut,
        isReady: !!request,
    };
}

function toAuthError(error: unknown): AuthError {
    if (error instanceof AuthError) return error;

    const code =
        typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
    if (code === "auth/network-request-failed") {
        return new AuthError(
            "NETWORK",
            "No internet connection. Please try again.",
        );
    }
    if (code === "auth/user-token-expired") {
        return new AuthError(
            "SESSION_EXPIRED",
            "Your session has expired. Please sign in again.",
        );
    }
    return new AuthError("UNKNOWN", getErrorMessage(error));
}
