import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
    AuthError,
    getValidAccessToken,
    googleAuthConfig,
    handleGoogleAuthResponse,
    signOut,
    subscribeToAuthState,
} from "../auth/google-auth";

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
                if (err instanceof AuthError) {
                    setError(err);
                } else {
                    setError(new AuthError("UNKNOWN", (err as Error).message));
                }
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
            setError(new AuthError("UNKNOWN", (err as Error).message));
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
            if (err instanceof AuthError) {
                setError(err);
            } else {
                const code = (err as any)?.code as string | undefined;
                if (code === "auth/network-request-failed") {
                    setError(
                        new AuthError(
                            "NETWORK",
                            "No internet connection. Please try again.",
                        ),
                    );
                } else if (code === "auth/user-token-expired") {
                    setError(
                        new AuthError(
                            "SESSION_EXPIRED",
                            "Your session has expired. Please sign in again.",
                        ),
                    );
                } else {
                    setError(new AuthError("UNKNOWN", (err as Error).message));
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // getter for access token
    const getAccessToken = useCallback(async () => {
        return getValidAccessToken();
    }, []);

    return {
        user,
        loading,
        initializing,
        error,
        promptSignIn,
        handleSignOut,
        getAccessToken,
        isReady: !!request,
    };
}
