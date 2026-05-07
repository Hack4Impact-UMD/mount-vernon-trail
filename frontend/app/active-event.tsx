import EndEventModal from "@/components/ui/end-event-modal";
import type { Event } from "@/services/event-service";
import {
    getActiveEvent,
    setEventInactive,
    updateEventNotes
} from "@/services/event-service";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActiveEventScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        getActiveEvent()
            .then(setEvent)
            .catch((e) => setFetchError((e as Error).message))
            .finally(() => setLoading(false));
    }, []);

    const handleConfirmEnd = async (notes?: string) => {
        if (!event) return;
        setEnding(true);
        try {
            await updateEventNotes(event.eventId, notes?.trim() ?? "");
            await setEventInactive(event.eventId);
            setModalVisible(false);
            router.replace({
                pathname: "/event-summary",
                params: { eventId: event.eventId },
            });
        } catch (e) {
            Alert.alert("Error", (e as Error).message);
            setEnding(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator
                    size="large"
                    style={styles.centered}
                />
            </SafeAreaView>
        );
    }

    if (fetchError || !event) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.errorText}>
                        {fetchError ?? "No active event found."}
                    </Text>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ONGOING EVENT</Text>
                    </View>
                </View>

                <Text style={styles.title}>{event.title}</Text>

                {event.description ? (
                    <Text style={styles.description}>{event.description}</Text>
                ) : null}

                <Pressable
                    style={[
                        styles.endButton,
                        ending && styles.endButtonDisabled,
                    ]}
                    onPress={() => setModalVisible(true)}
                    disabled={ending}>
                    {ending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.endButtonText}>End Event</Text>
                    )}
                </Pressable>
            </View>
            <EndEventModal
                visible={modalVisible}
                eventTitle={event.title}
                onCancel={() => setModalVisible(false)}
                onConfirm={handleConfirmEnd}
                loading={ending}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    centered: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 24,
        alignItems: "center",
        gap: 12,
    },
    badgeRow: {
        marginTop: 8,
    },
    badge: {
        backgroundColor: "#27ae60",
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 12,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 4,
    },
    description: {
        fontSize: 16,
        color: "#555",
        textAlign: "center",
    },
    endButton: {
        marginTop: "auto",
        width: "100%",
        backgroundColor: "#e74c3c",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    endButtonDisabled: {
        opacity: 0.6,
    },
    endButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    errorText: {
        color: "#c0392b",
        fontSize: 14,
        textAlign: "center",
    },
    backButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: "#3498db",
        borderRadius: 8,
    },
    backButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
});
