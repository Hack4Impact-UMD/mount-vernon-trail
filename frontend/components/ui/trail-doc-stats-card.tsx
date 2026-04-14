import { Palette } from '@/constants/theme';
import { StatsData } from "@/types/trail-types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function TrailDocStatsCard(stats: Readonly<StatsData>) {
    return (
        <View style={styles.cardContainer}>
            {/* Trash Collection Card */}
            <View style={styles.card}>
                <Text style={styles.value}>{stats.trashCollection}</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.label}>Trash collection</Text>
                    <Text style={styles.subLabel}>In pounds (lbs)</Text>
                </View>
            </View> 
            {/* Restoration Effort Card */}
            <View style={styles.card}>
                <Text style={styles.value}>{stats.restorationEffort}</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.label}>Restoration effort</Text>
                    <Text style={styles.subLabel}>In sq.footage</Text>
                </View>
            </View> 
        </View>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        backgroundColor: "#ffffff",
        borderRadius: 16,
        paddingVertical: 24,
        paddingHorizontal: 16,
        columnGap: 8,
        // iOS shadow
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        // android shadow
        elevation: 2,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    value: {
        fontSize: 36,
        fontWeight: "700",
        color: Palette.primaryPurple100,
        marginRight: 10,
    },
    textContainer: {
        flex: 1,
        justifyContent: "center",
        paddingRight: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1a1a1a",
    },
    subLabel: {
        fontSize: 11,
        color: "#999999",
        marginTop: 2,
    },
});