import HomeHeader from "@/components/ui/header";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { getEventById, type Event } from "@/services/event-service";
import type { PhotoSlot } from "@/services/photo-queue";
import { getTrelloClient } from "@/services/trello-config";
import { createIssueCard, updateIssueCard } from "@/services/trello-service";
import { getErrorMessage } from "@/utils/errors";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";

// Notes and metrics share one Trello card description, so reopening a card
// means splitting them back apart in the same shape createIssueCard writes.
function parseDescription(desc: string): { notes: string; metrics: string } {
    const notesMatch = /Notes:\n([\s\S]*?)(?:\n\nMetrics:|$)/.exec(desc);
    const metricsMatch = /Metrics:\n([\s\S]*)$/.exec(desc);
    return {
        notes: notesMatch?.[1]?.trim() ?? "",
        metrics: metricsMatch?.[1]?.trim() ?? "",
    };
}

function PhotoCard({
    label,
    uri,
    caption,
    locked,
    onPress,
}: {
    label: string;
    uri?: string;
    caption?: string;
    locked: boolean;
    onPress: () => void;
}) {
    const content = uri ? (
        <>
            <Image
                source={{ uri }}
                style={styles.photoImage}
                resizeMode="cover"
            />
            {caption ? (
                <View style={styles.photoStatus}>
                    <Text style={styles.photoStatusText}>{caption}</Text>
                </View>
            ) : null}
        </>
    ) : (
        <View style={styles.photoPlaceholder}>
            <Image
                source={require("../assets/images/camera-purple.png")}
                style={[styles.cameraIcon, locked && { opacity: 0.4 }]}
            />
            <Text style={[styles.photoLabel, locked && { color: "#bbb" }]}>
                {label}
            </Text>
        </View>
    );

    // A published draft is a record of a finished event: nothing left to shoot.
    if (locked) return <View style={styles.photoCard}>{content}</View>;

    return (
        <TouchableOpacity
            style={styles.photoCard}
            onPress={onPress}
            activeOpacity={0.75}
            accessibilityLabel={`${label} photo`}
            accessibilityRole="button">
            {content}
        </TouchableOpacity>
    );
}

