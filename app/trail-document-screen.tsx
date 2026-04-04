import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event } from "@/services/event-service";
import { getEventById } from "@/services/event-service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function TrailDocumentScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [event, setEvent] = useState<Event>();

    useEffect(() => {
        if (!eventId) return;
        getEventById(eventId).then((e) => {
            if (e) setEvent(e);
        });
    }, [eventId]);
    if (!event) return null;

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
});
