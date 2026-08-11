import { TrailIssue } from "@/types/trail-types";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";

if (Platform.OS === "android") {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
export function TrailDocIssuesCard(issues: Readonly<TrailIssue & { onPress?: () => void }>) {
    const PLACEHOLDER_IMAGE = require("../../assets/images/beaver-limbloppers.png");
    // get formatted date (e.g. Mar 28, 2026)
    const formattedDate = issues.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <>
        {/* The whole card is the tap target. Only the 32px chevron used to be
            pressable, and this card is the sole way into an issue. */}
        <TouchableOpacity
            style={styles.outer}
            activeOpacity={0.7}
            onPress={issues.onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open trail issue ${issues.name}`}>
            <View style={styles.cardContainer}>
                {/* Left: Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={
                            issues.imageUrl
                                ? { uri: issues.imageUrl }
                                : PLACEHOLDER_IMAGE
                        }
                        style={styles.image}
                    />
                </View>
                {/* Middle: Stacked Text */}
                <View style={styles.textContainer}>
                    <Text
                        style={styles.nameText}
                        numberOfLines={1}>
                        {issues.name}
                    </Text>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
                {/* Right: Green Arrow — decorative, the card itself handles the tap */}
                <View style={styles.arrowButton}>
                    <Feather
                        name="chevron-right"
                        size={18}
                        color="#ffffff"
                    />
                </View>
            </View>
        </TouchableOpacity>

        </>
    );
}

const styles = StyleSheet.create({
    outer: {
        backgroundColor: "#ffffff",
        borderRadius: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 20,
        padding: 12,
        paddingRight: 16,
        overflow: "hidden",
    },
    imageContainer: {
        marginRight: 16,
    },
    image: {
        width: 48,
        height: 48,
        borderRadius: 18,
        backgroundColor: "#E0E0E0",
    },
    placeholderImage: {
        backgroundColor: "#E0E0E0",
    },
    textContainer: {
        flex: 1,
        justifyContent: "center",
    },
    nameText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1A1A1A",
        marginBottom: 4,
        paddingRight: 10,
    },
    dateText: {
        fontSize: 13,
        color: "#8E8E93",
    },
    arrowButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#3ba45c",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
});
