import { useGoogleAuth } from "@/hooks/use-google-auth";
import { getActiveEvent } from "@/services/event-service";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
    const router = useRouter();
    const { user, loading, error, handleSignOut } = useGoogleAuth();
    
    // temporary for testing trail document screen 
    const eventCardID = "69b9c0d995522b9b514f88fb";
    const [checkingEvent, setCheckingEvent] = useState(true);
    const [eventError, setEventError] = useState<string | null>(null);

    // Auto-redirect to active event if one exists for this user
    useEffect(() => {
        if (!user) {
            setCheckingEvent(false);
            return;
        }
        getActiveEvent()
            .then((event) => {
                if (event) {
                    router.replace("/active-event");
                }
            })
            .catch((e) => setEventError((e as Error).message))
            .finally(() => setCheckingEvent(false));
    }, [user]);

    if (checkingEvent) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator
                    size="large"
                    style={styles.centered}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Home</Text>
                {user && (
                    <>
                        <Text style={styles.name}>
                            {user.displayName ?? "User"}
                        </Text>
                        <Text style={styles.email}>{user.email}</Text>
                    </>
                )}
                <Pressable
                    style={styles.button}
                    onPress={() => router.push("/setup-event")}>
                    <Text style={styles.buttonText}>Set Up New Event</Text>
                </Pressable>
                <Pressable
                    style={styles.button}
                    onPress={() => router.push("/home-screen")}>
                    <Text style={styles.buttonText}>Go to Home Screen</Text>
                </Pressable>
                <Pressable
                    style={styles.button}
                    onPress={() => router.push("/trello")}>
                    <Text style={styles.buttonText}>Go to Trello Test</Text>
                </Pressable>
                <Pressable
                    style={styles.button}
                    onPress={() =>
                        router.push({
                            pathname: "/trail-document-screen",
                            params: { eventId: "4zJ8xpbgfd5js5S0l0BV" },
                        })
                    }>
                    <Text style={styles.buttonText}>Trail Document Screen</Text>
                </Pressable>
                <Pressable
                    style={styles.button}
                    onPress={() =>
                        router.push({
                            pathname: "/event-summary",
                            params: { eventId: "4zJ8xpbgfd5js5S0l0BV" },
                        })
                    }>
                    <Text style={styles.buttonText}>Event Summary Preview</Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.signOutButton,
                        loading && styles.signOutDisabled,
                    ]}
                    onPress={handleSignOut}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.signOutText}>Sign Out</Text>
                    )}
                </Pressable>
                {eventError && (
                    <Text style={styles.errorText}>{eventError}</Text>
                )}
                {error && <Text style={styles.errorText}>{error.message}</Text>}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    centered: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: "700",
        marginBottom: 8,
    },
    name: {
        fontSize: 20,
        fontWeight: "600",
    },
    email: {
        fontSize: 16,
        color: "#555",
    },
    button: {
        backgroundColor: "#0a7ea4",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 200,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    signOutButton: {
        marginTop: 20,
        backgroundColor: "#555",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 120,
        alignItems: "center",
    },
    signOutDisabled: {
        opacity: 0.7,
    },
    signOutText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    errorText: {
        color: "#c0392b",
        fontSize: 14,
        textAlign: "center",
    },
});
