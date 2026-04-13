import { createEvent } from "@/services/event-service";
import { createGoogleAlbum } from "@/services/googlePhotosAlbumsService";
import { addAlbumLinkToCard, createEventCard } from "@/services/trello-service";
import { getDateString, parseAndValidateDate } from "@/utils/date";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

const TRELLO_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";

export default function SetupEventScreen() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dateStr, setDateStr] = useState("");

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!title.trim()) {
            setError("Event title is required.");
            return;
        }
        if (!dateStr.trim()) {
            setError("Event date is required.");
            return;
        }
        const eventDate = parseAndValidateDate(dateStr.trim());
        if (!eventDate) {
            setError("Invalid date. Use MM/DD/YYYY format.");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            // creates a Google Photos Album
            const album = await createGoogleAlbum(title.trim());
            const albumUrl = album.productUrl ?? "";

            // creates a trello card and adds it to the Scheduled Events list
            const { cardId, cardUrl } = await createEventCard(
                title.trim(),
                getDateString(eventDate),
                description.trim(),
                TRELLO_KEY,
            );

            // adds the album link to the trello card
            await addAlbumLinkToCard(
                cardId,
                albumUrl,
                TRELLO_KEY,
            );

            // creates an event document in firebase
            await createEvent(
                title.trim(),
                description.trim(),
                eventDate,
                cardId,
                album.id,
                albumUrl,
            );

            Alert.alert("Event Created", `"${title.trim()}" has been set up!`, [
                { text: "Open Trello Card", onPress: () => Linking.openURL(cardUrl) },
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Set Up New Event</Text>

                <Text style={styles.label}>Event Title</Text>
                <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Cleanup"
                    placeholderTextColor="#aaa"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.multiline]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Event description"
                    placeholderTextColor="#aaa"
                    multiline
                    numberOfLines={3}
                />

                <Text style={styles.label}>Date (MM/DD/YYYY)</Text>
                <TextInput
                    style={styles.input}
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="e.g. 04/15/2025"
                    placeholderTextColor="#aaa"
                    keyboardType="numbers-and-punctuation"
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                    style={[
                        styles.createButton,
                        creating && styles.createButtonDisabled,
                    ]}
                    onPress={handleCreate}
                    disabled={creating}>
                    {creating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>
                            Create Event
                        </Text>
                    )}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        padding: 24,
        paddingBottom: 48,
    },
    heading: {
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
        marginTop: 20,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: "#000",
    },
    multiline: {
        height: 80,
        textAlignVertical: "top",
    },
    error: {
        color: "#c0392b",
        fontSize: 14,
        marginTop: 16,
        textAlign: "center",
    },
    createButton: {
        marginTop: 32,
        backgroundColor: "#0a7ea4",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    createButtonDisabled: {
        opacity: 0.6,
    },
    createButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
});
