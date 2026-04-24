import React, { useState } from "react";
import {
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
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PhotoSlot = "before" | "after";

export default function TrailIssueDetailScreen() {
    const router = useRouter();
    const { issueId, issueName, imageUrl, eventId, beforeImageUri, afterImageUri } = useLocalSearchParams<{
		issueId?: string;
        issueName?: string;
		imageUrl?: string;
		eventId?: string;
        isNew?: string;
		beforeImageUri?: string;
		afterImageUri?: string;
    }>();
    const [notes, setNotes] = useState("");
    const [metrics, setMetrics] = useState("");

    const status = "In Progress"; // hardcoded for now
    const photos = { before: beforeImageUri, after: afterImageUri };

    const handlePhotoPress = (slot: PhotoSlot) => {
        router.push({
            pathname: "/camera-view",
            params: {
				activeIssueId: issueId,
                mode: slot,
                beforeImageUri: beforeImageUri ?? "",
				eventId: eventId
            },
        });
    };

    const PhotoCard = ({ slot, label }: { slot: PhotoSlot; label: string }) => (
        <TouchableOpacity
            style={styles.photoCard}
            onPress={() => handlePhotoPress(slot)}
            activeOpacity={0.75}
            accessibilityLabel={`${label} photo`}
            accessibilityRole="button"
        >
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
                    <Text style={styles.issueTitle}>{issueName}</Text>

                    {/* PHOTOS */}
                    <Text style={styles.sectionLabel}>PHOTOS</Text>
                    <View style={styles.photoRow}>
                        <PhotoCard slot="before" label="Before" />
                        <PhotoCard slot="after" label="After" />
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
});