import React from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export interface UpcomingEventItem {
    id: string;
    name: string;
    description: string;
    date: Date;
    imageUrl: string | null;
}

interface UpcomingEventsCardProps {
    events: UpcomingEventItem[];
    loading: boolean;
    error: string | null;
    maxItems?: number;
    onShowMore: () => void;
    onPressItem: (event: UpcomingEventItem) => void;
}

const PLACEHOLDER_IMAGE = require("@/assets/images/placeholder.png");

function formatEventDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function UpcomingEventsCard({
    events,
    loading,
    error,
    maxItems = 3,
    onShowMore,
    onPressItem,
}: UpcomingEventsCardProps) {
    const hasMore = events.length > maxItems;
    const visibleEvents = hasMore ? events.slice(0, maxItems) : events;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
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
            {!loading && !error && events.length === 0 && (
                <View style={styles.centeredState}>
                    <Text style={styles.emptyText}>No upcoming events</Text>
                </View>
            )}

            {!loading &&
                !error &&
                visibleEvents.map((event) => (
                    <Pressable
                        key={event.id}
                        onPress={() => onPressItem(event)}
                        style={({ pressed }) => [
                            styles.card,
                            pressed && styles.cardPressed,
                        ]}>
                        <Image
                            source={
                                event.imageUrl
                                    ? { uri: event.imageUrl }
                                    : PLACEHOLDER_IMAGE
                            }
                            style={styles.thumbnail}
                        />
                        <View style={styles.cardContent}>
                            <Text
                                style={styles.cardTitle}
                                numberOfLines={2}>
                                {event.name}
                            </Text>
                            <Text style={styles.cardDate}>
                                {formatEventDate(event.date)}
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
        fontSize: 16,
        fontWeight: "700",
        color: "#000",
    },
    arrow: {
        fontSize: 16,
        color: "#000",
    },
    card: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        gap: 12,
        shadowColor: "#693895",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
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
        fontSize: 13,
        fontWeight: "600",
        color: "#000",
    },
    cardDate: {
        fontSize: 11,
        color: "#999999",
        marginTop: 8,
        fontWeight: "400",
    },
    centeredState: {
        paddingVertical: 32,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 12,
        color: "#555",
    },
    errorText: {
        fontSize: 12,
        color: "#c0392b",
    },
    showMoreButton: {
        alignItems: "flex-start",
        paddingVertical: 8,
    },
    showMoreText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#000",
        textDecorationLine: "underline",
    },
});
