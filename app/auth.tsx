import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { getValidAccessToken } from "../auth/google-auth";
import AuthPageUI from "../components/ui/auth-page-ui";

export default function AuthScreen() {
    const router = useRouter();
    const { user, loading, initializing, promptSignIn, isReady } = useGoogleAuth();

    useEffect(() => {
        if (user) {
            router.replace("/(tabs)");
            getValidAccessToken().then((accessToken) => {
                console.log("Access token on auth screen:", accessToken);
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