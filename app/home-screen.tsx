import {
    UpcomingEventsCard,
    type UpcomingEventItem,
} from "@/components/ui/upcoming-events-card";
import TrailEventCard from "@/components/ui/trail-event-card";
import { fetchUpcomingEvents } from "@/services/trello-service";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import BottomNav from "../components/ui/bottom-nav";
import Header from "../components/ui/header";
import StartEventCard from "../components/ui/start-event-card";

// hardcoded for testing, need to swap for real auth later
const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN;

// THESE ARE PLACEHOLDER EVENTS FOR THE PAST EVENTS FIGMA DESIGN
const PLACEHOLDER_PAST_EVENTS: UpcomingEventItem[] = [
    {
        id: "past-1",
        name: "Snow cleanup on Sector A",
        description: "",
        date: new Date(2026, 1, 15),
        imageUrl: null,
    },
    {
        id: "past-2",
        name: "Trail marker restoration at Mile 3",
        description: "",
        date: new Date(2026, 0, 22),
        imageUrl: null,
    },
    {
        id: "past-3",
        name: "Fallen tree removal near bridge",
        description: "",
        date: new Date(2025, 11, 10),
        imageUrl: null,
    },
    {
        id: "past-4",
        name: "Holiday litter sweep",
        description: "",
        date: new Date(2025, 11, 1),
        imageUrl: null,
    },
];

export default function HomeScreen() {
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");

    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] =
        useState<UpcomingEventItem | null>(null);

    useEffect(() => {
        if (!API_KEY || !API_TOKEN) {
            setEventsError("Missing Trello API credentials");
            setEventsLoading(false);
            return;
        }
        fetchUpcomingEvents(API_KEY, API_TOKEN)
            .then(setEvents)
            .catch((e) => setEventsError(e.message))
            .finally(() => setEventsLoading(false));
    }, []);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.screen}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    <Header userName="Sarah" />
                    <View style={styles.cardWrapper}>
                        <StartEventCard />
                    </View>
                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            events={events}
                            loading={eventsLoading}
                            error={eventsError}
                            maxItems={3}
                            onShowMore={() => {}}
                            onPressItem={(event) => setSelectedEvent(event)}
                        />
                    </View>

                    {/* PLACEHOLDER FOR PAST EVENTS IN FIGMA */}
                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            title="Past Events"
                            events={PLACEHOLDER_PAST_EVENTS}
                            loading={false}
                            error={null}
                            maxItems={3}
                            onShowMore={() => {}}
                            onPressItem={(event) =>
                                console.log("pressed past:", event.name)
                            }
                        />
                    </View>
                </ScrollView>
                <BottomNav
                    active={active}
                    onTabPress={(tab) => setActive(tab)}
                />

                <TrailEventCard
                    event={selectedEvent}
                    visible={selectedEvent !== null}
                    onClose={() => setSelectedEvent(null)}
                    onStartEvent={(event) => {
                        console.log("Start Event:", event.name);
                        setSelectedEvent(null);
                    }}
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    cardWrapper: {
        marginTop: 10,
        paddingHorizontal: 20,
    },
    eventsSection: {
        marginTop: 35,
        paddingHorizontal: 20,
    },
});
