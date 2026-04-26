import TrelloLoginUI from "@/components/ui/trello-login";
import {
    UpcomingEventsCard,
    type UpcomingEventItem,
} from "@/components/ui/upcoming-events-card";
import { PastEventsCard } from "@/components/ui/past-events-card";
import { getEventByTrelloCardId , startEvent } from "@/services/event-service";
import TrailEventCard from "@/components/ui/trail-event-card";
import { useTrelloAuth } from "@/hooks/use-trello-auth";
import { fetchUpcomingEvents, fetchPastEvents } from "@/services/trello-service";
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

export default function HomeScreen() {
    const router = useRouter();
    const { isAuthenticated, promptSignIn, loading, initializing, error: trelloError } = useTrelloAuth();
    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [pastEvents, setPastEvents] = useState<UpcomingEventItem[]>([]);
    const [pastEventsLoading, setPastEventsLoading] = useState(true);
    const [pastEventsError, setPastEventsError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] =
        useState<UpcomingEventItem | null>(null);
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
        fetchPastEvents(API_KEY)
            .then(setPastEvents)
            .catch((e) => setPastEventsError(e.message))
            .finally(() => setPastEventsLoading(false));
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <TrelloLoginUI
                onPressTrello={handleTrelloSignIn}
                isLoading={loading || initializing}
                errorMessage={trelloError?.message ?? null}
            />
        )
    }

    const handleStartEvent = async (event: UpcomingEventItem) => {
        try {
			// set startDate in firebase
            await startEvent(event.id);
			// close modal
            setSelectedEvent(null);
			// go to in progress screen
			const firebaseEvent = await getEventByTrelloCardId(event.id).catch(() => null);
			if (firebaseEvent) {
				router.push({
					pathname: "/trail-document-screen",
					params: { eventId: firebaseEvent.eventId },
				});
			} else {
				Alert.alert("Not available", "This event hasn't been set up in the app yet.");
			}
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to start event";
			// close modal
            setSelectedEvent(null);
            Alert.alert("Error", message);
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    <Header showGreeting />
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
                            onPressItem={(event) => setSelectedEvent(event)}
                        />
                    </View>
                    <View style={styles.eventsSection}>
                        <PastEventsCard
                            events={pastEvents}
                            loading={pastEventsLoading}
                            error={pastEventsError}
                            maxItems={3}
                        />
                    </View>
                </ScrollView>
                <BottomNav />

                <TrailEventCard
                    event={selectedEvent}
                    visible={selectedEvent !== null}
                    onClose={() => setSelectedEvent(null)}
                    onStartEvent={handleStartEvent}

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
        gap: 10,
    },
    eventsSection: {
        marginTop: 35,
        paddingHorizontal: 20,
    },
});
