import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { User } from "firebase/auth";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { subscribeToAuthState } from "@/auth/google-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
    anchor: "(tabs)",
};

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const router = useRouter();
    const segments = useSegments();
    // undefined = not yet initialized
    // null = not signed in
    // User = signed in
    const [user, setUser] = useState<User | null | undefined>(undefined);

    // whenever auth state changes, user is updated
    useEffect(() => {
        const unsubscribe = subscribeToAuthState((firebaseUser) => {
            setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user === undefined) return;
        const inTabs = segments[0] === "(tabs)";
        const onAuth = segments[0] === "auth";
        if (user && !inTabs) {
            router.replace("/(tabs)");
        } else if (!user && !onAuth) {
            router.replace("/auth");
        }
    }, [user, segments]);

    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen
                    name="auth"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="modal"
                    options={{ presentation: "modal", title: "Modal" }}
                />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
