import { Palette } from "@/constants/theme";
import type { Event } from "@/services/event-service";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TrailEventHeaderProps {
    event: Event;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function TrailEventHeader({ event }: TrailEventHeaderProps) {
    const insets = useSafeAreaInsets();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!event.startDate) return;

        const startMs = event.startDate.toMillis();

        const tick = () => {
            const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
            setElapsed(diff);
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [event.startDate]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.topRow}>
                <Image
                    source={require("../../assets/images/mvt-logo-white.png")}
                    resizeMode="contain"
                    style={styles.logo}
                />
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>LIVE EVENT</Text>
                </View>
            </View>
            <Text style={styles.eventName}>{event.title}</Text>
            {event.startDate && (
                <Text style={styles.duration}>
                    Duration: {formatDuration(elapsed)}
                </Text>
            )}
        </View>
    );
}

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
    logo: {
        width: 51,
        height: 51,
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
});
