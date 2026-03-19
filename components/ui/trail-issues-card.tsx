import React from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export interface TrailIssueItem {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
}

interface TrailIssuesCardProps {
    issues: TrailIssueItem[];
    loading: boolean;
    error: string | null;
    maxItems?: number;
    onShowMore: () => void;
    onPressItem: (issue: TrailIssueItem) => void;
}

// Maybe we want to change the placeholder image later
const PLACEHOLDER_IMAGE = require("@/assets/images/placeholder.png");

export function TrailIssuesCard({
    issues,
    loading,
    error,
    maxItems = 3,
    onShowMore,
    onPressItem,
}: TrailIssuesCardProps) {
    const hasMore = issues.length > maxItems;
    const visibleIssues = hasMore ? issues.slice(0, maxItems) : issues;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trail Issues</Text>
                <Text style={styles.arrow}>→</Text>
            </View>

            {/* Loading State */}
            {loading && (
                <View style={styles.centeredState}>
                    <ActivityIndicator size="large" />
                </View>
            )}

            {/* Error State */}
            {!loading && error && (
                <View style={styles.centeredState}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Empty State */}
            {!loading && !error && issues.length === 0 && (
                <View style={styles.centeredState}>
                    <Text style={styles.emptyText}>
                        No trail issues reported
                    </Text>
                </View>
            )}

            {!loading &&
                !error &&
                visibleIssues.map((issue) => (
                    <Pressable
                        key={issue.id}
                        onPress={() => onPressItem(issue)}
                        style={({ pressed }) => [
                            styles.card,
                            pressed && styles.cardPressed,
                        ]}>
                        <Image
                            source={
                                issue.imageUrl
                                    ? { uri: issue.imageUrl }
                                    : PLACEHOLDER_IMAGE
                            }
                            style={styles.thumbnail}
                        />
                        <View style={styles.cardContent}>
                            <Text
                                style={styles.cardTitle}
                                numberOfLines={2}>
                                {issue.name}
                            </Text>
                        </View>
                    </Pressable>
                ))}

            {/* Show More Button */}
            {!loading && !error && hasMore && (
                <Pressable
                    onPress={onShowMore}
                    style={styles.showMoreButton}>
                    <Text style={styles.showMoreText}>Show more</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#000",
    },
    arrow: {
        fontSize: 20,
        color: "#000",
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#f5f5f5",
        gap: 14,
    },
    cardPressed: {
        opacity: 0.7,
    },
    thumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: "#e0e0e0",
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    centeredState: {
        paddingVertical: 32,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#555",
    },
    errorText: {
        fontSize: 14,
        color: "#c0392b",
    },
    showMoreButton: {
        alignItems: "flex-start",
        paddingVertical: 8,
    },
    showMoreText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#000",
        textDecorationLine: "underline",
    },
});
