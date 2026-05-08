import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event, EventMetricsWithHours } from "@/services/event-service";
import {
	clearActiveEventLocally,
	extractMetricsWithHours,
	getEventById,
	saveDraft,
} from "@/services/event-service";
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

const PURPLE = "#693894";
const BLUE = "#215EAC";
const TEAL = "#2D8682";

type IconLibrary = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface MetricDef {
    key: keyof EventMetricsWithHours;
    label: string;
    sublabel: string;
    icon: IconLibrary;
    color: string;
}

const METRIC_DEFS: MetricDef[] = [
    {
        key: "trailImprovements",
        label: "Trail Improvements",
        sublabel: "in review",
        icon: "trending-up",
        color: PURPLE,
    },
    {
        key: "drainageCleaned",
        label: "Drainage",
        sublabel: "# of drains cleaned",
        icon: "water-outline",
        color: TEAL,
    },
    {
        key: "graffitiTagsRemoved",
        label: "Graffiti",
        sublabel: "# of tags removed",
        icon: "spray",
        color: BLUE,
    },
    {
        key: "stickersRemoved",
        label: "Stickers",
        sublabel: "# of stickers removed",
        icon: "sticker-remove-outline",
        color: PURPLE,
    },
    {
        key: "otherImprovements",
        label: "Other improvements",
        sublabel: "# of misc. improvements",
        icon: "tools",
        color: TEAL,
    },
    {
        key: "itemsPainted",
        label: "Painting",
        sublabel: "# of signs, stencils,\nstop lines, or crosswalks",
        icon: "palette-outline",
        color: BLUE,
    },
    {
        key: "pressureWashed",
        label: "Pressure washing",
        sublabel: "# of bridges/tunnels washed",
        icon: "water-pump",
        color: PURPLE,
    },
    {
        key: "itemsRepaired",
        label: "Repairs",
        sublabel: "# of items repaired",
        icon: "wrench-outline",
        color: TEAL,
    },
    {
        key: "safetyImprovements",
        label: "Safety improvements",
        sublabel: "# of improvements",
        icon: "shield-check-outline",
        color: BLUE,
    },
    {
        key: "snowRemovalEvents",
        label: "Snow removal",
        sublabel: "# of removal events",
        icon: "snowflake",
        color: PURPLE,
    },
    {
        key: "potholesFilled",
        label: "Potholes",
        sublabel: "# of asphalt gaps filled",
        icon: "road-variant",
        color: TEAL,
    },
    {
        key: "trailEdgedFeet",
        label: "Trail edging",
        sublabel: "ft of edging improved",
        icon: "scissors-cutting",
        color: BLUE,
    },
    {
        key: "trashBagsCollected",
        label: "Trash bags",
        sublabel: "# of bags collected",
        icon: "trash-can-outline",
        color: PURPLE,
    },
    {
        key: "trashPoundsCollected",
        label: "Trash weight",
        sublabel: "# of lbs collected",
        icon: "weight",
        color: TEAL,
    },
    {
        key: "treesTrimmed",
        label: "Trees",
        sublabel: "# of trees trimmed",
        icon: "tree-outline",
        color: BLUE,
    },
    {
        key: "vegetationVolunteers",
        label: "Vegetation improvements",
        sublabel: "# of veg. improvements",
        icon: "leaf-circle-outline",
        color: PURPLE,
    },
    {
        key: "hoursOfService",
        label: "Hours of service",
        sublabel: "hrs",
        icon: "clock-outline",
        color: TEAL,
    },
];
interface MetricGridCardProps {
    def: MetricDef;
    value: number | string;
    delay: number;
}

function MetricGridCard({ def, value, delay }: MetricGridCardProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 380,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 380,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, [opacity, translateY, delay]);

    return (
        <Animated.View
            style={[styles.gridCard, { opacity, transform: [{ translateY }] }]}>
            <View style={styles.gridCardHeader}>
                <View
                    style={[
                        styles.gridIconCircle,
                        { backgroundColor: def.color + "18" },
                    ]}>
                    <MaterialCommunityIcons
                        name={def.icon}
                        size={18}
                        color={def.color}
                    />
                </View>
                <Text
                    style={styles.gridCardLabel}
                    numberOfLines={2}>
                    {def.label}
                </Text>
            </View>

            <Text style={[styles.gridCardValue, { color: def.color }]}>
                {value}
            </Text>

            <Text
                style={styles.gridCardSublabel}
                numberOfLines={2}>
                {def.sublabel}
            </Text>
        </Animated.View>
    );
}

