import { Palette } from "@/constants/theme";
import { ArrowLeft, Play } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import StartEventConfirmation from "./start-event-confirmation";
import {
    formatEventDate,
    type UpcomingEventItem,
} from "./upcoming-events-card";

interface TrailEventCardProps {
    event: UpcomingEventItem | null;
    visible: boolean;
    onClose: () => void;
    onStartEvent: (event: UpcomingEventItem) => void;
}

export default function TrailEventCard({
    event,
    visible,
    onClose,
    onStartEvent,
}: TrailEventCardProps) {
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleClose = () => {
        setShowConfirmation(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}>
            {event ? (
                <View style={styles.modalContainer}>
                    <Pressable
                        style={styles.backdrop}
                        onPress={handleClose}
                    />

                    <View style={styles.card}>
                        {/* Back button */}
                        <Pressable
                            style={styles.backButton}
                            onPress={handleClose}
                            hitSlop={8}>
                            <ArrowLeft
                                size={20}
                                color={"#0A0A0A"}
                            />
                            <Text style={styles.backText}>Back</Text>
                        </Pressable>

                        {/* Title */}
                        <Text style={styles.heading}>Today's Event</Text>
                        <View style={styles.divider} />

                        {/* Event details */}
                        <Text style={styles.eventName}>{event.name}</Text>
                        <Text style={styles.eventDate}>
                            {formatEventDate(event.date)}
                        </Text>

                        <View style={styles.detailsSection}>
                            {event.eventLeader ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Event Leader:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {event.eventLeader}
                                    </Text>
                                </View>
                            ) : null}
                            {event.zoneLeaders ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Zone Leaders:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {event.zoneLeaders}
                                    </Text>
                                </View>
                            ) : null}
                            {event.toolHaulers ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Tool Haulers:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {event.toolHaulers}
                                    </Text>
                                </View>
                            ) : null}
                            {event.gloverLover ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Glover Lover:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {event.gloverLover}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        {/* Start Event button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.startButton,
                                pressed && styles.startButtonPressed,
                            ]}
                            onPress={() => setShowConfirmation(true)}>
                            <Play
                                size={16}
                                color="#FFFFFF"
                                fill="#FFFFFF"
                                style={styles.playIcon}
                            />
                            <Text style={styles.startButtonText}>
                                Start Event
                            </Text>
                        </Pressable>
                    </View>

                    {showConfirmation && (
                        <StartEventConfirmation
                            visible
                            onCancel={() => setShowConfirmation(false)}
                            onConfirm={() => {
                                setShowConfirmation(false);
                                onStartEvent(event);
                            }}
                        />
                    )}
                </View>
            ) : null}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
    },
    card: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: "#99A1AF",
        paddingTop: 20,
        paddingHorizontal: 24,
        paddingBottom: 40,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -25 },
        shadowOpacity: 0.25,
        shadowRadius: 50,
        elevation: 24,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 12,
    },
    backText: {
        fontSize: 14,
        fontFamily: "Lato_400Regular",
        fontWeight: "500",
        lineHeight: 20,
        letterSpacing: -0.15,
        textAlign: "center",
        color: "#0A0A0A",
    },
    heading: {
        fontSize: 18,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        lineHeight: 28,
        letterSpacing: -0.44,
        color: "#0A0A0A",
        marginBottom: 10,
    },
    divider: {
        height: 1,
        backgroundColor: "#D1D5DB",
        marginBottom: 16,
        marginHorizontal: -24,
    },
    eventName: {
        fontSize: 16,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        lineHeight: 24,
        letterSpacing: -0.31,
        color: "#0A0A0A",
        marginBottom: 4,
        textAlign: "center",
    },
    eventDate: {
        fontSize: 14,
        fontFamily: "Lato_400Regular",
        fontWeight: "400",
        lineHeight: 20,
        letterSpacing: -0.15,
        color: "#4A5565",
        marginBottom: 20,
        textAlign: "center",
    },
    detailsSection: {
        gap: 8,
        marginBottom: 28,
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    detailLabel: {
        fontSize: 14,
        fontFamily: "Lato_700Bold",
        lineHeight: 14,
        letterSpacing: -0.15,
        color: "#0A0A0A",
        width: 100,
    },
    detailValue: {
        fontSize: 14,
        fontFamily: "Lato_400Regular",
        color: "#4A5565",
    },
    startButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Palette.green,
        borderRadius: 10,
        height: 48,
        gap: 8,
    },
    startButtonPressed: {
        opacity: 0.85,
    },
    playIcon: {
        marginRight: 2,
    },
    startButtonText: {
        fontSize: 16,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
