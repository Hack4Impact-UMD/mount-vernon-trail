import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import AuthPageUI from "../components/ui/auth-page-ui";
import { useGoogleAuth } from "../hooks/use-google-auth";

function getErrorMessage(code: string): string {
    switch (code) {
        case "CANCELLED":
        case "DISMISSED":
            return "Sign-in Cancelled";
        default:
            return "Something went wrong";
    }
}

export default function AuthScreen() {
    const router = useRouter();
    const { promptSignIn, loading, error, isReady, user } = useGoogleAuth();

    useEffect(() => {
        if (user) {
            router.replace("/home-screen");
        }
    }, [user]);

    const errorMessage = error ? getErrorMessage(error.code) : undefined;

    return (
        <AuthPageUI
            onPressGoogle={promptSignIn}
            isLoading={loading || !isReady}
            errorMessage={errorMessage}
        />
    );
}
