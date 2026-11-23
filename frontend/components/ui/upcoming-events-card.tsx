import React from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export type EventStatus = "Not started" | "In progress" | "Completed";

export type UpcomingEventItem = {
    id: string;
    name: string;
    description: string;
    date: Date;
    imageUrl: string | null;
    status?: EventStatus;
    eventLeader?: string;
    zoneLeaders?: string;
    toolHaulers?: string;
    gloverLover?: string;
    workScope?: string;
};

type UpcomingEventsCardProps = {
    title?: string;
    events: UpcomingEventItem[];
    loading: boolean;
    error: string | null;
    maxItems?: number;
    onShowMore: () => void;
    onPressItem: (event: UpcomingEventItem) => void;
    // Locally recorded active event (AsyncStorage). Renders instantly and
    // offline, so the pill flips to "In Progress" the moment an event starts.
    activeEventId?: string | null;
};

// Was a single hardcoded constant, so published past events rendered as
// "Not started". `label` is separate from the key so the in-progress pill keeps
// the exact "In Progress" casing shipped on main.
const STATUS_STYLES: Record<
    EventStatus,
    { label: string; backgroundColor: string; color: string }
> = {
    "Not started": {
        label: "Not started",
        backgroundColor: "#D4930D18",
        color: "#D4930D",
    },
    // Green rather than the brand purple: this is the colour already shipped on
    // main for the running event, and volunteers read it as "live".
    "In progress": {
        label: "In Progress",
        backgroundColor: "#1A7A4A18",
        color: "#1A7A4A",
    },
    Completed: {
        label: "Completed",
        backgroundColor: "#3BA34C18",
        color: "#2E7D3A",
    },
};

const PLACEHOLDER_IMAGE = require("@/assets/images/mvt-beaver-logo.png");

export function formatEventDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// The locally tracked active event wins over the item's own status: it is the
// freshest signal a volunteer has, while `status` is derived from Firestore/
// Trello data that may still be a fetch behind.
function resolveStatus(
    event: UpcomingEventItem,
    activeEventId?: string | null,
): EventStatus {
    if (activeEventId && event.id === activeEventId) {
        return "In progress";
    }
    return event.status ?? "Not started";
}

export function UpcomingEventsCard({
    title = "Upcoming Events",
    events,
    loading,
    error,
    maxItems = 3,
    onShowMore,
    onPressItem,
    activeEventId,
}: UpcomingEventsCardProps) {
    const [expanded, setExpanded] = React.useState(false);
    const hasMore = events.length > maxItems;
    const visibleEvents =
        hasMore && !expanded ? events.slice(0, maxItems) : events;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
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
                    {/* Derived from the section title so the "Past Events"
                        instance does not claim there are no *upcoming* ones. */}
                    <Text style={styles.emptyText}>
                        No {title.toLowerCase().replace(/\s*events$/, "")} events
                    </Text>
                </View>
            )}

            {!loading &&
                !error &&
                visibleEvents.map((event) => {
                    const status = resolveStatus(event, activeEventId);
                    const statusStyle = STATUS_STYLES[status];

                    return (
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
                                <View style={styles.tagsRow}>
                                    <View
                                        style={[
                                            styles.tagPill,
                                            {
                                                backgroundColor:
                                                    statusStyle.backgroundColor,
                                            },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.tagText,
                                                { color: statusStyle.color },
                                            ]}>
                                            {statusStyle.label}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </Pressable>
                    );
                })}

            {/* Show More / Show Less Button */}
            {!loading && !error && hasMore && (
                <Pressable
                    onPress={() => {
                        if (expanded) {
                            setExpanded(false);
                        } else {
                            setExpanded(true);
                            onShowMore();
                        }
                    }}
                    style={styles.showMoreButton}>
                    <Text style={styles.showMoreText}>
                        {expanded ? "Show less" : "Show more"}
                    </Text>
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
    cardPressed: {
        opacity: 0.7,
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
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
        alignItems: "center",
    },
    tagPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    tagText: {
        fontSize: 11,
        fontWeight: "600",
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
        borderBottomWidth: 1,
        borderBottomColor: "#000",
        paddingBottom: 0.5,
    },
});
