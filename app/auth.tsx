import React, { useEffect } from "react";
import { Alert } from "react-native";
import AuthPageUI from "../components/ui/auth-page-ui";
import { useGoogleAuth } from "../hooks/use-google-auth";

export default function AuthScreen() {
    const { promptSignIn, loading, error, isReady } = useGoogleAuth();

    useEffect(() => {
        if (!error) {
            return;
        }
        if (error.code === "CANCELLED" || error.code === "DISMISSED") {
            return;
        }
        Alert.alert("sign in failed nooooo", error.message);
    }, [error]);

    return (
        <AuthPageUI
            onPressGoogle={promptSignIn}
            isLoading={loading || !isReady}
        />
    );
}
