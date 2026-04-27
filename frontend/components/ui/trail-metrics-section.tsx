import {
    EventMetrics,
    createDefaultMetrics,
    updateEventMetrics,
} from "@/services/event-service";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";


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
        accentColor: "#4FA3D1",
        fields: [
            { key: "drainageCleaned", label: "Drains / culverts cleaned", unit: "drains" },
        ],
    },
    {
        id: "graffiti",
        title: "Graffiti & Stickers",
        subtitle: "Graffiti tags / stickers removed",
        icon: "pricetag-outline",
        accentColor: "#E8A33D",
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
        accentColor: "#9B6DD8",
        fields: [
            { key: "otherImprovements", label: "Other improvements", unit: "items" },
        ],
    },
    {
        id: "painting",
        title: "Painting",
        subtitle: "Signs / stencils / lines / crosswalks painted",
        icon: "color-palette-outline",
        accentColor: "#5BB37A",
        fields: [
            { key: "itemsPainted", label: "Items painted", unit: "items" },
        ],
    },
    {
        id: "pressure",
        title: "Pressure Washing",
        subtitle: "Bridges / tunnels pressure washed",
        icon: "rainy-outline",
        accentColor: "#3FB6C9",
        fields: [
            { key: "pressureWashed", label: "Bridges / tunnels pressure washed", unit: "structures" },
        ],
    },
    {
        id: "repair",
        title: "Repair",
        subtitle: "Items repaired",
        icon: "construct-outline",
        accentColor: "#D67A3D",
        fields: [
            { key: "itemsRepaired", label: "Items repaired", unit: "items" },
        ],
    },
    {
        id: "safety",
        title: "Safety",
        subtitle: "Safety improvements & snow removal events",
        icon: "shield-checkmark-outline",
        accentColor: "#D14F4F",
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
        accentColor: "#7A6B5C",
        fields: [
            { key: "potholesFilled", label: "Potholes / asphalt gaps filled", unit: "potholes" },
        ],
    },
    {
        id: "edging",
        title: "Trail Edging",
        subtitle: "Length of trail edged (approx.)",
        icon: "cut-outline",
        accentColor: "#6B9E4F",
        fields: [
            { key: "trailEdgedFeet", label: "Length of trail edged", unit: "feet" },
        ],
    },
    {
        id: "trash",
        title: "Trash Cleanup",
        subtitle: "Bags collected & pounds of trash",
        icon: "trash-outline",
        accentColor: "#5C8A4F",
        fields: [
            { key: "trashBagsCollected", label: "Bags collected", unit: "bags" },
            { key: "trashPoundsCollected", label: "Pounds of trash", unit: "lbs" },
        ],
    },
    {
        id: "vegetation",
        title: "Vegetation",
        subtitle: "Trees trimmed & vegetation volunteers",
        icon: "leaf-outline",
        accentColor: "#4F8A3D",
        fields: [
            { key: "treesTrimmed", label: "Trees trimmed", unit: "trees" },
            { key: "vegetationVolunteers", label: "Vegetation volunteers", unit: "volunteers" },
        ],
    },
];

const TOTAL_FIELDS = METRICS.reduce((sum, m) => sum + m.fields.length, 0);

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
        () =>
            Object.values(metrics).filter(
                (v) => typeof v === "number" && v > 0,
            ).length,
        [metrics],
    );

    function toggle(id: string) {
        setExpandedId((prev) => (prev === id ? null : id));
    }

    async function setField(key: keyof EventMetrics, value: number) {
        const safe = Number.isFinite(value) && value >= 0 ? value : 0;
        setMetrics((prev) => ({ ...prev, [key]: safe }));
        try {
            await updateEventMetrics(eventId, { [key]: safe });
            setSaveError(null);
        } catch (err) {
            console.error("Failed to save metric:", err);
            setSaveError("Couldn't save — will retry on next change.");
        }
    }

    function categoryFilledTotal(cat: MetricCategory): number {
        return cat.fields.reduce(
            (sum, f) => sum + (metrics[f.key] > 0 ? 1 : 0),
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
                                borderLeftColor: cat.accentColor,
                                borderLeftWidth: 4,
                            },
                        ]}>
                        <TouchableOpacity
                            onPress={() => toggle(cat.id)}
                            style={styles.cardHeader}
                            activeOpacity={0.7}>
                            <View
                                style={[
                                    styles.iconWrap,
                                    { backgroundColor: cat.accentColor + "20" },
                                ]}>
                                <Ionicons
                                    name={cat.icon}
                                    size={18}
                                    color={cat.accentColor}
                                />
                            </View>
                            <View style={styles.cardTitleWrap}>
                                <Text style={styles.cardTitle}>{cat.title}</Text>
                                <Text style={styles.cardSubtitle}>
                                    {cat.subtitle}
                                </Text>
                            </View>
                            {filled > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
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
                                {cat.fields.map((field) => (
                                    <Stepper
                                        key={field.key as string}
                                        label={field.label}
                                        unit={field.unit}
                                        value={metrics[field.key]}
                                        onChange={(v) => setField(field.key, v)}
                                    />
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
    return (
        <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <View style={styles.stepperControls}>
                <TouchableOpacity
                    onPress={() => onChange(Math.max(0, value - 1))}
                    style={styles.stepperBtn}
                    accessibilityLabel={`Decrease ${label}`}>
                    <Ionicons name="remove" size={18} color="#5B2D8E" />
                </TouchableOpacity>
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
                <TouchableOpacity
                    onPress={() => onChange(value + 1)}
                    style={[styles.stepperBtn, styles.stepperBtnPlus]}
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
        color: "#888",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#EEE",
        marginBottom: 10,
        overflow: "hidden",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitleWrap: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#222",
    },
    cardSubtitle: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
    },
    badge: {
        backgroundColor: "#5B2D8E",
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 4,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    fieldsWrap: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        gap: 12,
    },
    stepperRow: {
        gap: 6,
    },
    stepperLabel: {
        fontSize: 13,
        color: "#444",
    },
    stepperControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepperBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#5B2D8E",
        alignItems: "center",
        justifyContent: "center",
    },
    stepperBtnPlus: {
        backgroundColor: "#5B2D8E",
    },
    stepperInput: {
        minWidth: 40,
        textAlign: "center",
        fontSize: 16,
        fontWeight: "600",
        color: "#222",
        paddingVertical: 4,
    },
    stepperUnit: {
        fontSize: 12,
        color: "#888",
        flex: 1,
    },
    errorText: {
        color: "#D14F4F",
        fontSize: 12,
        marginBottom: 8,
    },
});