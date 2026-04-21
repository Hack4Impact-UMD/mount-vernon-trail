import TrelloLoginUI from "@/components/ui/trello-login";
import {
    UpcomingEventsCard,
    type UpcomingEventItem,
} from "@/components/ui/upcoming-events-card";
import { getEventByTrelloCardId } from "@/services/event-service";
import { useTrelloAuth } from "@/hooks/use-trello-auth";
import { fetchUpcomingEvents } from "@/services/trello-service";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import TakeAfterPicture from "@/components/ui/take-after-picture";
import MakeBeforeAfterGraphic from "@/components/ui/make-graphic";
import CreateNewEvent from "@/components/ui/create-new-event";
import { useIsAdmin } from "@/hooks/use-is-admin";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

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
    const router = useRouter();
    const { isAuthenticated, promptSignIn, loading, initializing, error: trelloError } = useTrelloAuth();
    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const isAdmin = useIsAdmin();

    const handleTrelloSignIn = async () => {
        const ok = await promptSignIn();
        if (ok) {
            router.replace("/home-screen");
        }
    }

    useEffect(() => {
        if (!isAuthenticated || !API_KEY) {
            setEventsLoading(false);
            return;
        }
        setEventsLoading(true);
        fetchUpcomingEvents(API_KEY)
            .then(setEvents)
            .catch((e) => setEventsError(e.message))
            .finally(() => setEventsLoading(false));
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <TrelloLoginUI
                userName="Sarah"
                onPressTrello={handleTrelloSignIn}
                isLoading={loading || initializing}
                errorMessage={trelloError?.message ?? null}
            />
        )
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    <Header
                        userName="Sarah"
                        showGreeting
                    />
                    <View style={styles.cardWrapper}>
                        <TakeAfterPicture />
                        <MakeBeforeAfterGraphic />
                        {isAdmin && (
                            <CreateNewEvent onPress={() => router.push("/setup-event")} />
                        )}
                    </View>
                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            events={events}
                            loading={eventsLoading}
                            error={eventsError}
                            maxItems={3}
                            onShowMore={() => {}}
                            onPressItem={async (event) => {
                                const firebaseEvent = await getEventByTrelloCardId(event.id).catch(() => null);
                                if (firebaseEvent) {
                                    router.push({
                                        pathname: "/trail-document-screen",
                                        params: { eventId: firebaseEvent.eventId },
                                    });
                                } else {
                                    Alert.alert("Not available", "This event hasn't been set up in the app yet.");
                                }
                            }}
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
                <BottomNav />
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
        gap: 10,
    },
    eventsSection: {
        marginTop: 35,
        paddingHorizontal: 20,
    },
});
