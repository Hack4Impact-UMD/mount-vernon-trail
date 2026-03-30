import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { User } from "firebase/auth";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { subscribeToAuthState } from "@/auth/google-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";

import {
  useFonts,
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
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

    useEffect(() => {
        if (user === undefined || !fontsLoaded) return;
        SplashScreen.hideAsync();
        const inTabs = segments[0] === "(tabs)";
        const onAuth = segments[0] === "auth";
        const onTrello = segments[0] === "trello";
        const onSetupEvent = segments[0] === "setup-event";
        const onActiveEvent = segments[0] === "active-event";
        const onHomeScreen = segments[0] === "home-screen";
        if (user && !inTabs && !onTrello && !onSetupEvent && !onActiveEvent && !onHomeScreen) {
            router.replace("/(tabs)");
        } else if (!user && !onAuth) {
            router.replace("/auth");
        }
    }, [user, fontsLoaded, segments]);

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
