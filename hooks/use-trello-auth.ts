import { useCallback, useEffect, useState } from "react";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
    clearTrelloToken,
    getTrelloToken,
    saveTrelloToken,
} from "../auth/trello-token-storage";
import { TrelloAuthError } from "../services/trello-auth-error";

WebBrowser.maybeCompleteAuthSession();

const discovery = {
    authorizationEndpoint: "https://trello.com/1/authorize",
};

// better for security reasonsto have 30days as an expiration
const TOKEN_EXPIRATION = "30days";
const TOKEN_EXPIRATION_DAYS = 30; // must match TOKEN_EXPIRATION

// hook for trello oauth lifecycle
// sign in, sign out, token restoration, and handling auth failures
export function useTrelloAuth() {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<TrelloAuthError | null>(null);

    const redirectUri = makeRedirectUri({ scheme: "mount-vernon-trail" });

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "",
            redirectUri,
            responseType: "token",
            scopes: ["read", "write"],
            extraParams: {
                name: "Mount Vernon Trail",
                expiration: TOKEN_EXPIRATION,
            },
        },
        discovery,
    );

    // Restore token from secure storage on mount
    useEffect(() => {
        (async () => {
            try {
                const stored = await getTrelloToken();
                if (stored) {
                    setToken(stored);
                }
            } catch (err) {
                console.error("Failed to restore Trello token:", err);
            } finally {
                setInitializing(false);
            }
        })();
    }, []);

    // Handle auth response when user returns from Trello
    useEffect(() => {
        if (!response) return;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                if (response.type === "success") {
                    // Trello returns the token as `token` in the fragment but expo-auth-session may parse it as `access_token`
                    const accessToken =
                        response.params?.token ??
                        response.params?.access_token;
                    if (accessToken) {
                        await saveTrelloToken(accessToken, TOKEN_EXPIRATION_DAYS);
                        setToken(accessToken);
                    } else {
                        setError(new TrelloAuthError("AUTH_FAILED"));
                    }
                } else if (
                    response.type === "dismiss" ||
                    response.type === "cancel"
                ) {
                    setError(new TrelloAuthError("AUTH_CANCELLED"));
                } else if (response.type === "error") {
                    setError(new TrelloAuthError("AUTH_FAILED"));
                }
            } catch (err) {
                if (err instanceof TrelloAuthError) {
                    setError(err);
                } else {
                    setError(
                        new TrelloAuthError(
                            "AUTH_FAILED",
                            (err as Error).message,
                        ),
                    );
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [response]);

    // Prompt the Trello consent screen
    const promptSignIn = useCallback(async () => {
        if (!request) return;
        setError(null);
        setLoading(true);
        try {
            await promptAsync();
        } catch (err) {
            setError(
                new TrelloAuthError("AUTH_FAILED", (err as Error).message),
            );
        } finally {
            setLoading(false);
        }
    }, [request, promptAsync]);

    // Clear stored token and state on sign out
    const handleSignOut = useCallback(async () => {
        setLoading(true);
        try {
            await clearTrelloToken();
            setToken(null);
            setError(null);
        } catch (err) {
            console.error("Failed to clear Trello token:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // when Trello auth failures are detected by the client
    const handleAuthFailure = useCallback(async (authError: TrelloAuthError) => {
        setToken(null);
        setError(authError);
        await clearTrelloToken();
    }, []);

    return {
        token,
        isAuthenticated: token !== null,
        loading,
        initializing,
        error,
        promptSignIn,
        handleSignOut,
        handleAuthFailure,
        isReady: !!request,
    };
}