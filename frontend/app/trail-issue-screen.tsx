import HomeHeader from "@/components/ui/header";
import { getEventById } from "@/services/event-service";
import { createIssueCard, updateIssueCard } from "@/services/trello-service";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

type PhotoSlot = "before" | "after";

export default function TrailIssueDetailScreen() {
    const router = useRouter();
    const {
        issueId,
        issueName,
        imageUrl,
        description,
        eventId,
        isNew,
        beforeImageUri,
        afterImageUri,
    } = useLocalSearchParams<{
        issueId?: string;
        issueName?: string;
        imageUrl?: string;
        description?: string;
        eventId?: string;
        isNew?: string;
        beforeImageUri?: string;
        afterImageUri?: string;
    }>();

    function parseDescription(desc: string) {
        const notesMatch = /Notes:\n([\s\S]*?)(?:\n\nMetrics:|$)/.exec(desc);
        const metricsMatch = /Metrics:\n([\s\S]*)$/.exec(desc);
        return {
            notes: notesMatch?.[1]?.trim() ?? "",
            metrics: metricsMatch?.[1]?.trim() ?? "",
        };
    }

    const parsed = description
        ? parseDescription(description)
        : { notes: "", metrics: "" };
    const initialNotes = parsed.notes;
    const initialMetrics = parsed.metrics;
    const [name, setName] = useState(issueName ?? "");
    const [notes, setNotes] = useState(initialNotes);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [trelloCardId, setTrelloCardId] = useState<string | null>(null);
    const [savedCardId, setSavedCardId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!eventId || isNew !== "true") return;
        getEventById(eventId)
            .then((ev) => {
                if (ev) setTrelloCardId(ev.trelloCardId);
            })
            .catch((e) => console.error("Failed to load event:", e));
    }, [eventId, isNew]);

    const saveReady =
        isNew === "true"
            ? !!(name.trim() && trelloCardId)
            : !!(name.trim() && issueId);

    const handleSave = async () => {
        const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
        if (!API_KEY) {
            Alert.alert("Configuration error", "Trello API key is missing.");
            return;
        }
        setSaving(true);
        try {
            if (isNew === "true" && !savedCardId) {
                if (!name.trim() || !trelloCardId) {
                    Alert.alert("Not ready", "Event data is still loading");
                    return;
                }
                const newCardId = await createIssueCard(
                    name.trim(),
                    notes,
                    metrics,
                    trelloCardId,
                    API_KEY,
                );
                setSavedCardId(newCardId);
            } else {
                const targetId = savedCardId ?? issueId;
                if (!targetId) {
                    Alert.alert("Not ready", "Issue ID is missing");
                    return;
                }
                const notesChanged =
                    notes !== initialNotes || metrics !== initialMetrics;
                await updateIssueCard(
                    targetId,
                    name,
                    API_KEY,
                    notesChanged ? notes : undefined,
                    notesChanged ? metrics : undefined,
                );
            }
            router.back();
        } catch (e) {
            Alert.alert("Failed to save issue", (e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const status = "In Progress"; // hardcoded for now
    const photos = { before: beforeImageUri, after: afterImageUri };

    const handlePhotoPress = async (slot: PhotoSlot) => {
        let activeId = savedCardId ?? issueId;

        if (isNew === "true" && !savedCardId) {
            const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
            if (!API_KEY) {
                Alert.alert("Configuration error", "Trello API key is missing.");
                return;
            }
            if (!name.trim() || !trelloCardId) {
                Alert.alert("Not ready", "Event data is still loading. Please try again.");
                return;
            }
            try {
                const newCardId = await createIssueCard(
                    name.trim(),
                    notes,
                    metrics,
                    trelloCardId,
                    API_KEY,
                );
                setSavedCardId(newCardId);
                activeId = newCardId;
            } catch (e) {
                Alert.alert("Failed to save issue", (e as Error).message);
                return;
            }
        }

        router.push({
            pathname: "/camera-view",
            params: {
                activeIssueId: activeId,
                mode: slot,
                beforeImageUri: beforeImageUri ?? "",
                eventId: eventId,
            },
        });
    };

    const PhotoCard = ({ slot, label }: { slot: PhotoSlot; label: string }) => (
        <TouchableOpacity
            style={styles.photoCard}
            onPress={() => handlePhotoPress(slot)}
            activeOpacity={0.75}
            accessibilityLabel={`${label} photo`}
            accessibilityRole="button">
            {photos[slot] ? (
                <Image
                    source={{ uri: photos[slot] as string }}
                    style={styles.photoImage}
                    resizeMode="cover"
                />
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

    return (
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            <HomeHeader />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}>
                {/* App Header */}
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
                            slot="before"
                            label="Before"
                        />
                        <PhotoCard
                            slot="after"
                            label="After"
                        />
                    </View>

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

                    {(isNew === "true" || issueId) && (
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                (!saveReady || saving) &&
                                    styles.saveButtonDisabled,
                            ]}
                            onPress={handleSave}
                            disabled={!saveReady || saving}>
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    Save Issue
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
    issueTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#1A1A2E",
        marginBottom: 24,
        lineHeight: 28,
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
});
