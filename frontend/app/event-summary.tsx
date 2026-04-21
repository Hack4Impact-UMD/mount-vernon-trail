import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { getEventById } from "@/services/event-service";
import { moveCardToCompleted } from "@/services/trello-service";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#3BA34C";
const BLUE = "#215EAC";
const TEAL = "#2D8682";
interface MetricCardProps {
    label: string;
    sublabel: string;
    value: number | string;
    accentColor: string;
    delay: number;
}

function MetricCard({
    label,
    sublabel,
    value,
    accentColor,
    delay,
}: MetricCardProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.metricCard,
                { opacity, transform: [{ translateY }] },
            ]}>
            <View
                style={[styles.metricAccent, { backgroundColor: accentColor }]}
            />
            <View style={styles.metricBody}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.metricSublabel}>{sublabel}</Text>
            </View>
            <Text style={[styles.metricValue, { color: accentColor }]}>
                {value}
            </Text>
        </Animated.View>
    );
}

export default function EventSummaryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [event, setEvent] = useState<Event>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    useEffect(() => {
        if (!eventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }
        getEventById(eventId)
            .then((e) => {
                if (e) setEvent(e);
                else setError("Event not found.");
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [eventId]);

    if (loading) return <ActivityIndicator style={styles.loader} />;
    if (error || !event) return (
        <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error ?? "Event not found."}</Text>
        </View>
    );

    const handleSave = async () => {
        if (saving || saved) return;
        setSaving(true);
        try {
            const key = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";
            await moveCardToCompleted(event.trelloCardId, key);
            setSaved(true);
        } catch (e) {
            Alert.alert("Save failed", (e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View>
                <HomeHeader userName="Sarah" />
                <TrailEventHeader
                    event={event}
                    variant="summary"
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                    <Text style={styles.summaryHeading}>Summary</Text>
                    <MaterialCommunityIcons
                        name="trending-up"
                        size={22}
                        color="#333"
                    />
                </View>

                <View style={styles.divider} />

                <MetricCard
                    label="Trail Improvements"
                    sublabel="in review"
                    value={event.trailImprovements}
                    accentColor={GREEN}
                    delay={60}
                />
                <MetricCard
                    label="Trash collection"
                    sublabel="# of bags"
                    value={event.trashBags}
                    accentColor={BLUE}
                    delay={160}
                />
                <MetricCard
                    label="Hours of service"
                    sublabel="hrs"
                    value={(() => {
                        if (!event.startDate) return 0;
                        const end = event.endDate
                            ? event.endDate.toMillis()
                            : Date.now();
                        return (
                            Math.max(0, end - event.startDate.toMillis()) /
                            3600000
                        ).toFixed(1);
                    })()}
                    accentColor={TEAL}
                    delay={260}
                />

                <View style={styles.divider} />

                <Text style={styles.actionHeading}>
                    What would you like to do?
                </Text>

                <Pressable
                    style={[
                        styles.actionCard,
                        saved && styles.actionCardSaved,
                        saving && styles.actionCardDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={saving || saved}>
                    <View style={styles.actionIconWrap}>
                        {saving ? (
                            <ActivityIndicator
                                color={Palette.primaryPurple100}
                            />
                        ) : saved ? (
                            <MaterialCommunityIcons
                                name="check"
                                size={24}
                                color={GREEN}
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="content-save-outline"
                                size={24}
                                color="#666"
                            />
                        )}
                    </View>
                    <View>
                        <Text style={styles.actionCardTitle}>
                            {saved ? "Saved to Trello!" : "Save as draft"}
                        </Text>
                        <Text style={styles.actionCardSubtitle}>
                            {saved
                                ? "Summary uploaded to Trello card"
                                : "Continue editing later"}
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    style={styles.actionCard}
                    onPress={() => router.back()}>
                    <View style={styles.actionIconWrap}>
                        <MaterialCommunityIcons
                            name="pencil-outline"
                            size={24}
                            color="#666"
                        />
                    </View>
                    <View>
                        <Text style={styles.actionCardTitle}>
                            Edit event now
                        </Text>
                        <Text style={styles.actionCardSubtitle}>
                            Complete & upload to Trello
                        </Text>
                    </View>
                </Pressable>
            </ScrollView>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    headerBar: {
        backgroundColor: Palette.primaryPurple100,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    logo: {
        width: 51,
        height: 51,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        gap: 14,
    },
    eventInfoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    eventInfoLeft: {
        flex: 1,
        gap: 4,
    },
    eventTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    eventDuration: {
        fontSize: 13,
        color: "#888",
        fontFamily: "Lato_400Regular",
    },
    eventInfoRight: {
        gap: 10,
        alignItems: "flex-start",
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    actionBtnCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    actionBtnText: {
        fontSize: 14,
        color: "#111",
        fontFamily: "Lato_400Regular",
    },
    divider: {
        height: 1,
        backgroundColor: "#E0E0E0",
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    summaryHeading: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    metricCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    metricAccent: {
        width: 6,
        alignSelf: "stretch",
    },
    metricBody: {
        flex: 1,
        paddingVertical: 18,
        paddingLeft: 16,
    },
    metricLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: "#555",
        fontFamily: "Lato_700Bold",
    },
    metricSublabel: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
        fontFamily: "Lato_400Regular",
    },
    metricValue: {
        fontSize: 48,
        fontWeight: "800",
        paddingRight: 20,
        letterSpacing: -1,
    },
    actionHeading: {
        fontSize: 15,
        fontWeight: "700",
        color: "#333",
        textAlign: "center",
        fontFamily: "Lato_700Bold",
    },
    actionCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        gap: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    actionCardSaved: {
        borderWidth: 1.5,
        borderColor: GREEN,
    },
    actionCardDisabled: { opacity: 0.6 },
    loader: { flex: 1 },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    errorText: {
        fontSize: 15,
        color: "#888",
        textAlign: "center",
    },
    actionIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#EBEBEB",
        alignItems: "center",
        justifyContent: "center",
    },
    actionCardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    actionCardSubtitle: {
        fontSize: 13,
        color: "#888",
        marginTop: 2,
        fontFamily: "Lato_400Regular",
    },
});
