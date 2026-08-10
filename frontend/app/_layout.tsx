import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { Alert } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getActiveEvent } from "@/services/event-service";
import { getErrorMessage } from "@/utils/errors";

import {
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    useFonts,
} from "@expo-google-fonts/lato";

SplashScreen.preventAutoHideAsync();

const NON_AUTH_ROUTES = new Set(["auth"]);

// Every screen in app/ must appear here or an authenticated user gets bounced
// back to /home-screen when they navigate to it. The pre-merge list also held
// "(tabs)", "trello", "active-event" and "mock-statistics"; the first three
// screens were removed in this refactor and "mock-statistics" never had a file
// backing it, so listing them would only whitelist routes that cannot resolve.
const AUTH_ROUTES = new Set([
    "home-screen",
    "trail-document-screen",
    "camera-view",
    "trail-issue-screen",
    "setup-event",
    "event-summary",
    "edit-draft",
    "drafts",
    "albums",
    "profile",
    "before-after-graphic",
]);

function RootNavigator() {
    const colorScheme = useColorScheme();
    const router = useRouter();
    const segments = useSegments();
    const { user } = useAuth();
    const resumeCheckedRef = useRef(false);

    const [fontsLoaded] = useFonts({
        Lato_300Light,
        Lato_400Regular,
        Lato_700Bold,
    });

    useEffect(() => {
        if (user === undefined || !fontsLoaded) return;
        SplashScreen.hideAsync();

        const route = segments[0] ?? "";

        if (!user) {
            resumeCheckedRef.current = false;
            if (!NON_AUTH_ROUTES.has(route)) {
                router.replace("/auth");
            }
            return;
        }
        if (!AUTH_ROUTES.has(route)) {
            router.replace("/home-screen");
        }
    }, [user, fontsLoaded, segments, router]);

    // If the app was killed mid-event, offer to jump back into it. Scoped to
    // the events this user started, so nobody is dropped into someone else's.
    // The old /active-event screen is gone, so resuming lands on the trail
    // document screen for that event instead.
    useEffect(() => {
        if (!user || resumeCheckedRef.current) return;
        resumeCheckedRef.current = true;

        let cancelled = false;
        getActiveEvent()
            .then((activeEvent) => {
                if (cancelled || !activeEvent) return;
                Alert.alert(
                    "Event still running",
                    `"${activeEvent.title}" is still in progress. Pick up where you left off?`,
                    [
                        { text: "Not now", style: "cancel" },
                        {
                            text: "Resume",
                            onPress: () =>
                                router.push({
                                    pathname: "/trail-document-screen",
                                    params: { eventId: activeEvent.eventId },
                                }),
                        },
                    ],
                );
            })
            .catch((error: unknown) => {
                console.error(
                    "Could not check for an active event:",
                    getErrorMessage(error),
                );
            });
        return () => {
            cancelled = true;
        };
    }, [user, router]);

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
                    name="setup-event"
                    options={{ headerShown: true, title: "Set Up Event" }}
                />
                <Stack.Screen
                    name="trail-document-screen"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="trail-issue-screen"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="camera-view"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="event-summary"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="edit-draft"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="home-screen"
                    options={{ headerShown: false, animation: "none" }}
                />
                <Stack.Screen
                    name="drafts"
                    options={{ headerShown: false, animation: "none" }}
                />
                <Stack.Screen
                    name="albums"
                    options={{ headerShown: false, animation: "none" }}
                />
                <Stack.Screen
                    name="profile"
                    options={{ headerShown: false, animation: "none" }}
                />
                <Stack.Screen
                    name="before-after-graphic"
                    options={{ headerShown: false, animation: "none" }}
                />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
