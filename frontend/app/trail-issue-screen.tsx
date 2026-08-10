import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import HomeHeader from "@/components/ui/header";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { getEventById, type Event } from "@/services/event-service";
import {
    createTrailIssue,
    extractIssueNotes,
    saveIssueNotes,
} from "@/services/trello-service";
import { getTrelloClient } from "@/services/trello-config";
import { getErrorMessage } from "@/utils/errors";
import type { PhotoSlot } from "@/services/photo-queue";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";

function PhotoCard({
    label,
    uri,
    caption,
    onPress,
}: {
    label: string;
    uri?: string;
    caption?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.photoCard}
            onPress={onPress}
            activeOpacity={0.75}
            accessibilityLabel={`${label} photo`}
            accessibilityRole="button"
        >
            {uri ? (
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
                        style={styles.cameraIcon}
                    />
                    <Text style={styles.photoLabel}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function TrailIssueDetailScreen() {
    const router = useRouter();
    const { issueId, issueName, imageUrl, eventId, isNew } = useLocalSearchParams<{
        issueId?: string;
        issueName?: string;
        imageUrl?: string;
        eventId?: string;
        isNew?: string;
    }>();

    const [event, setEvent] = useState<Event | null>(null);
    const [notes, setNotes] = useState("");
    const [savedNotes, setSavedNotes] = useState("");
    const [cardId, setCardId] = useState(isNew === "true" ? null : (issueId ?? null));
    const [name, setName] = useState(issueName ?? "New issue");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { issuePhotos, flush } = usePhotoQueue(eventId);
    const photos = issuePhotos[issueId ?? ""] ?? {};

    // A brand new issue has no Trello card yet, so there is nothing to load and
    // nothing to photograph until it is created.
    const isUnsaved = cardId === null;

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                if (!eventId) throw new Error("No event id provided.");
                const loadedEvent = await getEventById(eventId);
                if (!loadedEvent) throw new Error("Event not found.");
                if (cancelled) return;
                setEvent(loadedEvent);

                if (cardId && API_KEY) {
                    const card = await getTrelloClient(API_KEY).getCard(cardId);
                    if (cancelled) return;
                    const existing = extractIssueNotes(card.desc ?? "");
                    setNotes(existing);
                    setSavedNotes(existing);
                    setName(card.name);
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
    }, [eventId, cardId]);

    const handleSave = useCallback(async () => {
        if (!event) return;
        if (!API_KEY) {
            setError("Missing Trello API credentials.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (isUnsaved) {
                const created = await createTrailIssue(
                    event.trelloCardId,
                    name.trim() || "New issue",
                    notes.trim(),
                    API_KEY,
                );
                setCardId(created.cardId);
            } else if (cardId) {
                await saveIssueNotes(cardId, notes, API_KEY);
            }
            setSavedNotes(notes);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setSaving(false);
        }
    }, [event, isUnsaved, cardId, name, notes]);

    const handlePhotoPress = (slot: PhotoSlot) => {
        if (isUnsaved) {
            Alert.alert(
                "Save this issue first",
                "Add a name and tap Save so the photo has somewhere to attach.",
            );
            return;
        }
        if (!event) return;
        router.push({
            pathname: "/camera-view",
            params: {
                activeIssueId: issueId,
                issueName: name,
                mode: slot,
                beforeImageUri: photos.before?.uri ?? "",
                eventId: event.eventId,
                albumId: event.albumId,
            },
        });
    };

    const photoCaption = (slot: PhotoSlot): string | undefined => {
        const photo = photos[slot];
        if (!photo) return undefined;
        if (photo.status === "uploaded") return "Uploaded";
        if (photo.status === "failed") return "Upload failed — tap Retry";
        return "Waiting to upload";
    };

    // Derived rather than hardcoded: an issue is done once both photos exist.
    const status = isUnsaved
        ? "Not saved"
        : photos.before && photos.after
          ? "Complete"
          : photos.before
            ? "In Progress"
            : "Not started";

    const dirty = notes !== savedNotes || isUnsaved;
    const failedPhotos = [photos.before, photos.after].filter(
        (photo) => photo?.status === "failed",
    ).length;

    if (loading) return <ActivityIndicator style={styles.loader} />;

    return (
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                style={styles.scroll}
				contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}>
				{/* App Header */}
				<HomeHeader />
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
                        accessibilityRole="button"
                    >
                        <Feather name="chevron-left" size={22} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Status badge */}
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{status}</Text>
                    </View>

                    {/* Issue title */}
                    {isUnsaved ? (
                        <TextInput
                            style={styles.titleInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Name this issue"
                            placeholderTextColor="#B0A8C0"
                        />
                    ) : (
                        <Text style={styles.issueTitle}>{name}</Text>
                    )}

                    {/* PHOTOS */}
                    <Text style={styles.sectionLabel}>PHOTOS</Text>
                    <View style={styles.photoRow}>
                        <PhotoCard
                            label="Before"
                            uri={photos.before?.uri}
                            caption={photoCaption("before")}
                            onPress={() => handlePhotoPress("before")}
                        />
                        <PhotoCard
                            label="After"
                            uri={photos.after?.uri}
                            caption={photoCaption("after")}
                            onPress={() => handlePhotoPress("after")}
                        />
                    </View>

                    {failedPhotos > 0 && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                flush().catch((e: unknown) =>
                                    setError(getErrorMessage(e)),
                                );
                            }}
                        >
                            <Feather name="upload-cloud" size={16} color="#fff" />
                            <Text style={styles.retryButtonText}>
                                Retry {failedPhotos} failed upload
                                {failedPhotos === 1 ? "" : "s"}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* NOTEPAD */}
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

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!dirty || saving) && styles.saveButtonDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>
                                {isUnsaved ? "Create issue" : "Save notes"}
                            </Text>
                        )}
                    </TouchableOpacity>
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
    issueTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#1A1A2E",
        marginBottom: 24,
        lineHeight: 28,
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
    titleInput: {
        fontSize: 22,
        fontWeight: "700",
        color: "#1A1A2E",
        marginBottom: 24,
        borderBottomWidth: 1.5,
        borderBottomColor: PURPLE_BORDER,
        paddingBottom: 6,
    },
    loader: {
        flex: 1,
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
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 24,
    },
    saveButtonDisabled: {
        opacity: 0.5,
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
});