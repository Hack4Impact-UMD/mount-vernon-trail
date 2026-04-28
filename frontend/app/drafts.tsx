import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { getDraftEvents } from "@/services/event-service";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

function formatSavedAt(event: Event): string {
    const ts = event.savedAsDraftAt ?? event.endDate ?? null;
    if (!ts) return "";
    return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function DraftsScreen() {
    const router = useRouter();
    const [drafts, setDrafts] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            setLoading(true);
            setError(null);
            getDraftEvents()
                .then((d) => {
                    if (!cancelled) setDrafts(d);
                })
                .catch((e) => {
                    if (!cancelled) setError((e as Error).message);
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
            return () => {
                cancelled = true;
            };
        }, []),
    );

    return (
        <View style={styles.screen}>
            <HomeHeader />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Drafts</Text>

                {loading && <ActivityIndicator style={styles.loader} />}

                {error && <Text style={styles.errorText}>{error}</Text>}

                {!loading && !error && drafts.length === 0 && (
                    <Text style={styles.emptyText}>
                        No drafts yet. Drafts will appear here after you end an
                        event without publishing.
                    </Text>
                )}

                {drafts.map((draft) => (
                    <Pressable
                        key={draft.eventId}
                        style={styles.row}
                        onPress={() =>
                            router.push({
                                pathname: "/edit-draft",
                                params: { eventId: draft.eventId },
                            })
                        }>
                        <View style={styles.rowIcon}>
                            <Feather
                                name="file-text"
                                size={20}
                                color={Palette.primaryPurple100}
                            />
                        </View>
                        <View style={styles.rowBody}>
                            <Text
                                style={styles.rowTitle}
                                numberOfLines={1}>
                                {draft.title}
                            </Text>
                            <Text style={styles.rowSubtitle}>
                                Saved {formatSavedAt(draft)}
                            </Text>
                        </View>
                        <Feather
                            name="chevron-right"
                            size={20}
                            color="#A9A9A9"
                        />
                    </Pressable>
                ))}
            </ScrollView>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 12 },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
        marginBottom: 8,
    },
    loader: { marginTop: 40 },
    emptyText: {
        fontSize: 14,
        color: "#888",
        textAlign: "center",
        marginTop: 40,
        paddingHorizontal: 24,
        lineHeight: 20,
    },
    errorText: {
        color: "#c0392b",
        fontSize: 14,
        textAlign: "center",
        marginTop: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: "#F0F0F5",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    rowIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#69389418",
    },
    rowBody: { flex: 1 },
    rowTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    rowSubtitle: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
        fontFamily: "Lato_400Regular",
    },
});
