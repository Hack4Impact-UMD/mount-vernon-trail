import React, { useState, useCallback } from "react";
import { useRouter, Stack } from "expo-router";
import AuthPageUI from "../components/ui/auth-page-ui";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
        scopes: [
            "openid",
            "profile",
            "email",
            "https://www.googleapis.com/auth/photoslibrary.readonly",
        ],
        redirectUri: makeRedirectUri({
            scheme: "mount-vernon-trail"
        }),
    });
    
    const handleSuccess = useCallback (async (accessToken: string) => {
        try {
            router.replace("/(tabs)");
        } catch (e: any) {
            setError(e.message ?? "sign in failed");
        } finally {
            setLoading(false);
        }
    }, [router]);
    
    React.useEffect(() => {
        if (!response) return;

        if (response.type === "success") {
            const accessToken = response.authentication?.accessToken;
        if (accessToken) {
            handleSuccess(accessToken);
        } else {
            setError("no access token");
            setLoading(false);
        }
        } else if (response.type === "error") {
            setError(response.error?.message ?? "unknown error");
            setLoading(false);
        } else if (response.type === "cancel" || response.type === "dismiss") {
            setLoading(false);
        }
    }, [response, handleSuccess]);
    
    const handleGooglePress = async () => {
        setError(null);
        setLoading(true);
        await promptAsync();
    };
    
    return (
    <>
        <AuthPageUI
            onPressGoogle={handleGooglePress}
            isLoading={loading}
        />
        <Stack.Screen options={{ headerShown: false }} />
    </>
    );
}