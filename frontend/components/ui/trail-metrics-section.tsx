import {
    EventMetrics,
    createDefaultMetrics,
    updateEventMetrics,
} from "@/services/event-service";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState, useRef, useEffect } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Palette } from "@/constants/theme";

type MetricField = {
    key: keyof EventMetrics;
    label: string;
    unit: string;
};


type MetricCategory = {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    accentColor: string;
    fields: MetricField[];
};


const METRICS: MetricCategory[] = [
    {
        id: "drainage",
        title: "Drainage",
        subtitle: "Drains / culverts cleaned",
        icon: "water-outline",
        accentColor: "#0EA5E9",
        fields: [
            { key: "drainageCleaned", label: "Drains / culverts cleaned", unit: "drains" },
        ],
    },
    {
        id: "graffiti",
        title: "Graffiti & Stickers",
        subtitle: "2 metrics",
        icon: "pricetag-outline",
        accentColor: "#F59E0B",
        fields: [
            { key: "graffitiTagsRemoved", label: "Graffiti tags removed", unit: "tags" },
            { key: "stickersRemoved", label: "Stickers removed", unit: "stickers" },
        ],
    },
    {
        id: "other",
        title: "Other Improvements",
        subtitle: "Other trail improvements",
        icon: "sparkles-outline",
        accentColor: "#6B7280",
        fields: [
            { key: "otherImprovements", label: "Other improvements", unit: "items" },
        ],
    },
    {
        id: "painting",
        title: "Painting",
        subtitle: "Signs / stencils / lines / crosswalks painted",
        icon: "color-palette-outline",
        accentColor: "#2D8682",
        fields: [
            { key: "itemsPainted", label: "Items painted", unit: "items" },
        ],
    },
    {
        id: "pressure",
        title: "Pressure Washing",
        subtitle: "Bridges / tunnels pressure washed",
        icon: "rainy-outline",
        accentColor: "#3B82F6",
        fields: [
            { key: "pressureWashed", label: "Bridges / tunnels pressure washed", unit: "structures" },
        ],
    },
    {
        id: "repair",
        title: "Repair",
        subtitle: "Items repaired",
        icon: "construct-outline",
        accentColor: "#693894",
        fields: [
            { key: "itemsRepaired", label: "Items repaired", unit: "items" },
        ],
    },
    {
        id: "safety",
        title: "Safety",
        subtitle: "2 metrics",
        icon: "shield-checkmark-outline",
        accentColor: "#EF4444",
        fields: [
            { key: "safetyImprovements", label: "Safety improvements", unit: "improvements" },
            { key: "snowRemovalEvents", label: "Snow removal events", unit: "events" },
        ],
    },
    {
        id: "pothole",
        title: "Pothole / Asphalt",
        subtitle: "Potholes / asphalt gaps filled",
        icon: "alert-circle-outline",
        accentColor: "#D97706",
        fields: [
            { key: "potholesFilled", label: "Potholes / asphalt gaps filled", unit: "potholes" },
        ],
    },
    {
        id: "edging",
        title: "Trail Edging",
        subtitle: "Length of trail edged (approx.)",
        icon: "cut-outline",
        accentColor: "#059669",
        fields: [
            { key: "trailEdgedFeet", label: "Length of trail edged", unit: "feet" },
        ],
    },
    {
        id: "trash",
        title: "Trash Cleanup",
        subtitle: "2 metrics",
        icon: "trash-outline",
        accentColor: "#3BA34C",
        fields: [
            { key: "trashBagsCollected", label: "Bags collected", unit: "bags" },
            { key: "trashPoundsCollected", label: "Pounds of trash", unit: "lbs" },
        ],
    },
    {
        id: "vegetation",
        title: "Vegetation",
        subtitle: "2 metrics",
        icon: "leaf-outline",
        accentColor: "#65A30D",
        fields: [
            { key: "treesTrimmed", label: "Trees trimmed", unit: "trees" },
            { key: "vegetationVolunteers", label: "Vegetation volunteers", unit: "volunteers" },
        ],
    },
];

// Counted from the fields the UI actually renders. Counting Object.values on
// the model instead let filledCount exceed TOTAL_FIELDS and report "16 of 15"
// whenever the model carried a key with no input.
export const METRIC_FIELD_KEYS = METRICS.flatMap((category) =>
    category.fields.map((field) => field.key),
);
const TOTAL_FIELDS = METRIC_FIELD_KEYS.length;

interface TrailMetricsSectionProps {
    eventId: string;
    initialMetrics?: EventMetrics;
}

