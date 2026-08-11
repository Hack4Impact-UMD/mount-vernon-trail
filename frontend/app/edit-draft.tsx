import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import PublishEventModal from "@/components/ui/publish-event-modal";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import TrailEventHeader from "@/components/ui/trail-event-header";
import TrailMetricsSection from "@/components/ui/trail-metrics-section";
import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { getEventById, publishEvent, saveDraft } from "@/services/event-service";
import { getTrelloClient } from "@/services/trello-config";
import {
    addNotesToCard,
    fetchDocumentTrailIssues,
    moveCardAttachmentsToCompleted,
    moveCardToCompleted,
} from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { getErrorMessage } from "@/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

// fetchDocumentTrailIssues carries the Trello card description through, but it
// is not part of TrailDocumentIssueItem yet. Read it defensively so the issue
// editor still prefills, without casting through `any`.
function issueDescription(issue: TrailDocumentIssueItem): string | undefined {
    return "description" in issue && typeof issue.description === "string"
        ? issue.description
        : undefined;
}

export default function EditDraftScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();

    // Guards against a double tap opening two copies of the issue editor.
    const pressedIssueRef = useRef(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Returning from the issue editor must show the edits that were just made.
    useFocusEffect(
        useCallback(() => {
            pressedIssueRef.current = false;
            setRefreshKey((k) => k + 1);
        }, []),
    );

    const [event, setEvent] = useState<Event>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [issues, setIssues] = useState<TrailDocumentIssueItem[]>([]);
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const [savingDraft, setSavingDraft] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishModalVisible, setPublishModalVisible] = useState(false);

    useEffect(() => {
        if (!eventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }
        getEventById(eventId)
            .then((e) => {
                if (!e) {
                    setError("Event not found.");
                    return;
                }
                setEvent(e);
                setNotes(e.notes ?? "");
            })
            .catch((e) => setError(getErrorMessage(e)))
            .finally(() => setLoading(false));
    }, [eventId]);

    useEffect(() => {
        if (!event) return;
        let cancelled = false;
        async function loadIssues() {
            if (!API_KEY) {
                setIssuesError("Missing Trello API credentials");
                return;
            }
            if (!event) return;
            try {
                const trello = getTrelloClient(API_KEY);
                const eventCard = await trello.getEventCardByID(
                    event.trelloCardId,
                    true,
                );
                const fetched = await fetchDocumentTrailIssues(
                    API_KEY,
                    eventCard,
                );
                if (!cancelled) setIssues(fetched);
            } catch (err) {
                if (!cancelled) {
                    setIssuesError(getErrorMessage(err));
                }
            }
        }
        loadIssues();
        return () => {
            cancelled = true;
        };
    }, [event, refreshKey]);

    const handleSaveDraft = async () => {
        if (!event || savingDraft || publishing) return;
        setSavingDraft(true);
        try {
            await saveDraft(event.eventId, notes);
            router.replace("/drafts");
        } catch (e) {
            Alert.alert("Save failed", getErrorMessage(e));
            setSavingDraft(false);
        }
    };

    const handleConfirmPublish = async () => {
        if (!event || publishing) return;
        if (!API_KEY) {
            Alert.alert("Missing Trello credentials");
            return;
        }
        setPublishing(true);
        try {
            // Trello first, Firestore last. Reversed, a failing Trello call
            // left the event already marked published and gone from Drafts,
            // with no way to retry from the UI.
            await addNotesToCard(event.trelloCardId, notes, API_KEY);
            await moveCardToCompleted(event.trelloCardId, API_KEY);
            await moveCardAttachmentsToCompleted(event.trelloCardId, API_KEY);
            await publishEvent(event.eventId);
            setPublishModalVisible(false);
            router.replace("/home-screen");
        } catch (e) {
            Alert.alert("Publish failed", getErrorMessage(e));
            setPublishing(false);
        }
    };

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
        <View style={styles.screen}>
            <HomeHeader />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <TrailEventHeader event={event} variant="summary" />

                <View style={styles.contentContainer}>
                    <Text style={styles.sectionTitle}>Trail Issues</Text>
                    {issuesError && (
                        <Text style={styles.warning}>{issuesError}</Text>
                    )}
                    <View style={styles.listContainer}>
                        {issues.map((issue) => (
                            <TrailDocIssuesCard
                                key={issue.id}
                                id={issue.id}
                                name={issue.name}
                                date={issue.creationDate}
                                imageUrl={issue.imageUrl}
                                onPress={() => {
                                    if (pressedIssueRef.current) return;
                                    pressedIssueRef.current = true;
                                    router.push({
                                        pathname: "/trail-issue-screen",
                                        params: {
                                            issueId: issue.id,
                                            issueName: issue.name,
                                            imageUrl:
                                                issue.imageUrl ?? undefined,
                                            description: issueDescription(
                                                issue,
                                            ),
                                            eventId: event.eventId,
                                            isDraft: "true",
                                        },
                                    });
                                }}
                            />
                        ))}
                        {!issuesError && issues.length === 0 && (
                            <Text style={styles.emptyText}>
                                No trail issues recorded for this event.
                            </Text>
                        )}
                    </View>

                    <View>
                        <Text style={styles.sectionTitle}>Notepad</Text>
                        <TextInput
                            style={styles.notepad}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            placeholder="Add notes about this event"
                            placeholderTextColor="#bbb"
                            textAlignVertical="top"
                        />
                    </View>

                    <TrailMetricsSection
                        eventId={event.eventId}
                        initialMetrics={event.metrics}
                    />
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={handleSaveDraft}
                        disabled={savingDraft || publishing}
                        style={[
                            styles.actionBtn,
                            styles.draftBtn,
                            (savingDraft || publishing) && styles.btnDisabled,
                        ]}>
                        {savingDraft ? (
                            <ActivityIndicator color="#444" />
                        ) : (
                            <>
                                <Ionicons
                                    name="document-outline"
                                    size={18}
                                    color="#444"
                                />
                                <Text style={styles.draftBtnText}>
                                    Save as draft
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setPublishModalVisible(true)}
                        disabled={savingDraft || publishing}
                        style={[
                            styles.actionBtn,
                            styles.publishBtn,
                            (savingDraft || publishing) && styles.btnDisabled,
                        ]}>
                        <Ionicons
                            name="share-outline"
                            size={18}
                            color={Palette.primaryPurple100}
                        />
                        <Text style={styles.publishBtnText}>Post to Trello</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <BottomNav />
            <PublishEventModal
                visible={publishModalVisible}
                onCancel={() => setPublishModalVisible(false)}
                onConfirm={handleConfirmPublish}
                loading={publishing}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    loader: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { paddingBottom: 30 },
    contentContainer: { paddingHorizontal: 20 },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 12,
        marginTop: 16,
    },
    listContainer: {
        marginBottom: 8,
    },
    notepad: {
        borderWidth: 1.5,
        borderColor: "#E5E5E5",
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        minHeight: 100,
        marginBottom: 16,
        backgroundColor: "#FAFAFA",
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    btnDisabled: { opacity: 0.6 },
    draftBtn: {
        borderColor: "#DADADA",
        backgroundColor: "#F5F5F5",
    },
    draftBtnText: {
        color: "#444",
        fontWeight: "600",
        fontSize: 14,
    },
    publishBtn: {
        borderColor: Palette.primaryPurple100,
        backgroundColor: "#FAF7FF",
    },
    publishBtnText: {
        color: Palette.primaryPurple100,
        fontWeight: "600",
        fontSize: 14,
    },
    warning: {
        color: "#c0392b",
        fontSize: 13,
        marginBottom: 10,
    },
    emptyText: {
        color: "#999",
        fontSize: 14,
        fontStyle: "italic",
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
