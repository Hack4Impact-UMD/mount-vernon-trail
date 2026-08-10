import BottomNav from "@/components/ui/bottom-nav";
import CreateNewEvent from "@/components/ui/create-new-event";
import Header from "@/components/ui/header";
import MakeBeforeAfterGraphic from "@/components/ui/make-graphic";
import TakeAfterPicture from "@/components/ui/take-after-picture";
import TrailEventCard from "@/components/ui/trail-event-card";
import TrelloLoginUI from "@/components/ui/trello-login";
import {
    UpcomingEventsCard,
    type UpcomingEventItem,
} from "@/components/ui/upcoming-events-card";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTrelloAuth } from "@/hooks/use-trello-auth";
import {
    getActiveEvent,
    getEventByTrelloCardId,
    getPublishedEvents,
    startEvent,
} from "@/services/event-service";
import { fetchUpcomingEvents } from "@/services/trello-service";
import { warmTrelloCache } from "@/services/trello-config";
import { getErrorMessage } from "@/utils/errors";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

export default function HomeScreen() {
    const router = useRouter();
    const { isAuthenticated, promptSignIn, loading, initializing, error: trelloError } = useTrelloAuth();
    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] =
        useState<UpcomingEventItem | null>(null);
    const [pastEvents, setPastEvents] = useState<UpcomingEventItem[]>([]);
    const [pastLoading, setPastLoading] = useState(true);
    const [pastError, setPastError] = useState<string | null>(null);
    const [showAllUpcoming, setShowAllUpcoming] = useState(false);
    const [showAllPast, setShowAllPast] = useState(false);
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
        setEventsError(null);
        // One board/list lookup for the whole session instead of one per call.
        warmTrelloCache(API_KEY).catch(() => undefined);
        fetchUpcomingEvents(API_KEY)
            .then(setEvents)
            .catch((e: unknown) => setEventsError(getErrorMessage(e)))
            .finally(() => setEventsLoading(false));
    }, [isAuthenticated]);

    // Real published events, replacing the hardcoded Figma placeholders that
    // used to render to every user.
    useEffect(() => {
        let cancelled = false;
        setPastLoading(true);
        setPastError(null);
        getPublishedEvents()
            .then((published) => {
                if (cancelled) return;
                setPastEvents(
                    published.map((event) => ({
                        id: event.trelloCardId,
                        name: event.title,
                        description: event.description,
                        date: event.date.toDate(),
                        imageUrl: null,
                        status: "Completed",
                    })),
                );
            })
            .catch((e: unknown) => {
                if (!cancelled) setPastError(getErrorMessage(e));
            })
            .finally(() => {
                if (!cancelled) setPastLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleTakeAfterPicture = useCallback(async () => {
        try {
            const activeEvent = await getActiveEvent();
            if (!activeEvent) {
                Alert.alert(
                    "No event in progress",
                    "Start an event from the list below, then pick the issue you want to photograph.",
                );
                return;
            }
            router.push({
                pathname: "/trail-document-screen",
                params: { eventId: activeEvent.eventId },
            });
        } catch (e) {
            Alert.alert("Something went wrong", getErrorMessage(e));
        }
    }, [router]);

    if (!isAuthenticated) {
        return (
            <TrelloLoginUI
                onPressTrello={handleTrelloSignIn}
                isLoading={loading || initializing}
                errorMessage={trelloError?.message ?? null}
            />
        )
    }

    const handlePressEvent = async (event: UpcomingEventItem) => {
        setSelectedEvent(event);
        const firebaseEvent = await getEventByTrelloCardId(event.id).catch(
            (e: unknown) => {
                // Previously swallowed, so the modal silently opened without
                // leader/zone data and looked like the event had none.
                setEventsError(getErrorMessage(e));
                return null;
            },
        );
        if (!firebaseEvent) return;

        setSelectedEvent((prev) => {
            if (prev?.id !== event.id) return prev;
            return {
                ...prev,
                eventLeader: firebaseEvent.eventLeader ?? "",
                zoneLeaders: firebaseEvent.zoneLeaders ?? "",
                toolHaulers: firebaseEvent.toolHaulers ?? "",
                gloverLover: firebaseEvent.gloverLover ?? "",
                workScope: firebaseEvent.description ?? "",
            };
        });
    };

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
                        <TakeAfterPicture
                            onPress={() => {
                                handleTakeAfterPicture().catch((e: unknown) =>
                                    setEventsError(getErrorMessage(e)),
                                );
                            }}
                        />
                        <MakeBeforeAfterGraphic onPress={() => router.push("/before-after-graphic")} />
                        {isAdmin && (
                            <CreateNewEvent onPress={() => router.push("/setup-event")} />
                        )}
                    </View>
                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            events={events}
                            loading={eventsLoading}
                            error={eventsError}
                            maxItems={showAllUpcoming ? events.length : 3}
                            onShowMore={() => setShowAllUpcoming((v) => !v)}
                            onPressItem={(event) => handlePressEvent(event)}
                        />
                    </View>

                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            title="Past Events"
                            events={pastEvents}
                            loading={pastLoading}
                            error={pastError}
                            maxItems={showAllPast ? pastEvents.length : 3}
                            onShowMore={() => setShowAllPast((v) => !v)}
                            onPressItem={(event) => handlePressEvent(event)}
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
