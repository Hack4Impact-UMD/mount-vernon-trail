import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event } from "@/services/event-service";
import { getEventById } from "@/services/event-service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TrailDocumentScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [event, setEvent] = useState<Event>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    useEffect(() => {
        if (!eventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }
        getEventById(eventId)
            .then((e) => {
                if (e) setEvent(e);
                else setError("Event not found.");
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [eventId]);

    if (loading) return <ActivityIndicator style={styles.loader} />;
    if (error || !event)
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                    {error ?? "Event not found."}
                </Text>
            </View>
        );

    return (
        <View style={styles.container}>
            <HomeHeader userName="Sarah" />
            <TrailEventHeader
                event={event}
                variant="document"
                onStop={() =>
                    router.replace({
                        pathname: "/event-summary",
                        params: { eventId: event.eventId },
                    })
                }
            />
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    loader: {
        flex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    errorText: {
        fontSize: 15,
        color: "#888",
        textAlign: "center",
    },
});
