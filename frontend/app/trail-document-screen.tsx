import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import { TrailDocStatsCard } from "@/components/ui/trail-doc-stats-card";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event } from "@/services/event-service";
import {
    getActiveEvent,
    getEventById,
} from "@/services/event-service";
import { TrelloClient } from "@/services/trello-funcs";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
    // Trail issue, state, and camera state
    const { beforeImageUri, afterImageUri, activeIssueId, eventId } =
        useLocalSearchParams<{
            beforeImageUri?: string;
            afterImageUri?: string;
            activeIssueId?: string;
            eventId?: string;
        }>();
    const [issuesData, setIssuesData] = useState(
        [] as TrailDocumentIssueItem[],
    );
    const [issueImages, setIssueImages] = useState<
        Record<string, { before?: string; after?: string }>
    >({});
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notepad, setNotepad] = useState("");
    const [activeEventId, setActiveEventId] = useState<string | null>(null);
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [statsData, setStatsData] = useState({
        trashCollection: 0,
        restorationEffort: 0,
    });

    useEffect(() => {
        async function loadActiveEvent() {
            try {
                const ev = await getActiveEvent();
                if (ev) setActiveEventId(ev.eventId);
            } catch (err) {
                console.error("Failed to fetch active event:", err);
            }
        }
        loadActiveEvent();
    }, []);

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
                const trello = new TrelloClient(API_KEY);
                const eventCard = await trello.getEventCardByID(
                    currentEvent.trelloCardId,
                    true,
                );
                const issues = await fetchDocumentTrailIssues(
                    API_KEY,
                    eventCard,
                );
                // TODO fetch stats once that flow is figured out
                if (!cancelled) {
                    setIssuesData(issues);
                    setStatsData({
                        trashCollection: 12,
                        restorationEffort: 250,
                    });
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
    }, [event]);

    // when the user returns from camera-view, store the captured image under the correct issue
    useEffect(() => {
        if (activeIssueId && (beforeImageUri || afterImageUri)) {
            setIssueImages((prev) => ({
                ...prev,
                [activeIssueId]: {
                    before: beforeImageUri ?? prev[activeIssueId]?.before,
                    after: afterImageUri ?? prev[activeIssueId]?.after,
                },
            }));
        }
    }, [activeIssueId, beforeImageUri, afterImageUri]);

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
                <ScrollView
                    style={styles.container}
                    showsVerticalScrollIndicator={false}>
                    {/* App Header */}
                    <HomeHeader userName="Sarah" />
                    <TrailEventHeader
                        event={event}
                        variant="document"
                        onStop={() =>
                            router.replace({
                                pathname: "/event-summary",
                                params: {
                                    eventId: event.eventId,
                                    notepad: notepad,
                                },
                            })
                        }
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
                        <View style={styles.listContainer}>
                            {issuesData.map((issue) => (
                                <TrailDocIssuesCard
                                    key={issue.id}
                                    id={issue.id}
                                    name={issue.name}
                                    date={issue.creationDate}
                                    imageUrl={issue.imageUrl}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/trail-issue-screen",
                                            params: {
                                                issueId: issue.id,
                                                issueName: issue.name,
												imageUrl: issue.imageUrl,
                                                eventId: event.eventId,
												beforeImageUri: issueImages[issue.id]?.before,
												afterImageUri: issueImages[issue.id]?.after
                                            },
                                        })
                                    }
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
                            value={notepad}
                            onChangeText={setNotepad}
                            multiline
                            placeholder="Start documenting the event"
                            placeholderTextColor="#bbb"
                            textAlignVertical="top"
                        />

                        {/* Statistics Section */}
                        <Text style={styles.sectionTitle}>Statistics</Text>
                        <TrailDocStatsCard {...statsData} />

                        {/* Action Buttons */}
                        {/* <View
                            style={{
                                flexDirection: "row",
                                gap: 12,
                                marginTop: 16,
                                marginBottom: 24,
                            }}>
                            <TouchableOpacity
                                onPress={handleSaveDraft}
                                disabled={savingDraft}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: "#DADADA",
                                    backgroundColor: "#F5F5F5",
                                }}>
                                <Ionicons
                                    name="document-outline"
                                    size={18}
                                    color="#555"
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={{
                                        color: "#444",
                                        fontWeight: "600",
                                        fontSize: 14,
                                    }}>
                                    Save as draft
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowPublishModal(true)}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: "#5B2D8E",
                                    backgroundColor: "#FAF7FF",
                                }}>
                                <Ionicons
                                    name="share-outline"
                                    size={18}
                                    color="#5B2D8E"
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={{
                                        color: "#5B2D8E",
                                        fontWeight: "600",
                                        fontSize: 14,
                                    }}>
                                    Post to Trello
                                </Text>
                            </TouchableOpacity>
                        </View> */}
                    </View>
                </ScrollView>
                <BottomNav />
            </View>

            {/* <Modal
                visible={showPublishModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPublishModal(false)}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                    <View
                        style={{
                            width: "82%",
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            padding: 24,
                        }}>
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: "700",
                                marginBottom: 10,
                            }}>
                            Post to Trello?
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: "#555",
                                lineHeight: 20,
                                marginBottom: 24,
                            }}>
                            This will publish the event to your Trello board and
                            mark it as complete.
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <Pressable
                                onPress={() => setShowPublishModal(false)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    borderWidth: 1.5,
                                    borderColor: "#DDD",
                                    alignItems: "center",
                                }}>
                                <Text
                                    style={{
                                        color: "#555",
                                        fontWeight: "600",
                                    }}>
                                    Cancel
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={handlePublish}
                                disabled={publishing}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    backgroundColor: "#5B2D8E",
                                    alignItems: "center",
                                }}>
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontWeight: "700",
                                    }}>
                                    Post
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal> */}
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
});
