import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import TrailEventHeader from "@/components/ui/trail-event-header";
import {
    METRICS_CONFIG,
    MetricCategoryConfig,
    MetricField,
} from "@/config/metricsConfig";
import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { getEventById, saveDraft } from "@/services/event-service";
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

const TEAL = "#2D8682";

type MetricRowProps = {
    icon: React.ReactNode;
    accentColor: string;
    label: string;
    sublabel: string;
    value: number | string;
    delay: number;
};

function MetricRow({
    icon,
    accentColor,
    label,
    sublabel,
    value,
    delay,
}: MetricRowProps) {
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
    }, [opacity, translateY, delay]);

    return (
        <Animated.View
            style={[styles.metricCard, { opacity, transform: [{ translateY }] }]}>
            <View
                style={[
                    styles.metricIconBubble,
                    { backgroundColor: accentColor.concat("15") },
                ]}>
                {icon}
            </View>
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

type FieldRow = {
    category: MetricCategoryConfig;
    field: MetricField;
};

const FIELD_ROWS: FieldRow[] = METRICS_CONFIG.flatMap((category) =>
    category.fields.map((field) => ({ category, field })),
);

export default function EventSummaryScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [saving, setSaving] = useState(false);
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

    const handleSaveDraft = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await saveDraft(event.eventId);
            router.replace("/(tabs)");
        } catch (e) {
            Alert.alert("Save failed", (e as Error).message);
            setSaving(false);
        }
    };

    const handleEditNow = async () => {
        if (saving) return;
        setSaving(true);
        try {
            // Mark as draft so it shows up in the drafts list if the user
            // bails before posting to Trello.
            await saveDraft(event.eventId);
            router.replace({
                pathname: "/edit-draft",
                params: { eventId: event.eventId },
            });
        } catch (e) {
            Alert.alert("Could not open editor", (e as Error).message);
            setSaving(false);
        }
    };

    const metrics = event.metrics ?? {};
    const hoursOfService = (() => {
        if (!event.startDate) return "0";
        const end = event.endDate ? event.endDate.toMillis() : Date.now();
        return (
            Math.max(0, end - event.startDate.toMillis()) / 3600000
        ).toFixed(1);
    })();

    return (
        <View style={styles.screen}>
            <View>
                <HomeHeader userName="Sarah" />
                <TrailEventHeader event={event} variant="summary" />
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

                {FIELD_ROWS.map(({ category, field }, i) => (
                    <MetricRow
                        key={field.id}
                        icon={category.icon}
                        accentColor={category.color}
                        label={field.label}
                        sublabel={field.unit}
                        value={metrics[field.id] ?? 0}
                        delay={Math.min(i * 40, 400)}
                    />
                ))}

                <MetricRow
                    icon={
                        <MaterialCommunityIcons
                            name="clock-outline"
                            size={20}
                            color={TEAL}
                        />
                    }
                    accentColor={TEAL}
                    label="Hours of service"
                    sublabel="hrs"
                    value={hoursOfService}
                    delay={Math.min(FIELD_ROWS.length * 40, 400)}
                />

                <View style={styles.divider} />

                <Text style={styles.actionHeading}>
                    What would you like to do?
                </Text>

                <Pressable
                    style={[
                        styles.actionCard,
                        saving && styles.actionCardDisabled,
                    ]}
                    onPress={handleSaveDraft}
                    disabled={saving}>
                    <View style={styles.actionIconWrap}>
                        {saving ? (
                            <ActivityIndicator
                                color={Palette.primaryPurple100}
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
                        <Text style={styles.actionCardTitle}>Save as draft</Text>
                        <Text style={styles.actionCardSubtitle}>
                            Continue editing later
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    style={[
                        styles.actionCard,
                        saving && styles.actionCardDisabled,
                    ]}
                    onPress={handleEditNow}
                    disabled={saving}>
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

            <BottomNav
                active="home"
                onTabPress={(tab) => {
                    if (tab === "home") router.replace("/(tabs)");
                    else if (tab === "history") router.replace("/drafts");
                }}
            />
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
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        gap: 10,
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
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
        borderWidth: 1,
        borderColor: "#F0F0F5",
    },
    metricIconBubble: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    metricBody: {
        flex: 1,
    },
    metricLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#222",
        fontFamily: "Lato_700Bold",
    },
    metricSublabel: {
        fontSize: 11,
        color: "#888",
        marginTop: 2,
        fontFamily: "Lato_400Regular",
    },
    metricValue: {
        fontSize: 28,
        fontWeight: "800",
        paddingRight: 8,
        letterSpacing: -0.5,
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
});
