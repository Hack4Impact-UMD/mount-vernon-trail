import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Palette } from "@/constants/theme";

type Props = {
    label: string;
    unit: string;
    value: number;
    onChange: (val: number) => void;
    isLast?: boolean;
};

export function MetricCounter({ label, unit, value, onChange, isLast = false }: Props) {
    const isZero = value === 0;

    return (
        <View style={[styles.row, !isLast && styles.rowBorder]}>
            <Text style={styles.label}>{label}</Text>

            <View style={styles.controls}>
                <TouchableOpacity
                    onPress={() => onChange(Math.max(0, value - 1))}
                    style={[styles.btn, isZero ? styles.btnDisabled : styles.btnActive]}
                    activeOpacity={0.7}
                >
                <Feather name="minus" size={18} color={isZero ? "#CCCCCC" : Palette.primaryPurple100} />
                </TouchableOpacity>
                <View style={styles.valueContainer}>
                    <Text style={styles.count}>{value}</Text>
                    <Text style={styles.unit}>{unit}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => onChange(value + 1)}
                    style={[styles.btn]}
                    activeOpacity={0.7}
                >
                <Feather name="plus" size={18} color="#ffffff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 22,
        paddingVertical: 15,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#F0F0F0",
    },
    label: {
        fontFamily: "Lato_400Regular",
        fontSize: 12,
        color: "#444444",
        flex: 1,
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    btn: {
        width: 32,
        height: 32,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Palette.primaryPurple100,
    },
    btnActive: {
        backgroundColor: "#69389418",
    },
    btnDisabled: {
        backgroundColor: "#F0F0F0",
    },
    valueContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 4,
        minWidth: 20,
        justifyContent: "center",
    },
    count: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: Palette.primaryPurple100,
    },
    unit: {
        fontFamily: "Lato_400Regular",
        fontSize: 10,
        color: "#999999",
    },
});