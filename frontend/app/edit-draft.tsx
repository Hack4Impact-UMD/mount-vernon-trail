import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import PublishEventModal from "@/components/ui/publish-event-modal";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import TrailEventHeader from "@/components/ui/trail-event-header";
import TrailMetricsSection from "@/components/ui/trail-metrics-section";
import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { getEventById, publishEvent, saveDraft } from "@/services/event-service";
import { TrelloClient } from "@/services/trello-funcs";
import {
    addNotesToCard,
    fetchDocumentTrailIssues,
    moveCardToCompleted,
} from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function EditDraftScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();

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
            .catch((e) => setError((e as Error).message))
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
                if (!API_KEY) return;
                const trello = new TrelloClient(API_KEY);
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
                    setIssuesError(
                        (err as Error).message ?? "Failed to load trail issues",
                    );
                }
            }
        }
        loadIssues();
        return () => {
            cancelled = true;
        };
    }, [event]);

    const handleSaveDraft = async () => {
        if (!event || savingDraft || publishing) return;
        setSavingDraft(true);
        try {
            await saveDraft(event.eventId, notes);
            router.replace("/drafts");
        } catch (e) {
            Alert.alert("Save failed", (e as Error).message);
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
            await publishEvent(event.eventId);
            await addNotesToCard(event.trelloCardId, notes, API_KEY);
            await moveCardToCompleted(event.trelloCardId, API_KEY);
            setPublishModalVisible(false);
            router.replace("/home-screen");
        } catch (e) {
            Alert.alert("Publish failed", (e as Error).message);
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
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <HomeHeader />
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

				{/* Metrics Section */}
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
