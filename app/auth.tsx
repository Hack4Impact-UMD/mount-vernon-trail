import React from "react";
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
    const { promptSignIn, loading, error, isReady } = useGoogleAuth();

    const errorMessage = error ? getErrorMessage(error.code) : undefined;

    return (
        <AuthPageUI
            onPressGoogle={promptSignIn}
            isLoading={loading || !isReady}
            errorMessage={errorMessage}
        />
    );
}
