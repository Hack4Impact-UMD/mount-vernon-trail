import {
    UpcomingEventsCard,
    type UpcomingEventItem,
} from "@/components/ui/upcoming-events-card";
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

export default function HomeScreen() {
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");

    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [eventsMax, setEventsMax] = useState(3);

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
                            maxItems={eventsMax}
                            onShowMore={() => setEventsMax((prev) => prev + 3)}
                            onPressItem={(event) =>
                                console.log("pressed:", event.name)
                            }
                        />
                    </View>
                </ScrollView>
                <BottomNav
                    active={active}
                    onTabPress={(tab) => setActive(tab)}
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#FEFEFE",
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