export default function TrailMetricsSection({
    eventId,
    initialMetrics,
}: TrailMetricsSectionProps) {
    const [metrics, setMetrics] = useState<EventMetrics>(
        initialMetrics ?? createDefaultMetrics(),
    );
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const filledCount = useMemo(
        () => METRIC_FIELD_KEYS.filter((key) => metrics[key] > 0).length,
        [metrics],
    );

    function toggle(id: string) {
        setExpandedId((prev) => (prev === id ? null : id));
    }

    const debounceTimers = useRef<Map<keyof EventMetrics, ReturnType<typeof setTimeout>>>(new Map());
    async function setField(key: keyof EventMetrics, value: number) {
        const safe = Number.isFinite(value) && value >= 0 ? value : 0;
        setMetrics((prev) => ({ ...prev, [key]: safe }));
        const existing = debounceTimers.current.get(key);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
            try {
                await updateEventMetrics(eventId, { [key]: safe });
                setSaveError(null);
            } catch (err) {
                console.error("Failed to save metric:", err);
                setSaveError("Couldn't save — will retry on next change.");
            }
            debounceTimers.current.delete(key);
        }, 400);
        debounceTimers.current.set(key, timer);
    }

    useEffect(() => {
        const timers = debounceTimers.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    function categoryFilledTotal(cat: MetricCategory): number {
        return cat.fields.reduce(
            (sum, f) => sum + (metrics[f.key] ?? 0),
            0,
        );
    }

    return (
        <View>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>Statistics</Text>
                <Text style={styles.counter}>
                    {filledCount} of {TOTAL_FIELDS} filled
                </Text>
            </View>

            {saveError && <Text style={styles.errorText}>{saveError}</Text>}

            {METRICS.map((cat) => {
                const isExpanded = expandedId === cat.id;
                const filled = categoryFilledTotal(cat);
                return (
                    <View
                        key={cat.id}
                        style={[
                            styles.card,
                            isExpanded && {
                                borderColor: cat.accentColor + "18",
                                borderWidth: 2,
                                shadowOpacity: 0.12,
                                shadowRadius: 20,
                                elevation: 2,
                            },
                        ]}>
                        <TouchableOpacity
                            onPress={() => toggle(cat.id)}
                            style={[
                                styles.cardHeader,
                                isExpanded && {
                                    backgroundColor: cat.accentColor + "08",
                                    borderBottomColor: cat.accentColor + "18",
                                    borderBottomWidth: 2,
                                },
                            ]}
                            activeOpacity={0.7}>
                            <View
                                style={[
                                    styles.iconWrap,
                                    { backgroundColor: cat.accentColor + "15" },
                                ]}>
                                <Ionicons
                                    name={cat.icon}
                                    size={20}
                                    color={cat.accentColor}
                                />
                            </View>
                            <View style={styles.cardTitleWrap}>
                                <Text style={styles.cardTitle}>{cat.title}</Text>
                                { !isExpanded && 
                                    <Text style={styles.cardSubtitle}>
                                        {cat.subtitle}
                                    </Text>
                                }
                            </View>
                            {filled > 0 && (
                                <View style={[ styles.badge, { backgroundColor: cat.accentColor + "15" }]}>
                                    <Text style={[ styles.badgeText, { color: cat.accentColor }]}>
                                        {filled}
                                    </Text>
                                </View>
                            )}
                            <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="#999"
                            />
                        </TouchableOpacity>

                        {isExpanded && (
                            <View style={styles.fieldsWrap}>
                                {cat.fields.map((field, index) => (
                                    <View key={field.key as string}>
                                        {index > 0 && <View style={styles.divider} />}
                                        <Stepper
                                            label={field.label}
                                            unit={field.unit}
                                            value={metrics[field.key] ?? 0}
                                            onChange={(v) => setField(field.key, v)}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

interface StepperProps {
    label: string;
    unit: string;
    value: number;
    onChange: (value: number) => void;
}

function Stepper({ label, unit, value, onChange }: StepperProps) {
    const isZero = value === 0;
    return (
        <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <View style={styles.stepperControls}>
                <TouchableOpacity
                    onPress={() => { if (!isZero) onChange(value - 1); }} disabled={isZero}
                    style={[ styles.stepperBtn, isZero ? styles.stepperBtnDisabled : styles.stepperBtnActive ]}
                    accessibilityLabel={`Decrease ${label}`}>
                    <Ionicons name="remove" size={18} color={isZero ? "#CCCCCC" : Palette.primaryPurple100}/>
                </TouchableOpacity>
                <View style={styles.valueContainer}>
                    <TextInput
                        value={String(value)}
                        onChangeText={(t) => {
                            const parsed = parseInt(t.replace(/[^0-9]/g, ""), 10);
                            onChange(Number.isNaN(parsed) ? 0 : parsed);
                        }}
                        keyboardType="number-pad"
                        style={styles.stepperInput}
                    />
                    <Text style={styles.stepperUnit}>{unit}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => onChange(value + 1)}
                    style={styles.stepperBtn}
                    accessibilityLabel={`Increase ${label}`}>
                    <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
    },
    counter: {
        fontSize: 13,
        color: "#999999",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#EEE",
        marginBottom: 10,
        shadowColor: Palette.primaryPurple100,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, 
        shadowRadius: 12,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitleWrap: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontFamily: "Lato_700Bold",
        color: "#1A1A1A",
    },
    cardSubtitle: {
        fontSize: 12,
        fontFamily: "Lato_400Regular",
        color: "#999999",
        marginTop: 2,
    },
    badge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: {
        fontSize: 14,
        fontFamily: "Lato_700Bold",
    },
    fieldsWrap: {
        paddingTop: 4,
        paddingBottom: 4,
    },
    stepperRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 22,
        paddingVertical: 15,
    },
    stepperLabel: {
        fontSize: 13,
        color: "#444444",
        fontFamily: "Lato_400Regular",
        flex: 1,
        flexShrink: 1,
        marginRight: 2,
    },
    stepperControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 0, 
    },
    stepperBtn: {
        width: 32,
        height: 32,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Palette.primaryPurple100,
    },
    stepperInput: {
        minWidth: 10,
        textAlign: "center",
        fontSize: 16,
        fontFamily: "Lato_700Bold",
        color: Palette.primaryPurple100,
        paddingVertical: 4,
    },
    stepperUnit: {
        fontSize: 12,
        fontFamily: "Lato_400Regular",
        color: "#999999",
    },
    valueContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        minWidth: 20,
        gap: 5,
        justifyContent: "center",
    },
    stepperCount: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: Palette.primaryPurple100,
    },
    errorText: {
        color: "#D14F4F",
        fontSize: 12,
        marginBottom: 8,
    },
    stepperBtnActive: {
        backgroundColor: "#69389418",
    },
    stepperBtnDisabled: {
        backgroundColor: "#F0F0F0",
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#F0F0F0",
    },
});