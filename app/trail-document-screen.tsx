import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event } from "@/services/event-service";
import { getActiveEvent } from "@/services/event-service";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const MOCK_EVENT: Event = {
    eventId: "mock",
    title: "Mock Event",
    description: "",
    date: Timestamp.now(),
    trelloCardId: "",
    albumId: "",
    albumUrl: "",
    isActive: true,
    startDate: Timestamp.now(),
    endDate: null,
    createdAt: Timestamp.now(),
};

export default function TrailDocumentScreen() {
    const [event, setEvent] = useState<Event>(MOCK_EVENT);

    useEffect(() => {
        getActiveEvent().then((e) => { if (e) setEvent(e); });
    }, []);

    return (
        <View style={styles.container}>
            <HomeHeader userName="Sarah" />
            <TrailEventHeader event={event} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
});
