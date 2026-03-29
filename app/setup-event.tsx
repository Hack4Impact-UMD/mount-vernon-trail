import { createEvent } from "@/services/event-service";
import { createGoogleAlbum } from "@/services/googlePhotosAlbumsService";
import { addAlbumLinkToCard, createEventCard } from "@/services/trello-service";
import { getDateString, parseAndValidateDate } from "@/utils/date";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

const TRELLO_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";
const TRELLO_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN ?? "";

export default function SetupEventScreen() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dateStr, setDateStr] = useState("");

    const [emailInput, setEmailInput] = useState("");
    const [associatedEmails, setAssociatedEmails] = useState<string[]>([]);

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addEmail = () => {
        const trimmed = emailInput.trim().toLowerCase();
        if (!trimmed) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError("Please enter a valid email address.");
            return;
        }
        if (associatedEmails.includes(trimmed)) {
            setError("That email has already been added.");
            return;
        }
        setAssociatedEmails((prev) => [...prev, trimmed]);
        setEmailInput("");
        setError(null);
    };

    const removeEmail = (email: string) => {
        setAssociatedEmails((prev) => prev.filter((e) => e !== email));
    };

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
            const cardId = await createEventCard(
                title.trim(),
                getDateString(eventDate),
                description.trim(),
                TRELLO_KEY,
                TRELLO_TOKEN,
            );

            // adds the album link to the trello card
            await addAlbumLinkToCard(
                cardId,
                albumUrl,
                TRELLO_KEY,
                TRELLO_TOKEN,
            );

            // creates an event document in firebase
            await createEvent(
                title.trim(),
                description.trim(),
                eventDate,
                cardId,
                album.id,
                albumUrl,
                associatedEmails,
            );

            Alert.alert("Event Created", `"${title.trim()}" has been set up!`, [
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

                <Text style={styles.label}>Associated Volunteers</Text>
                <View style={styles.emailRow}>
                    <TextInput
                        style={styles.emailInput}
                        value={emailInput}
                        onChangeText={setEmailInput}
                        placeholder="volunteer@email.com"
                        placeholderTextColor="#aaa"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onSubmitEditing={addEmail}
                        returnKeyType="done"
                    />
                    <Pressable style={styles.addButton} onPress={addEmail}>
                        <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                </View>
                {associatedEmails.map((email: string) => (
                    <View key={email} style={styles.emailChip}>
                        <Text style={styles.emailChipText}>{email}</Text>
                        <Pressable onPress={() => removeEmail(email)}>
                            <Text style={styles.emailChipRemove}>×</Text>
                        </Pressable>
                    </View>
                ))}

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
    emailRow: {
        flexDirection: "row",
        gap: 8,
    },
    emailInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: "#000",
    },
    addButton: {
        backgroundColor: "#0a7ea4",
        paddingHorizontal: 16,
        borderRadius: 8,
        justifyContent: "center",
    },
    addButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
    },
    emailChip: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#0a7ea4",
        backgroundColor: "#e8f4f8",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 6,
    },
    emailChipText: {
        fontSize: 14,
        color: "#0a7ea4",
    },
    emailChipRemove: {
        fontSize: 18,
        color: "#0a7ea4",
        lineHeight: 20,
        paddingLeft: 8,
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
