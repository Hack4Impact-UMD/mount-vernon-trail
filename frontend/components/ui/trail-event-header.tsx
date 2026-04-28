import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import { setEventInactive } from "@/services/event-service";
import { fetchCardUrl } from "@/services/trello-service";
import { MaterialIcons } from "@expo/vector-icons";
import { Square } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Linking,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EndEventModal from "./end-event-modal";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN ?? "";

interface TrailEventHeaderProps {
    event: Event;
    onStop?: () => void;
    variant?: "default" | "document" | "summary";
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function TrailEventHeader({
    event,
    onStop,
    variant = "default",
}: TrailEventHeaderProps) {
    const insets = useSafeAreaInsets();
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);
    const [endModalVisible, setEndModalVisible] = useState(false);

    const staticDuration = (() => {
        if (!event.startDate) return 0;
        const end = event.endDate ? event.endDate.toMillis() : Date.now();
        return Math.max(
            0,
            Math.floor((end - event.startDate.toMillis()) / 1000),
        );
    })();

    useEffect(() => {
        if (variant === "summary") return;
        if (!event.startDate) return;

        const startMs = event.startDate.toMillis();

        const tick = () => {
            const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
            setElapsed(diff);
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [event.startDate, variant]);

    const handleStop = () => {
        setEndModalVisible(true);
    };

    const handleConfirmEnd = async () => {
        setStopping(true);
        try {
            await setEventInactive(event.eventId);
            setEndModalVisible(false);
            onStop?.();
        } catch (e) {
            Alert.alert("Error", (e as Error).message);
        } finally {
            setStopping(false);
        }
    };

    const handleShareEvent = async () => {
        if (!event.trelloCardId) return;
        try {
            const url = await fetchCardUrl(
                event.trelloCardId,
                API_KEY,
                API_TOKEN,
            );
            await Share.share({ message: url });
        } catch (e) {
            console.error("Failed to share event:", e);
        }
    };

    if (variant === "summary") {
        return (
            <View style={docStyles.container}>
                <View style={docStyles.left}>
                    <Text style={docStyles.eventName}>{event.title}</Text>
                    <Text style={docStyles.duration}>
                        Duration: {formatDuration(staticDuration)}
                    </Text>
                </View>

                <View style={docStyles.right}>
                    {event.albumUrl ? (
                        <Pressable
                            style={docStyles.actionRow}
                            onPress={() => Linking.openURL(event.albumUrl)}>
                            <View
                                style={[
                                    docStyles.iconCircle,
                                    { backgroundColor: Palette.teal },
                                ]}>
                                <MaterialIcons
                                    name="image"
                                    size={18}
                                    color="#fff"
                                />
                            </View>
                            <Text style={docStyles.actionLabel}>
                                View album
                            </Text>
                        </Pressable>
                    ) : null}
                    <Pressable
                        style={docStyles.actionRow}
                        onPress={handleShareEvent}>
                        <View
                            style={[
                                docStyles.iconCircle,
                                { backgroundColor: Palette.blue },
                            ]}>
                            <MaterialIcons
                                name="send"
                                size={18}
                                color="#fff"
                            />
                        </View>
                        <Text style={docStyles.actionLabel}>Share event</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (variant === "document") {
        return (
            <>
                <View style={docStyles.container}>
                    <View style={docStyles.left}>
                        <View style={docStyles.badgeRow}>
                            <View style={docStyles.badge}>
                                <Text style={docStyles.badgeText}>In Progress</Text>
                            </View>
                            <Text style={docStyles.duration}>
                                {formatDuration(elapsed)}
                            </Text>
                        </View>
                        <View style={docStyles.titleRow}>
                            <Pressable
                                style={[
                                    docStyles.stopCircle,
                                    stopping && docStyles.stopCircleDisabled,
                                ]}
                                onPress={handleStop}
                                disabled={stopping}>
                                <Square
                                    size={14}
                                    color="#fff"
                                    fill="#fff"
                                />
                            </Pressable>
                            <Text style={docStyles.eventName}>{event.title}</Text>
                        </View>
                    </View>

                    <View style={docStyles.right}>
                        {event.albumUrl ? (
                            <Pressable
                                style={docStyles.actionRow}
                                onPress={() => Linking.openURL(event.albumUrl)}>
                                <View
                                    style={[
                                        docStyles.iconCircle,
                                        { backgroundColor: Palette.teal },
                                    ]}>
                                    <MaterialIcons
                                        name="image"
                                        size={18}
                                        color="#fff"
                                    />
                                </View>
                                <Text style={docStyles.actionLabel}>
                                    View album
                                </Text>
                            </Pressable>
                        ) : null}
                        <Pressable
                            style={docStyles.actionRow}
                            onPress={handleShareEvent}>
                            <View
                                style={[
                                    docStyles.iconCircle,
                                    { backgroundColor: Palette.blue },
                                ]}>
                                <MaterialIcons
                                    name="send"
                                    size={18}
                                    color="#fff"
                                />
                            </View>
                            <Text style={docStyles.actionLabel}>Share event</Text>
                        </Pressable>
                    </View>
                </View>
                <EndEventModal
                    visible={endModalVisible}
                    eventTitle={event.title}
                    onCancel={() => setEndModalVisible(false)}
                    onConfirm={handleConfirmEnd}
                    loading={stopping}
                />
            </>
        );
    }

    return (
        <>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.topRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>LIVE EVENT</Text>
                    </View>
                    <Pressable
                        style={[
                            styles.stopButton,
                            stopping && styles.stopButtonDisabled,
                        ]}
                        onPress={handleStop}
                        disabled={stopping}>
                        <Text style={styles.stopButtonText}>
                            {stopping ? "Stopping..." : "Stop Event"}
                        </Text>
                    </Pressable>
                </View>
                <Text style={styles.eventName}>{event.title}</Text>
                {event.startDate && (
                    <Text style={styles.duration}>
                        Duration: {formatDuration(elapsed)}
                    </Text>
                )}
                <View style={styles.buttonRow}>
                    {event.albumUrl ? (
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => Linking.openURL(event.albumUrl)}>
                            <Text style={styles.actionButtonText}>View Album</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
            <EndEventModal
                visible={endModalVisible}
                eventTitle={event.title}
                onCancel={() => setEndModalVisible(false)}
                onConfirm={handleConfirmEnd}
                loading={stopping}
            />
        </>
    );
}

const docStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 24,
        paddingBottom: 10,
        paddingTop: 20,
    },
    left: {
        gap: 10,
        flex: 1,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    badge: {
        backgroundColor: "#D4930D18",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeText: {
        color: "#D4930D",
        fontSize: 13,
        fontWeight: "600",
    },
    duration: {
        fontSize: 15,
        fontWeight: "300",
        color: Palette.primaryBlack100,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    stopCircle: {
        width: 34,
        height: 34,
        borderRadius: 18,
        backgroundColor: "#e74c3c",
        justifyContent: "center",
        alignItems: "center",
    },
    stopCircleDisabled: {
        opacity: 0.6,
    },
    eventName: {
        fontSize: 22,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        color: Palette.primaryBlack100,
        flexShrink: 1,
    },
    right: {
        gap: 12,
        alignItems: "flex-start",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconCircle: {
        width: 35,
        height: 35,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    iconImage: {
        width: 18,
        height: 18,
    },
    iconImageSmall: {
        width: 15,
        height: 15,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: "500",
        color: Palette.primaryBlack100,
    },
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: Palette.primaryPurple100,
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 12,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    badge: {
        backgroundColor: Palette.chartreuse,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeText: {
        color: Palette.primaryBlack100,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },
    eventName: {
        color: "#fff",
        fontSize: 22,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
    },
    duration: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 14,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 8,
    },
    actionButton: {
        alignSelf: "flex-start",
        backgroundColor: Palette.chartreuse,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
    },
    actionButtonText: {
        color: Palette.primaryBlack100,
        fontSize: 13,
        fontWeight: "700",
    },
    stopButton: {
        backgroundColor: "#EB1B1B",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stopButtonDisabled: {
        opacity: 0.6,
    },
    stopButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
});
