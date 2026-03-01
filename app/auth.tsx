import React from "react";
import { useRouter, Stack } from "expo-router";
import AuthPageUI from "../components/ui/auth-page-ui";

export default function AuthScreen() {
    const router = useRouter();

    const handleGooglePress = () => {
        router.replace("/(tabs)");
    };

    return (
        <>
            <AuthPageUI onPressGoogle={handleGooglePress} />
            <Stack.Screen options={{ headerShown: false }} />
        </>
    );
}