import AlertPopup from "@/components/ui/alert-popup";
import HomeHeader from "@/components/ui/header";
import IssueMapPreview from "@/components/ui/map/issue-map-preview";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { getEventById, type Event } from "@/services/event-service";
import type { PhotoSlot, QueuedPhoto } from "@/services/photo-queue";
import { getTrelloClient } from "@/services/trello-config";
import { createIssueCard, updateIssueCard } from "@/services/trello-service";
import { getErrorMessage } from "@/utils/errors";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
	Image,
	Linking,
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
        source,
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
        source?: string;
    }>();

    // A brand new issue carries a placeholder id until its Trello card exists.
    const initialCardId = isNew === "true" ? null : (issueId ?? null);
    const initial = parseDescription(description ?? "");

    const [eventReload, setEventReload] = useState(0);
    const [eventResult, setEventResult] = useState<{
        eventId: string;
        attempt: number;
        event: Event | null;
        error: string | null;
    } | null>(null);
    const currentEventResult =
        eventResult?.eventId === eventId && eventResult?.attempt === eventReload
            ? eventResult
            : null;
    const event = currentEventResult?.event ?? null;
    const eventLoading = Boolean(eventId && !currentEventResult);
    const eventError = currentEventResult?.error ?? null;
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
    const [alert, setAlert] = useState<{
        title: string;
        message: string;
    } | null>(null);

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

    // Map issues have no event context. Never silently attach their photos
    // to some other active event; the volunteer must open the intended event.
    useEffect(() => {
        let cancelled = false;
        if (!eventId) return;
        getEventById(eventId)
            .then((loadedEvent) => {
                if (cancelled) return;
                setEventResult({
                    eventId,
                    attempt: eventReload,
                    event: loadedEvent,
                    error: loadedEvent
                        ? null
                        : "This event could not be found. Return home and reopen your event.",
                });
            })
            .catch((error: unknown) => {
                if (!cancelled)
                    setEventResult({
                        eventId,
                        attempt: eventReload,
                        event: null,
                        error: `Could not load this event: ${getErrorMessage(error)}`,
                    });
            });
        return () => {
            cancelled = true;
        };
    }, [eventId, eventReload]);

    const photoBlockReason = !eventId
        ? "To add photos, open this issue from an event’s Document Trail screen."
        : eventLoading
          ? "Loading event details. Please try again shortly."
          : (eventError ??
            (!event
                ? "This event is unavailable. Return home and reopen it."
                : !event.albumId
                  ? "This event has no photo album. Contact your event organizer for help."
                  : null));

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
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
        if (!name.trim()) {
            setError("Add an issue name first.");
            return null;
        }
        if (!event) {
            setError(photoBlockReason ?? "This event is unavailable.");
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
    }, [cardId, event, name, notes, metrics, photoBlockReason]);

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
        if (photoBlockReason || !event) {
            Alert.alert(
                "Photo capture unavailable",
                photoBlockReason ?? "This event is unavailable.",
            );
            return;
        }
        let activeId: string | null;
        try {
            activeId = await ensureIssueCard();
        } catch (e) {
            setAlert({
                title: "Failed to save issue",
                message: getErrorMessage(e),
            });
            return;
        }
        if (!activeId) {
            setAlert({
                title: "Missing name",
                message: "Add a name so the photo has somewhere to attach.",
            });
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
        if (photo.status === "failed") return "Upload needs attention";
        if (photo.status === "unconfirmed") return "Upload not confirmed";
        return photo.retryAt
            ? "Saved — retrying automatically"
            : "Waiting to upload";
    };

    // Derived rather than hardcoded: an issue is done once both photos exist.
    const status = isUnsaved
        ? "Not saved"
        : photoUri("before") && photoUri("after")
          ? "Photos captured"
          : photoUri("before")
            ? "In Progress"
            : "Not started";

    const failed = [queued.before, queued.after].filter(
        (photo): photo is QueuedPhoto =>
            photo?.status !== "uploaded" && !!photo?.error,
    );
    const failedPhotos = failed.filter(
        (photo) => photo.status === "failed" || photo.status === "unconfirmed",
    ).length;
    const hasUnconfirmed = failed.some(
        (photo) => photo.status === "unconfirmed",
    );
    // The thumbnail caption has no room for the reason, and without it every
    // failure — offline, signed out, Google rejecting the album — looked alike.
    const uploadErrors = [
        ...new Set(failed.map((photo) => photo.error ?? "Upload failed")),
    ];

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
            <AlertPopup
                visible={alert !== null}
                title={alert?.title ?? ""}
                message={alert?.message ?? ""}
                onClose={() => setAlert(null)}
            />
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
                    {!photosLocked && photoBlockReason && (
                        <View
                            accessibilityRole="alert"
                            style={styles.eventNotice}>
                            <Feather
                                name="info"
                                size={20}
                                color={PURPLE}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.eventNoticeTitle}>
                                    {eventLoading
                                        ? "Loading event…"
                                        : !eventId
                                          ? "Open an event to add photos"
                                          : "Photos unavailable"}
                                </Text>
                                <Text style={styles.eventNoticeText}>
                                    {photoBlockReason}
                                </Text>
                                {!eventLoading && (
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        style={styles.eventNoticeAction}
                                        onPress={() =>
                                            eventId && !event
                                                ? setEventReload(
                                                      (value) => value + 1,
                                                  )
                                                : router.replace("/home-screen")
                                        }>
                                        <Text
                                            style={
                                                styles.eventNoticeActionText
                                            }>
                                            {eventId && !event
                                                ? "Retry loading event"
                                                : "Go to Home"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                    <View style={styles.photoRow}>
                        <PhotoCard
                            label="Before"
                            uri={photoUri("before")}
                            caption={photoCaption("before")}
                            locked={photosLocked}
                            onPress={() => {
                                handlePhotoPress("before").catch((e: unknown) =>
                                    setError(getErrorMessage(e)),
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

                    {source !== "map" && failedPhotos > 0 && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                const retry = () =>
                                    flush(
                                        failed
                                            .filter(
                                                (photo) =>
                                                    photo.status ===
                                                    "unconfirmed",
                                            )
                                            .map((photo) => photo.id),
                                    ).catch((e: unknown) =>
                                        setError(getErrorMessage(e)),
                                    );
                                if (hasUnconfirmed) {
                                    Alert.alert(
                                        "Check the album first",
                                        "These photos may already be uploaded. Retrying can create duplicates. Only retry if they are missing from the album.",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Retry anyway",
                                                onPress: () => {
                                                    void retry();
                                                },
                                            },
                                        ],
                                    );
                                } else {
                                    void retry();
                                }
                            }}>
                            <Feather
                                name="upload-cloud"
                                size={16}
                                color="#fff"
                            />
                            <Text style={styles.retryButtonText}>
                                Retry {failedPhotos} upload
                                {failedPhotos === 1 ? "" : "s"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {uploadErrors.length > 0 && (
                        <View
                            accessibilityRole="alert"
                            accessibilityLiveRegion="polite"
                            style={styles.uploadAlert}>
                            <Feather
                                name="alert-circle"
                                size={22}
                                color="#805500"
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.uploadAlertTitle}>
                                    {hasUnconfirmed
                                        ? "Check your photo album"
                                        : failedPhotos > 0
                                          ? "Photo uploads need attention"
                                          : "Photos saved — waiting to retry"}
                                </Text>
                                <Text style={styles.uploadAlertText}>
                                    {failedPhotos > 0
                                        ? "Upload not confirmed. Check the album before retrying."
                                        : "Keep this event open. Uploads retry automatically when the connection or Google Photos recovers."}
                                </Text>
                                {hasUnconfirmed && event?.albumUrl && (
                                    <TouchableOpacity
                                        accessibilityRole="link"
                                        style={styles.eventNoticeAction}
                                        onPress={() => {
                                            void Linking.openURL(
                                                event.albumUrl,
                                            ).catch(() =>
                                                setError(
                                                    "Could not open the photo album.",
                                                ),
                                            );
                                        }}>
                                        <Text
                                            style={
                                                styles.eventNoticeActionText
                                            }>
                                            Open Google Photos album
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {uploadErrors.map((message) => (
                                    <Text
                                        key={message}
                                        style={styles.uploadAlertText}>
                                        {message}
                                    </Text>
                                ))}
                            </View>
                        </View>
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

                    {cardId && <IssueMapPreview issueId={cardId} />}

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
        backgroundColor: PURPLE,
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
    eventNotice: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 14,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: PURPLE_BORDER,
        backgroundColor: PURPLE_LIGHT,
    },
    eventNoticeTitle: {
        fontFamily: "Lato_700Bold",
        color: PURPLE,
        fontSize: 15,
        lineHeight: 20,
    },
    eventNoticeText: {
        fontFamily: "Lato_400Regular",
        color: "#51485D",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    eventNoticeAction: {
        alignSelf: "flex-start",
        justifyContent: "center",
        minHeight: 44,
        marginTop: 4,
    },
    eventNoticeActionText: {
        fontFamily: "Lato_700Bold",
        color: PURPLE,
        fontSize: 14,
    },
    uploadAlert: {
        flexDirection: "row",
        gap: 10,
        padding: 14,
        marginVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E7CB85",
        backgroundColor: "#FFF8E6",
    },
    uploadAlertTitle: {
        fontFamily: "Lato_700Bold",
        color: "#624500",
        fontSize: 15,
        marginBottom: 4,
    },
    uploadAlertText: {
        fontFamily: "Lato_400Regular",
        color: "#624500",
        fontSize: 14,
        marginTop: 3,
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
