import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Event, getDraftEvents } from "@/services/event-service";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";

const PLACEHOLDER_COVER_IMAGE = require("../assets/images/draft-placeholder.png");

function formatDate(value?: Timestamp): string {
    if (!value) return "";
    const d = value.toDate();
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function DraftCard({ event } : Readonly<{ event: Event }>) {
    return (
        <View style={styles.cardShadow}>
            <View style={styles.card}>
                <View style={styles.coverWrap}>
                    <Image
                        source={PLACEHOLDER_COVER_IMAGE}
                        style={styles.coverImage}
                        resizeMode="cover"
                    />
                </View>
                <View style={styles.cardFooter}>
                    <View style={styles.cardFooterLeft}>
                        <Text
                            style={styles.draftTitle}
                            numberOfLines={1}>
                            {event.title}
                        </Text>
                        <View style={styles.dateRow}>
                            <MaterialIcons
                                name="calendar-today"
                                size={14}
                                color="#6D6E71"
                            />
                            <Text style={styles.draftDate}>
                                {event.startDate ? formatDate(event.startDate) : ""}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default function DraftsScreen() {
    const isAdmin = useIsAdmin();
    const [draftEvents, setDraftEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadDraftEvents = useCallback(async () => {
        setError(null);
        try {
            const data = await getDraftEvents();
            setDraftEvents(data);
        } catch (e) {
            console.log((e as Error).message);
            setError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        // check if admin status undetermined
        if (isAdmin === null) return; 
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        // start loading drafts
        setLoading(true);
        loadDraftEvents().finally(() => setLoading(false));
    }, [loadDraftEvents, isAdmin]);

    const handleRefresh = useCallback(async () => {
        if (!isAdmin) return;
        setRefreshing(true);
        await loadDraftEvents();
        setRefreshing(false);
    }, [loadDraftEvents, isAdmin]);

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.centered}>
                    <ActivityIndicator
                        size="large"
                        color={Palette.primaryPurple100}
                    />
                </View>
            );
        }
        if (!isAdmin) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="lock-outline"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.emptyText}>
                        Drafts are only accessible to the admin account.
                    </Text>
                </View>
            );
        }
        if (error) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="error-outline"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable
                        style={styles.retryButton}
                        onPress={handleRefresh}>
                        <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                </View>
            );
        }
        if (draftEvents.length === 0) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="photo-library"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.emptyText}>No drafts yet.</Text>
                </View>
            );
        }
        return (
            <>
                {draftEvents.map((event) => (
                    <DraftCard
                        key={event.eventId}
                        event={event}
                    />
                ))}
            </>
        );
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <Header />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={Palette.primaryPurple100}
                        />
                    }>
                    <View style={styles.headingRow}>
                        <Text style={styles.heading}>Drafts</Text>
                        {isAdmin && !loading && !error && draftEvents.length > 0 && (
                            <Text style={styles.draftCount}>
                                {draftEvents.length} draft
                                {draftEvents.length === 1 ? "" : "s"}
                            </Text>
                        )}
                    </View>
                    {renderContent()}
                </ScrollView>
                <BottomNav />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
        gap: 16,
    },
    headingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 4,
    },
    heading: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingBottom: 15,
        overflow: "hidden",
    },
    cardShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
        borderRadius: 16,
    },
    coverImage: {
        width: "100%",
        height: 160,
        backgroundColor: Palette.teal,
        elevation: 2,
    },
    coverWrap: {
        position: "relative",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
    },
    starBadge: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    starBadgeFavorited: {
        backgroundColor: "#FFD700",
    },
    starBadgeUnfavorited: {
        backgroundColor: "#AAAAAA",
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
    },
    cardFooterLeft: {
        flex: 1,
        gap: 4,
    },
    draftTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    draftDate: {
        fontSize: 12,
        color: "#6D6E71",
        fontFamily: "Lato_400Regular",
    },
    draftCount: {
        fontSize: 14,
        color: "#888",
        fontFamily: "Lato_400Regular",
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 5,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: "#888",
        textAlign: "center",
        maxWidth: 240,
        fontFamily: "Lato_400Regular",
    },
    errorText: {
        fontSize: 13,
        color: "#c0392b",
        textAlign: "center",
        maxWidth: 260,
        fontFamily: "Lato_400Regular",
    },
    retryButton: {
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: Palette.primaryPurple100,
        borderRadius: 8,
    },
    retryText: {
        color: "#fff",
        fontWeight: "600",
        fontFamily: "Lato_700Bold",
    },
});
