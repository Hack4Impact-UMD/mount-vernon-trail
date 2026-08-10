import React from "react";
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { type UpcomingEventItem, formatEventDate } from "./upcoming-events-card";

const PLACEHOLDER_IMAGE = require("@/assets/images/mvt-beaver-logo.png");

interface PastEventsCardProps {
    events: UpcomingEventItem[];
    loading: boolean;
    error: string | null;
    maxItems?: number;
}

export function PastEventsCard({
    events,
    loading,
    error,
    maxItems = 3,
}: PastEventsCardProps) {
    const [expanded, setExpanded] = React.useState(false);
    const hasMore = events.length > maxItems;
    const visibleEvents = hasMore && !expanded ? events.slice(0, maxItems) : events;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Past Events</Text>
            </View>

            {loading && (
                <View style={styles.centeredState}>
                    <ActivityIndicator size="large" />
                </View>
            )}

            {!loading && error && (
                <View style={styles.centeredState}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {!loading && !error && events.length === 0 && (
                <View style={styles.centeredState}>
                    <Text style={styles.emptyText}>No events in the past 30 days.</Text>
                </View>
            )}

            {!loading &&
                !error &&
                visibleEvents.map((event) => (
                    <View key={event.id} style={styles.card}>
                        <Image source={ event.imageUrl ? { uri: event.imageUrl } : PLACEHOLDER_IMAGE } style={styles.thumbnail} />
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle} numberOfLines={2}>
                                {event.name}
                            </Text>
                            <Text style={styles.cardDate}>
                                {formatEventDate(event.date)}
                            </Text>
                        </View>
                    </View>
                ))}

            {!loading && !error && hasMore && (
                <Text
                    onPress={() => setExpanded((prev) => !prev)}
                    style={styles.showMoreText}>
                    {expanded ? "Show less" : "Show more"}
                </Text>
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
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1A1A1A",
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
        elevation: 3,
    },
    thumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
    },
    cardContent: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
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
    showMoreText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#000",
        borderBottomWidth: 1,
        borderBottomColor: "#000",
        paddingBottom: 0.5,
        alignSelf: "flex-start",
    },
});