export default function EventSummaryScreen() {
    const router = useRouter();
    const { eventId, notes } = useLocalSearchParams<{
        eventId: string;
        notes?: string;
    }>();

    const [saving, setSaving] = useState(false);
    const [savedDraft, setSavedDraft] = useState(false);
    const [savedTrello, setSavedTrello] = useState(false);
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
    if (error || !event)
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                    {error ?? "Event not found."}
                </Text>
            </View>
        );

    const stats = extractMetricsWithHours(event);

    const visibleMetrics = stats
        ? METRIC_DEFS.filter((def) => (stats[def.key] as number) !== 0)
        : [];

    const handleSaveDraft = async () => {
        if (saving || savedDraft || savedTrello) return;
        setSaving(true);
        try {
            await saveDraft(eventId, notes ?? event.notes ?? "");
            await clearActiveEventLocally();
            setSavedDraft(true);
        } catch {
            Alert.alert("Error", "Could not save event to drafts.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View>
                <HomeHeader />
                <TrailEventHeader
                    event={event}
                    variant="summary"
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryHeading}>Summary</Text>
                    <MaterialCommunityIcons
                        name="trending-up"
                        size={22}
                        color="#333"
                    />
                </View>
                <View style={styles.divider} />

                {visibleMetrics.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons
                            name="chart-bar"
                            size={40}
                            color="#ccc"
                        />
                        <Text style={styles.emptyStateText}>
                            No metrics recorded yet.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {visibleMetrics.map((def, i) => (
                            <MetricGridCard
                                key={def.key}
                                def={def}
                                value={stats![def.key] as number}
                                delay={i * 60}
                            />
                        ))}
                    </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.actionHeading}>
                    What would you like to do?
                </Text>

                <Pressable
                    style={[
                        styles.actionCard,
                        savedDraft && styles.actionCardSaved,
                        saving && styles.actionCardDisabled,
                    ]}
                    onPress={handleSaveDraft}
                    disabled={saving || savedDraft || savedTrello}>
                    <View style={styles.actionIconWrap}>
                        {saving ? (
                            <ActivityIndicator color={PURPLE} />
                        ) : savedDraft ? (
                            <MaterialCommunityIcons
                                name="check"
                                size={24}
                                color="#3BA34C"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="content-save-outline"
                                size={24}
                                color="#666"
                            />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.actionCardTitle}>
                            {savedDraft ? "Saved as draft!" : "Save as draft"}
                        </Text>
                        <Text style={styles.actionCardSubtitle}>
                            {savedDraft
                                ? "Edit later from the Drafts tab"
                                : "Continue editing later"}
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    style={[
                        styles.actionCard,
                        savedTrello && styles.actionCardSaved,
                        saving && styles.actionCardDisabled,
                    ]}
                    onPress={async () => {
                        try {
                            await clearActiveEventLocally();
                        } catch (error) {
                            setError((error as Error).message);
                        }
                        router.replace({
                            pathname: "/edit-draft",
                            params: {
                                eventId,
                                notes: notes ?? event.notes ?? "",
                            },
                        });
                    }}
                    disabled={saving || savedDraft || savedTrello}>
                    <View style={styles.actionIconWrap}>
                        {saving ? (
                            <ActivityIndicator color={PURPLE} />
                        ) : savedTrello ? (
                            <MaterialCommunityIcons
                                name="check"
                                size={24}
                                color="#3BA34C"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="pencil-outline"
                                size={24}
                                color="#666"
                            />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.actionCardTitle}>
                            Edit event now
                        </Text>
                        <Text style={styles.actionCardSubtitle}>
                            Complete & upload to Trello
                        </Text>
                    </View>
                </Pressable>

                {(savedDraft || savedTrello) && (
                    <Pressable
                        style={styles.actionCard}
                        onPress={() => router.replace("/home-screen")}>
                        <View style={styles.actionIconWrap}>
                            <MaterialCommunityIcons
                                name="home-outline"
                                size={24}
                                color="#666"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionCardTitle}>
                                Back to home screen
                            </Text>
                            <Text style={styles.actionCardSubtitle}>
                                Return to the main menu
                            </Text>
                        </View>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 48,
        gap: 14,
    },
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
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    gridCard: {
        width: "47.5%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 14,
        gap: 6,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
        borderWidth: 1,
        borderColor: "#F0F0F5",
    },
    gridCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
    },
    gridIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    gridCardLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: "600",
        color: "#444",
        fontFamily: "Lato_700Bold",
        lineHeight: 17,
    },
    gridCardValue: {
        fontSize: 42,
        fontWeight: "800",
        letterSpacing: -1,
        lineHeight: 48,
    },
    gridCardSublabel: {
        fontSize: 11,
        color: "#888",
        fontFamily: "Lato_400Regular",
        lineHeight: 15,
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 32,
        gap: 10,
    },
    emptyStateText: {
        fontSize: 14,
        color: "#888",
        textAlign: "center",
        lineHeight: 20,
    },
    actionHeading: {
        fontSize: 15,
        fontWeight: "700",
        color: "#333",
        textAlign: "center",
        fontFamily: "Lato_700Bold",
        marginTop: 8,
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
        borderColor: "#3BA34C",
    },
    actionCardDisabled: { opacity: 0.6 },
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
