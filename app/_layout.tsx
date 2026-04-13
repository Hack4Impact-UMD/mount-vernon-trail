import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import "react-native-reanimated";

import { subscribeToAuthState } from "@/auth/google-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getActiveEvent } from "@/services/event-service";

import {
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    useFonts,
} from "@expo-google-fonts/lato";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const router = useRouter();
    const segments = useSegments();
    // undefined = not yet initialized
    // null = not signed in
    // User = signed in
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [isEligibleActiveEvent, setIsEligibleActiveEvent] = useState(false);
    const [fontsLoaded] = useFonts({
        Lato_300Light,
        Lato_400Regular,
        Lato_700Bold,
    });
    // whenever auth state changes, user is updated
    useEffect(() => {
        const unsubscribe = subscribeToAuthState((firebaseUser) => {
            setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, []);

    // check eligibility for active event whenever user changes
    useEffect(() => {
        if (!user) {
            setIsEligibleActiveEvent(false);
            return;
        }

        const checkEligibility = async () => {
            try {
                const activeEvent = await getActiveEvent();
                setIsEligibleActiveEvent(activeEvent !== null);
            } catch (error) {
                console.error(
                    "Error checking active event eligibility:",
                    error,
                );
                setIsEligibleActiveEvent(false);
            }
        };

        checkEligibility();
    }, [user]);

    useEffect(() => {
        if (user === undefined || !fontsLoaded) return;
        SplashScreen.hideAsync();
<<<<<<< feature/trail-issue-card-draft/chloe-srinidhi

        const route = segments.join("/");

        const nonAuthRoutes = new Set(["auth"]);
        const authRoutes = new Set([
            "(tabs)", 
            "trello", 
            "home-screen",
            "trail-document-screen", 
            "camera-view",
            "trail-issue-screen",
        ]);
        // if user not authenticated, re-route to /auth if an auth route is being accessed 
        if (!user) {
            if (!nonAuthRoutes.has(route)) {
                router.replace("/trail-document-screen");
            }
            return;
        }
        // if user is authenticated, re-route to "home" if non-auth route is being accessed  
        if (!authRoutes.has(route)) {
=======
        const inTabs = segments[0] === "(tabs)";
        const onAuth = segments[0] === "auth";
        const onTrello = segments[0] === "trello";
        const onSetupEvent = segments[0] === "setup-event";
        const onActiveEvent = segments[0] === "active-event";
        const onHomeScreen = segments[0] === "home-screen";
        const onTrailDocument = segments[0] === "trail-document-screen";
        const onEventSummary = segments[0] === "event-summary";
        if (
            user &&
            !inTabs &&
            !onTrello &&
            !onSetupEvent &&
            !onActiveEvent &&
            !onHomeScreen &&
            !onTrailDocument &&
            !onEventSummary
        ) {
>>>>>>> main
            router.replace("/(tabs)");
        }
    }, [user, fontsLoaded, segments, router]);

    if (user === undefined || !fontsLoaded) return null;

    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen
                    name="index"
                    options={{ headerShown: false, animation: "none" }}
                />
                <Stack.Screen
                    name="auth"
                    options={{ headerShown: false, animation: "fade" }}
                />
                <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false, animation: "fade" }}
                />
                <Stack.Screen
                    name="setup-event"
                    options={{ headerShown: true, title: "Set Up Event" }}
                />
                <Stack.Screen
                    name="active-event"
                    options={{ headerShown: true, title: "Active Event" }}
                />
                <Stack.Screen
                    name="trail-document-screen"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="modal"
                    options={{ presentation: "modal", title: "Modal" }}
                />
                <Stack.Screen
                    name="event-summary"
                    options={{ headerShown: false }}
                />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
