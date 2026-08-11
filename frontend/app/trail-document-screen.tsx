import HomeHeader from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import TrailEventHeader from "@/components/ui/trail-event-header";
import TrailMetricsSection from "@/components/ui/trail-metrics-section";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import type { Event } from "@/services/event-service";
import { getEventById } from "@/services/event-service";
import { clearUploadedPhotos } from "@/services/photo-queue";
import { getTrelloClient } from "@/services/trello-config";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { getErrorMessage } from "@/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

export default function TrailDocumentScreen() {
    const router = useRouter();
    // Event loading state
    const [event, setEvent] = useState<Event>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const pressedTrailIssueRef = useRef<boolean>(false);
    // Captured images no longer travel back through route params: camera-view
    // enqueues them and returns with router.back(), so this screen only needs
    // the event it is documenting.
    const { eventId } = useLocalSearchParams<{ eventId?: string }>();
    const [issuesData, setIssuesData] = useState(
        [] as TrailDocumentIssueItem[],
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Photos are read from the persisted queue rather than component state, so
    // they survive navigating into an issue, backgrounding, and app restarts.
    const { pendingCount, failedCount, uploading, flush } =
        usePhotoQueue(eventId);

    // Refetching on focus picks up issues created or edited on the issue screen.
    useFocusEffect(
        useCallback(() => {
            pressedTrailIssueRef.current = false;
            setRefreshKey((k) => k + 1);
            return undefined;
        }, []),
    );

    useEffect(() => {
        if (!eventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }
        getEventById(eventId)
            .then((e) => {
                if (e) {
                    setEvent(e);
                    // load existing notes from event creation
                    setNotes(e.notes ?? "");
                } else {
                    setError("Event not found.");
                }
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [eventId]);

    useEffect(() => {
        if (!event) return;
        let cancelled = false;
        const currentEvent = event;

        async function loadTrailDocument() {
            if (!API_KEY) {
                setLoadError("Missing Trello API Credentials");
                return;
            }
            try {
                setLoadError(null);
                const trello = getTrelloClient(API_KEY);
                const eventCard = await trello.getEventCardByID(
                    currentEvent.trelloCardId,
                    true,
                );
                const issues = await fetchDocumentTrailIssues(
                    API_KEY,
                    eventCard,
                );
                if (!cancelled) {
                    setIssuesData(issues);
                }
            } catch (err) {
                console.error("Error loading trail issues:", err);
                if (!cancelled) {
                    setIssuesError(
                        (err as Error).message ?? "Failed to load trail issues",
                    );
                }
            }
        }
        loadTrailDocument();
        return () => {
            cancelled = true;
        };
    }, [event, refreshKey]);

    function handleAddIssue() {
        if (!event) return;
        router.push({
            pathname: "/trail-issue-screen",
            params: {
                issueId: `new-${Date.now()}`,
                issueName: `New Issue #${issuesData.length + 1}`,
                isNew: "true",
                eventId: event.eventId,
            },
        });
    }

    // Photos upload opportunistically during the event; this is the last chance
    // to clear the backlog before the summary screen. Uploaded entries are then
    // dropped so the local queue does not grow across events (failed ones stay
    // for a later retry).
    async function handleStop() {
        if (!event) return;
        if (pendingCount > 0) {
            await flush().catch((err: unknown) => {
                console.error(
                    "Photo upload failed on stop:",
                    getErrorMessage(err),
                );
                return null;
            });
        }
        await clearUploadedPhotos(event.eventId).catch((err: unknown) => {
            console.error("Could not prune photo queue:", getErrorMessage(err));
        });
        router.replace({
            pathname: "/event-summary",
            params: { eventId: event.eventId, notes },
        });
    }

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
        <>
            <View style={styles.screen}>
                {/* App Header — outside the ScrollView so it stays sticky */}
                <HomeHeader />
                <ScrollView
                    style={styles.container}
                    showsVerticalScrollIndicator={false}>
                    <TrailEventHeader
                        event={event}
                        variant="document"
                        notes={notes}
                        onStop={() => {
                            handleStop().catch((err: unknown) =>
                                setIssuesError(getErrorMessage(err)),
                            );
                        }}
                    />
                    <View style={styles.contentContainer}>
                        {/* Trail Issues Section */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 12,
                            }}>
                            <Text style={styles.sectionTitle}>
                                Trail Issues
                            </Text>
                            <TouchableOpacity
                                onPress={handleAddIssue}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    borderWidth: 1.5,
                                    borderColor: "#5B2D8E",
                                    borderRadius: 20,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    backgroundColor: "#FAF7FF",
                                }}>
                                <Ionicons
                                    name="add"
                                    size={16}
                                    color="#5B2D8E"
                                />
                                <Text
                                    style={{
                                        color: "#5B2D8E",
                                        fontWeight: "600",
                                        fontSize: 13,
                                    }}>
                                    Add Issue
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {issuesError && (
                            <Text style={styles.errorText}>{issuesError}</Text>
                        )}
                        {loadError && (
                            <Text style={{ color: "red", marginBottom: 12 }}>
                                {loadError}
                            </Text>
                        )}
                        {(pendingCount > 0 || uploading) && (
                            <View style={styles.uploadBanner}>
                                <Text style={styles.uploadBannerText}>
                                    {uploading
                                        ? "Uploading photos…"
                                        : `${pendingCount} photo${pendingCount === 1 ? "" : "s"} waiting to upload`}
                                    {failedCount > 0
                                        ? ` · ${failedCount} failed`
                                        : ""}
                                </Text>
                                {!uploading && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            flush().catch((err: unknown) =>
                                                setIssuesError(
                                                    getErrorMessage(err),
                                                ),
                                            );
                                        }}>
                                        <Text style={styles.uploadBannerAction}>
                                            Upload now
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        <View style={styles.listContainer}>
                            {issuesData.map((issue) => (
                                <TrailDocIssuesCard
                                    key={issue.id}
                                    id={issue.id}
                                    name={issue.name}
                                    date={issue.creationDate}
                                    imageUrl={issue.imageUrl}
                                    onPress={() => {
                                        if (pressedTrailIssueRef.current) {
                                            // dont route again
                                            return;
                                        }
                                        pressedTrailIssueRef.current = true;
                                        router.push({
                                            pathname: "/trail-issue-screen",
                                            params: {
                                                issueId: issue.id,
                                                issueName: issue.name,
                                                imageUrl: issue.imageUrl,
                                                eventId: event.eventId,
                                            },
                                        });
                                    }}
                                />
                            ))}
                        </View>

                        {/* Notepad Section */}
                        <Text style={styles.sectionTitle}>Notepad</Text>
                        <TextInput
                            style={{
                                borderWidth: 1.5,
                                borderColor: "#E5E5E5",
                                borderRadius: 12,
                                padding: 14,
                                fontSize: 14,
                                minHeight: 100,
                                marginBottom: 24,
                                backgroundColor: "#FAFAFA",
                            }}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            placeholder="Start documenting the event"
                            placeholderTextColor="#bbb"
                            textAlignVertical="top"
                        />

                        {/* Metrics Section */}
                        <TrailMetricsSection
                            eventId={event.eventId}
                            initialMetrics={event.metrics}
                        />
                    </View>
                </ScrollView>
            </View>
        </>
    );
}
const styles = StyleSheet.create({
    previewImage: {
        width: 180,
        height: 180,
        borderRadius: 12,
        marginTop: 20,
    },
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    loader: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
    },
    listContainer: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 12,
    },
    headerSpacer: {
        height: 120,
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
    uploadBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FAF7FF",
        borderWidth: 1,
        borderColor: "#5B2D8E",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        gap: 12,
    },
    uploadBannerText: {
        flex: 1,
        fontSize: 13,
        color: "#5B2D8E",
    },
    uploadBannerAction: {
        fontSize: 13,
        fontWeight: "700",
        color: "#5B2D8E",
    },
});
