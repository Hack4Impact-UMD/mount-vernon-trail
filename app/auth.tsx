import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { getValidAccessToken } from "../auth/google-auth";
import AuthPageUI from "../components/ui/auth-page-ui";
import { testFunctionality } from "../scripts/test-api";

export default function AuthScreen() {
    const router = useRouter();
    const { user, loading, initializing, promptSignIn, isReady } = useGoogleAuth();

    useEffect(() => {
        if (user) {
            console.log("User authenticated, navigating to main app...");
            router.replace("/(tabs)");
            getValidAccessToken().then((accessToken) => {
                if (!accessToken) {
                    console.error("No access token available after authentication");
                    return;
                }
                console.log("Access token on auth screen:", accessToken);
                testFunctionality(accessToken, 20).catch((err) => {
                    console.error("Error testing functionality:", err);
                });
            });
        }
    }, [user, router]);
    
    const handleGooglePress = () => {
        if (!isReady || loading) {
            return;
        }
        promptSignIn();
    }

    return (
        <AuthPageUI onPressGoogle={handleGooglePress} isLoading={loading || initializing} />
    );
}