import type { Event } from "@/services/event-service";
import { getActiveEvent, setEventInactive } from "@/services/event-service";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActiveEventScreen() {
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);

    useEffect(() => {
        getActiveEvent()
            .then(setEvent)
            .finally(() => setLoading(false));
    }, []);

    const handleEndEvent = () => {
        if (!event) return;
        Alert.alert(
            "End Event",
            `Are you sure you want to end "${event.title}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "End Event",
                    style: "destructive",
                    onPress: async () => {
                        setEnding(true);
                        try {
                            await setEventInactive(event.eventId);
                            router.replace("/(tabs)");
                        } catch (e) {
                            Alert.alert("Error", (e as Error).message);
                            setEnding(false);
                        }
                    },
                },
            ],
        );
    };

    if (loading) {
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
                <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ONGOING EVENT</Text>
                    </View>
                </View>

                <Text style={styles.title}>{event?.title ?? "Event"}</Text>

                {event?.description ? (
                    <Text style={styles.description}>{event.description}</Text>
                ) : null}

                <Pressable
                    style={[
                        styles.endButton,
                        ending && styles.endButtonDisabled,
                    ]}
                    onPress={handleEndEvent}
                    disabled={ending}>
                    {ending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.endButtonText}>End Event</Text>
                    )}
                </Pressable>
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
        padding: 24,
        alignItems: "center",
        gap: 12,
    },
    badgeRow: {
        marginTop: 8,
    },
    badge: {
        backgroundColor: "#27ae60",
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 12,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 4,
    },
    description: {
        fontSize: 16,
        color: "#555",
        textAlign: "center",
    },
    placeholder: {
        marginTop: 24,
        width: "100%",
        height: 200,
        backgroundColor: "#f0f0f0",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    placeholderText: {
        fontSize: 16,
        color: "#888",
    },
    endButton: {
        marginTop: "auto",
        width: "100%",
        backgroundColor: "#e74c3c",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    endButtonDisabled: {
        opacity: 0.6,
    },
    endButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
});
