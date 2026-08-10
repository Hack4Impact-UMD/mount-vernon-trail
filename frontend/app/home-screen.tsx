import BottomNav from "@/components/ui/bottom-nav";
import CreateNewEvent from "@/components/ui/create-new-event";
import Header from "@/components/ui/header";
import MakeBeforeAfterGraphic from "@/components/ui/make-graphic";
import { PastEventsCard } from "@/components/ui/past-events-card";
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
    clearActiveEventLocally,
    getEventByTrelloCardId,
    getLocalActiveEventId,
    saveActiveEventLocally,
    startEvent,
} from "@/services/event-service";
import { warmTrelloCache } from "@/services/trello-config";
import { fetchEventCards } from "@/services/trello-service";
import { getErrorMessage } from "@/utils/errors";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

// filter out using firestore data to avoid showing events that are marked as drafts in the app but still exist as Trello cards (e.g. for testing or staging purposes)
async function filterOutDrafts(
    events: UpcomingEventItem[],
): Promise<UpcomingEventItem[]> {
    const checks = await Promise.all(
        events.map(async (event) => {
            try {
                const firebaseEvent = await getEventByTrelloCardId(event.id);
                // Keep if no Firestore doc exists or if it's not a draft.
                // (No doc = legacy event, default to showing it.)
                return firebaseEvent?.isDraft ? null : event;
            } catch {
                // On lookup failure, default to showing the event so a transient
                // Firestore error doesn't hide everything.
                return event;
            }
        }),
    );
    return checks.filter((e): e is UpcomingEventItem => e !== null);
}

export default function HomeScreen() {
    const router = useRouter();
    const {
        isAuthenticated,
        promptSignIn,
        loading,
        initializing,
        error: trelloError,
    } = useTrelloAuth();
    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [pastEvents, setPastEvents] = useState<UpcomingEventItem[]>([]);
    const [pastEventsLoading, setPastEventsLoading] = useState(true);
    const [pastEventsError, setPastEventsError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] =
        useState<UpcomingEventItem | null>(null);
    const isAdmin = useIsAdmin();
    const [localActiveEventId, setLocalActiveEventId] = useState<string | null>(
        null,
    );

    const handleTrelloSignIn = async () => {
        const ok = await promptSignIn();
        if (ok) {
            router.replace("/home-screen");
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (!isAuthenticated || !API_KEY) {
                setEventsLoading(false);
                setPastEventsLoading(false);
                return;
            }
            setEventsLoading(true);
            setPastEventsLoading(true);
            // Clear stale failures so a recovered fetch stops rendering the
            // error state over a good list.
            setEventsError(null);
            setPastEventsError(null);
            // One board/list lookup for the whole session instead of one per
            // call; both fetches below then hit the warm cache.
            warmTrelloCache(API_KEY).catch(() => undefined);
            fetchEventCards(API_KEY, "upcoming")
                .then(filterOutDrafts)
                .then(setEvents)
                .catch((e: unknown) => setEventsError(getErrorMessage(e)))
                .finally(() => setEventsLoading(false));
            fetchEventCards(API_KEY, "past")
                .then(setPastEvents)
                .catch((e: unknown) => setPastEventsError(getErrorMessage(e)))
                .finally(() => setPastEventsLoading(false));
        }, [isAuthenticated]),
    );

    useEffect(() => {
        if (!isAuthenticated) return;

        (async () => {
            const storedId = await getLocalActiveEventId();
            if (!storedId) return;

            // verify it's still active in Firestore
            let firebaseEvent;
            try {
                firebaseEvent = await getEventByTrelloCardId(storedId);
            } catch {
                Alert.alert("Error", "Error getting active event data.");
                return;
            }
            if (
                firebaseEvent &&
                firebaseEvent.startDate &&
                !firebaseEvent.endDate
            ) {
                setLocalActiveEventId(storedId);
            } else {
                // stale — clean it up
                await clearActiveEventLocally();
            }
        })();
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <TrelloLoginUI
                onPressTrello={handleTrelloSignIn}
                isLoading={loading || initializing}
                errorMessage={trelloError?.message ?? null}
            />
        );
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
        const isResume = event.id === localActiveEventId;
        try {
            // set startDate in firebase
            if (!isResume) {
                await startEvent(event.id);
                await saveActiveEventLocally(event.id);
            }
            // close modal
            setSelectedEvent(null);
            // go to in progress screen
            const firebaseEvent = await getEventByTrelloCardId(event.id).catch(
                () => null,
            );
            if (firebaseEvent) {
                router.push({
                    pathname: "/trail-document-screen",
                    params: { eventId: firebaseEvent.eventId },
                });
            } else {
                Alert.alert(
                    "Not available",
                    "This event hasn't been set up in the app yet.",
                );
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
                        {/* Standalone after-photo flow: camera-view handles a
                            missing eventId by returning here once saved, so no
                            active event has to be resolved first. */}
                        <TakeAfterPicture
                            onPress={() =>
                                router.push({
                                    pathname: "/camera-view",
                                    params: { mode: "after" },
                                })
                            }
                        />
                        <MakeBeforeAfterGraphic
                            onPress={() => router.push("/before-after-graphic")}
                        />
                        {isAdmin && (
                            <CreateNewEvent
                                onPress={() => router.push("/setup-event")}
                            />
                        )}
                    </View>
                    <View style={styles.eventsSection}>
                        <UpcomingEventsCard
                            events={events}
                            loading={eventsLoading}
                            error={eventsError}
                            maxItems={3}
                            onShowMore={() => {}}
                            onPressItem={(event) => handlePressEvent(event)}
                            activeEventId={localActiveEventId}
                        />
                    </View>
                    {/* Past events come from the Trello "Completed Events" list
                        rather than getPublishedEvents(): Trello is the source of
                        truth for events that predate the app's Firestore
                        records, so a Firestore-only list would hide them. */}
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
                    isResume={selectedEvent?.id === localActiveEventId}
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
