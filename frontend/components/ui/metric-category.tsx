import { Feather } from "@expo/vector-icons";
import React, {useState} from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MetricCounter } from "./metric-counter"
import { MetricCategoryConfig } from "@/config/metricsConfig";

type Props = {
    category: MetricCategoryConfig;
    values: Record<string, number>;
    onChange: (fieldId: string, val: number) => void;
};

export function MetricCategory({ category, values, onChange }: Props) {
    const [expanded, setExpanded] = useState(false);
    const totalFilled = category.fields.reduce((sum, field) => sum + (values[field.id] ?? 0), 0);
    const hasValue = totalFilled > 0;
    return (
        <View style={[ styles.card ]}>
            {/* Header */}
            <TouchableOpacity style={styles.header} onPress={() => setExpanded((prev: boolean) => !prev)}>
            {/* Icon */}
            <View style={[styles.iconBubble, { backgroundColor: category.color.concat("15") }]}>
                {category.icon}
            </View>

            {/* Title and Subtitle */}
            <View style={styles.titleBlock}>
                <Text style={styles.title}> {category.label} </Text>
                {category.subtitle && !expanded && (
                    <Text style={styles.subtitle}>{category.subtitle}</Text>
                )}
            </View>

            {/* Badge */}
                {hasValue && (
                    <View style={[styles.badge, { backgroundColor: category.color.concat("15") }]}>
                        <Text style={[styles.badgeText, { color: category.color }]}>{totalFilled}</Text>
                    </View>
            )}
            
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#AAAAAA"/>

            </TouchableOpacity>
            {expanded && (
                <View>
                    {category.fields.map((field, index) => (
                        <MetricCounter
                        key={field.id}
                        label={field.label}
                        unit={field.unit}
                        value={values[field.id] ?? 0}
                        onChange={(val) => onChange(field.id, val)}
                        isLast={index === category.fields.length - 1}
                        />
                    ))}
                </View>
            )}
        </View>
    );
} 

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 6,

        borderWidth: 1,
        borderColor: "#F0F0F5",
        
        shadowColor: "#6938951F",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    iconBubble: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    titleBlock: {
        flex: 1,
    },
    title: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: "#1A1A1A",
    },
    subtitle: {
        fontFamily: "Lato_400Regular",
        fontSize: 12,
        color: "#999999",
        marginTop: 4,
    },
    badge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    badgeText: {
        fontFamily: "Lato_700Bold",
        fontSize: 14,
    },
    fields: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#F0F0F0",
        gap: 4,
    },
});