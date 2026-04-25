import { extractStats, getEventById, updateEventStats } from "@/services/event-service";
import type { StatsData } from "@/types/trail-types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

// fully temporary screen cause we dont have the ui for metrics yet but needed to test

const FIELDS: { key: keyof StatsData; label: string }[] = [
    { key: "trailImprovements", label: "Trail Improvements" },
    { key: "drainage", label: "Drainage" },
    { key: "graffiti", label: "Graffiti" },
    { key: "stickers", label: "Stickers" },
    { key: "otherImprovements", label: "Other Improvements" },
    { key: "painting", label: "Painting" },
    { key: "pressureWashing", label: "Pressure Washing" },
    { key: "repairs", label: "Repairs" },
    { key: "safetyImprovements", label: "Safety Improvements" },
    { key: "potholes", label: "Potholes" },
    { key: "trash", label: "Trash" },
    { key: "trees", label: "Trees" },
    { key: "vegetationImprovements", label: "Vegetation Improvements" },
];

export default function MockStatisticsScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [values, setValues] = useState<
        Partial<Record<keyof StatsData, string>>
    >({});
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!eventId) return Alert.alert("Error", "No event ID.");
        setSaving(true);
        try {
            const stats: Partial<StatsData> = {};
            for (const { key } of FIELDS) {
                const n = parseInt(values[key] ?? "0", 10);
                (stats as Record<string, number>)[key] = isNaN(n) ? 0 : Math.max(0, n);
            }
            await updateEventStats(eventId, stats);
            router.back();
        } catch (e) {
            Alert.alert("Error", (e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const loadInitialValues = useCallback(async () => {
        if (!eventId) return Alert.alert("Error", "No event ID.");
        setLoading(true);
        try {
            const event = await getEventById(eventId);
            if (event === null) return Alert.alert("Error", "Event not found.");
            const stats = extractStats(event);
            const formattedStats: Partial<Record<keyof StatsData, string>> = {};
            for (const { key } of FIELDS) {
                formattedStats[key] = stats[key]?.toString() ?? "0";
            }
            setValues(formattedStats);
        } catch (e) {
            Alert.alert("Error", (e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        loadInitialValues()
    }, [eventId, loadInitialValues]);

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.header}>
                <Text style={styles.title}>Mock Statistics</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled">
                {FIELDS.map(({ key, label }) => (
                    <View
                        key={key}
                        style={styles.row}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            placeholder="0"
                            value={values[key] ?? ""}
                            onChangeText={(v) =>
                                setValues((p) => ({ ...p, [key]: v }))
                            }
                        />
                    </View>
                ))}
            </ScrollView>
            <View style={styles.footer}>
                <Pressable
                    style={styles.cancelBtn}
                    onPress={() => router.back()}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={saving}>
                    <Text style={styles.saveText}>
                        {saving ? "Saving…" : "Save"}
                    </Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    header: {
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderColor: "#eee",
    },
    title: { fontSize: 18, fontWeight: "700", color: "#111" },
    subtitle: { fontSize: 12, color: "#999", marginTop: 2 },
    list: { padding: 20, gap: 12 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    label: { fontSize: 14, color: "#333", flex: 1 },
    input: {
        width: 64,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        textAlign: "center",
        fontSize: 16,
        padding: 8,
    },
    footer: {
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderColor: "#eee",
    },
    cancelBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#ddd",
        alignItems: "center",
    },
    cancelText: { fontSize: 15, color: "#555" },
    saveBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: "#693894",
        alignItems: "center",
    },
    saveText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
