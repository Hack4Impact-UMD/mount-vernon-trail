import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
    clearTrelloToken,
    getTrelloToken,
    saveTrelloToken,
} from "../auth/trello-token-storage";
import { TrelloAuthError } from "../services/trello-auth-error";

WebBrowser.maybeCompleteAuthSession();

// better for security reasons to have 30days as an expiration
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
    // Restore token from secure storage on mount
    useEffect(() => {
        (async () => {
            try {
                const stored = await getTrelloToken();
                if (stored) {
                    setToken(stored);
                }
            } catch (err) {
                if (err instanceof TrelloAuthError) {
                    setError(err);
                } else {
                    console.error("Failed to restore Trello token:", err);
                }
            } finally {
                setInitializing(false);
            }
        })();
    }, []);

    // prompt the Trello consent screen
    const promptSignIn = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";
            const authUri =
                `https://trello.com/1/authorize?` +
                `key=${API_KEY}` +
                `&name=${encodeURIComponent("Mount Vernon Trail")}` +
                `&expiration=${TOKEN_EXPIRATION}` +
                `&response_type=token` +
                `&scope=read,write` +
                `&return_url=${encodeURIComponent(redirectUri)}` +
                `&callback_method=fragment`;

            const result = await WebBrowser.openAuthSessionAsync(
                authUri,
                redirectUri,
            );
            // parse token from callback url is successful
            if (result.type === "success" && result.url) {
                // scheme://path#token=TOKEN_VALUE
                const match = /token=([^&]+)/.exec(result.url);
                const accessToken = match ? match[1] : null;
                if (accessToken) {
                    await saveTrelloToken(accessToken, TOKEN_EXPIRATION_DAYS);
                    setToken(accessToken);
                } else {
                    setError(
                        new TrelloAuthError(
                            "AUTH_FAILED",
                            "No token found in callback URL.",
                        ),
                    );
                }
            } else if (result.type === "dismiss" || result.type === "cancel") {
                setError(new TrelloAuthError("AUTH_CANCELLED"));
            } else {
                setError(
                    new TrelloAuthError(
                        "AUTH_FAILED",
                        "Authentication session failed or was aborted.",
                    ),
                );
            }
        } catch (err) {
            setError(
                new TrelloAuthError("AUTH_FAILED", (err as Error).message),
            );
        } finally {
            setLoading(false);
        }
    }, [redirectUri]);

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

    return {
        token,
        isAuthenticated: token !== null,
        loading,
        initializing,
        error,
        promptSignIn,
        handleSignOut,
    };
}
