import TrailDropdown from "@/components/ui/trail-issue-photo-notes";
import { TrailIssue } from "@/types/trail-types";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Image,
    LayoutAnimation,
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
export function TrailDocIssuesCard(issues: Readonly<TrailIssue>) {
    const PLACEHOLDER_IMAGE = require("../../assets/images/beaver-limbloppers.png");
    const [expanded, setExpanded] = useState(false);
    const [notes, setNotes] = useState("");
    // get formatted date (e.g. Mar 28, 2026)
    const formattedDate = issues.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const handleToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    };
    return (
        <View style={styles.outer}>
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
                {/* Right: Green Arrow Button */}
                {/* TODO add onPress logic here for dropdown */}
                <TouchableOpacity
                    style={styles.arrowButton}
                    activeOpacity={0.7}
                    onPress={handleToggle}>
                    <View
                        style={{
                            transform: [
                                { rotate: expanded ? "90deg" : "0deg" },
                            ],
                        }}>
                        <Feather
                            name="chevron-right"
                            size={18}
                            color="#ffffff"
                        />{" "}
                    </View>
                </TouchableOpacity>
            </View>
            {/*dropdown*/}
            {expanded && (
                <TrailDropdown
                    beforeImageUri={issues.beforeImageUri ?? null}
                    afterImageUri={issues.afterImageUri ?? null}
                    notes={notes}
                    onNotesChange={setNotes}
                />
            )}
        </View>
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
        overflow: "hidden",
    },
    cardContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 20,
        padding: 12,
        paddingRight: 16,
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
        backgroundColor: "#35A853",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
});