export default function TrailIssueDetailScreen() {
    const router = useRouter();
    const {
        issueId,
        issueName,
        imageUrl,
        description,
        eventId,
        isNew,
        isDraft,
        beforeImageUri,
        afterImageUri,
    } = useLocalSearchParams<{
        issueId?: string;
        issueName?: string;
        imageUrl?: string;
        description?: string;
        eventId?: string;
        isNew?: string;
        isDraft?: string;
        beforeImageUri?: string;
        afterImageUri?: string;
    }>();

    // A brand new issue carries a placeholder id until its Trello card exists.
    const initialCardId = isNew === "true" ? null : (issueId ?? null);
    const initial = parseDescription(description ?? "");

    const [event, setEvent] = useState<Event | null>(null);
    const [cardId, setCardId] = useState<string | null>(initialCardId);
    const [name, setName] = useState(issueName ?? "");
    const [notes, setNotes] = useState(initial.notes);
    const [metrics, setMetrics] = useState(initial.metrics);
    const [savedName, setSavedName] = useState(issueName ?? "");
    const [savedNotes, setSavedNotes] = useState(initial.notes);
    const [savedMetrics, setSavedMetrics] = useState(initial.metrics);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { issuePhotos, flush } = usePhotoQueue(eventId);
    const queued = issuePhotos[cardId ?? issueId ?? ""] ?? {};
    const isUnsaved = cardId === null;
    const photosLocked = isDraft === "true";

    // The upload queue is the source of truth for photos taken during an
    // event; the uri params stay supported for callers that still hand a
    // local uri over directly.
    const photoUri = (slot: PhotoSlot): string | undefined => {
        if (queued[slot]) return queued[slot].uri;
        const param = slot === "before" ? beforeImageUri : afterImageUri;
        return param || undefined;
    };

    // Uploads are useless without the proxy, so probe it once on open rather
    // than letting a misconfigured build fail silently at upload time.
    useEffect(() => {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) {
            console.warn(
                "EXPO_PUBLIC_BACKEND_URL is not set; photo uploads will fail.",
            );
            return;
        }
        fetch(backendUrl).catch((e: unknown) =>
            console.warn("Backend unreachable:", getErrorMessage(e)),
        );
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                if (eventId) {
                    const loadedEvent = await getEventById(eventId);
                    if (cancelled) return;
                    if (!loadedEvent) throw new Error("Event not found.");
                    setEvent(loadedEvent);
                }
                // The drafts screen already hands over the card description;
                // from anywhere else read it back so previously saved notes
                // and metrics show up instead of an empty form.
                if (!description && initialCardId && API_KEY) {
                    const card =
                        await getTrelloClient(API_KEY).getCard(initialCardId);
                    if (cancelled) return;
                    const existing = parseDescription(card.desc ?? "");
                    setNotes(existing.notes);
                    setMetrics(existing.metrics);
                    setSavedNotes(existing.notes);
                    setSavedMetrics(existing.metrics);
                    setName(card.name);
                    setSavedName(card.name);
                }
            } catch (e) {
                if (!cancelled) setError(getErrorMessage(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [eventId, initialCardId, description]);

    // Photos attach to a card, so an unsaved issue has to become one first.
    // Shared by Save and by the camera so either entry point can create it.
    const ensureIssueCard = useCallback(async (): Promise<string | null> => {
        if (cardId) return cardId;
        if (!API_KEY) {
            setError("Trello API key is missing.");
            return null;
        }
        if (!name.trim() || !event) {
            setError("Event data is still loading. Please try again.");
            return null;
        }
        const newCardId = await createIssueCard(
            name.trim(),
            notes,
            metrics,
            event.trelloCardId,
            API_KEY,
        );
        setCardId(newCardId);
        setSavedName(name.trim());
        setSavedNotes(notes);
        setSavedMetrics(metrics);
        return newCardId;
    }, [cardId, event, name, notes, metrics]);

    const handleSave = useCallback(async () => {
        if (!API_KEY) {
            setError("Trello API key is missing.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (isUnsaved) {
                if (!(await ensureIssueCard())) return;
            } else if (cardId) {
                // Only send the description when it actually changed, so a
                // rename cannot wipe notes written on the Trello card itself.
                const descriptionChanged =
                    notes !== savedNotes || metrics !== savedMetrics;
                await updateIssueCard(
                    cardId,
                    name,
                    API_KEY,
                    descriptionChanged ? notes : undefined,
                    descriptionChanged ? metrics : undefined,
                );
                setSavedName(name);
                setSavedNotes(notes);
                setSavedMetrics(metrics);
            }
            router.back();
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setSaving(false);
        }
    }, [
        isUnsaved,
        ensureIssueCard,
        cardId,
        name,
        notes,
        metrics,
        savedNotes,
        savedMetrics,
        router,
    ]);

    const handlePhotoPress = async (slot: PhotoSlot) => {
        if (!event) {
            Alert.alert("Not ready", "Event data is still loading.");
            return;
        }
        let activeId: string | null;
        try {
            activeId = await ensureIssueCard();
        } catch (e) {
            Alert.alert("Failed to save issue", getErrorMessage(e));
            return;
        }
        if (!activeId) {
            Alert.alert(
                "Name this issue first",
                "Add a name so the photo has somewhere to attach.",
            );
            return;
        }

        router.push({
            pathname: "/camera-view",
            params: {
                activeIssueId: activeId,
                issueName: name,
                mode: slot,
                beforeImageUri: photoUri("before") ?? "",
                eventId: event.eventId,
                albumId: event.albumId,
            },
        });
    };

    const photoCaption = (slot: PhotoSlot): string | undefined => {
        const photo = queued[slot];
        if (!photo) return undefined;
        if (photo.status === "uploaded") return "Uploaded";
        if (photo.status === "failed") return "Upload failed — tap Retry";
        return "Waiting to upload";
    };

    // Derived rather than hardcoded: an issue is done once both photos exist.
    const status = isUnsaved
        ? "Not saved"
        : photoUri("before") && photoUri("after")
          ? "Complete"
          : photoUri("before")
            ? "In Progress"
            : "Not started";

    const failedPhotos = [queued.before, queued.after].filter(
        (photo) => photo?.status === "failed",
    ).length;

    const dirty =
        isUnsaved ||
        name !== savedName ||
        notes !== savedNotes ||
        metrics !== savedMetrics;
    const saveReady = isUnsaved
        ? !!(name.trim() && event)
        : !!(name.trim() && cardId);

    if (loading) {
        return (
            <View style={styles.screen}>
                <Stack.Screen options={{ headerShown: false }} />
                <HomeHeader />
                <ActivityIndicator style={styles.loader} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* App Header — outside the ScrollView so it stays put */}
            <HomeHeader />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}>
                {/* Cover Image */}
                <View style={styles.coverContainer}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.coverImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.coverPlaceholder} />
                    )}

                    {/* Back button overlaid on image */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                        accessibilityLabel="Go back"
                        accessibilityRole="button">
                        <Feather
                            name="chevron-left"
                            size={22}
                            color="#ffffff"
                        />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Status badge */}
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{status}</Text>
                    </View>

                    {/* Issue title */}
                    <TextInput
                        style={styles.issueTitleInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Issue name"
                        placeholderTextColor="#B0A8C0"
                    />

                    {/* PHOTOS */}
                    <Text style={styles.sectionLabel}>PHOTOS</Text>
                    <View style={styles.photoRow}>
                        <PhotoCard
                            label="Before"
                            uri={photoUri("before")}
                            caption={photoCaption("before")}
                            locked={photosLocked}
                            onPress={() => {
                                handlePhotoPress("before").catch(
                                    (e: unknown) => setError(getErrorMessage(e)),
                                );
                            }}
                        />
                        <PhotoCard
                            label="After"
                            uri={photoUri("after")}
                            caption={photoCaption("after")}
                            locked={photosLocked}
                            onPress={() => {
                                handlePhotoPress("after").catch((e: unknown) =>
                                    setError(getErrorMessage(e)),
                                );
                            }}
                        />
                    </View>

                    {failedPhotos > 0 && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                flush().catch((e: unknown) =>
                                    setError(getErrorMessage(e)),
                                );
                            }}>
                            <Feather
                                name="upload-cloud"
                                size={16}
                                color="#fff"
                            />
                            <Text style={styles.retryButtonText}>
                                Retry {failedPhotos} failed upload
                                {failedPhotos === 1 ? "" : "s"}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* NOTES */}
                    <Text style={styles.sectionLabel}>NOTES</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Start documenting the issue"
                        placeholderTextColor="#B0A8C0"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        textAlignVertical="top"
                    />

                    {/* METRICS */}
                    <Text style={styles.sectionLabel}>METRICS</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Metric #1"
                        placeholderTextColor="#B0A8C0"
                        value={metrics}
                        onChangeText={setMetrics}
                        multiline
                        textAlignVertical="top"
                    />

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    {(isNew === "true" || issueId) && (
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                (!saveReady || !dirty || saving) &&
                                    styles.saveButtonDisabled,
                            ]}
                            onPress={() => {
                                handleSave().catch((e: unknown) =>
                                    setError(getErrorMessage(e)),
                                );
                            }}
                            disabled={!saveReady || !dirty || saving}>
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {isUnsaved ? "Create issue" : "Save Issue"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const PURPLE = "#8A6BAD";
const PURPLE_LIGHT = "#FAF8FC";
const PURPLE_BORDER = "#C4B4D7";

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    scroll: {
        flex: 1,
    },
    coverContainer: {
        width: SCREEN_WIDTH,
        height: 220,
        backgroundColor: "#E0D8F0",
    },
    coverImage: {
        width: "100%",
        height: "100%",
    },
    coverPlaceholder: {
        width: "100%",
        height: "100%",
        backgroundColor: "#C8BEE0",
    },
    backButton: {
        position: "absolute",
        top: 16,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#3ba34c",
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    statusBadge: {
        alignSelf: "flex-start",
        backgroundColor: "#FFF3E0",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 10,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#E67E00",
    },
    issueTitleInput: {
        fontSize: 22,
        fontWeight: "700",
        color: "#1A1A2E",
        marginBottom: 24,
        lineHeight: 28,
        borderBottomWidth: 1.5,
        borderBottomColor: PURPLE_BORDER,
        paddingBottom: 4,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.2,
        color: "#888",
        marginBottom: 12,
    },
    photoRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 24,
    },
    photoCard: {
        flex: 1,
        aspectRatio: 1.5,
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: PURPLE_BORDER,
        overflow: "hidden",
    },
    photoPlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    photoLabel: {
        fontSize: 14,
        color: PURPLE,
        fontWeight: "500",
    },
    photoImage: {
        width: "100%",
        height: "100%",
    },
    photoStatus: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#00000099",
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    photoStatusText: {
        color: "#fff",
        fontSize: 11,
        textAlign: "center",
    },
    cameraIcon: {
        width: 28,
        height: 28,
        resizeMode: "contain",
    },
    textInput: {
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: PURPLE_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: "#1A1A2E",
        minHeight: 100,
        lineHeight: 22,
        marginBottom: 24,
    },
    retryButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#B3261E",
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 24,
    },
    retryButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    saveButton: {
        backgroundColor: PURPLE,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    errorText: {
        color: "#B3261E",
        fontSize: 14,
        marginBottom: 12,
    },
    loader: {
        flex: 1,
    },
});
