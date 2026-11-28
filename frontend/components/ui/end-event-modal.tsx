import { Palette } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Props = {
    visible: boolean;
    eventTitle: string;
    onCancel: () => void;
    onConfirm: (notes: string) => void;
    initialNotes?: string;
    loading?: boolean;
    // Shown in this modal rather than in a separate AlertPopup: iOS presents
    // only one modal at a time, so a sibling popup stayed hidden behind this one.
    error?: string | null;
};

export default function EndEventModal({
    visible,
    eventTitle,
    onCancel,
    onConfirm,
    initialNotes,
    loading = false,
    error,
}: Props) {
    // Passed straight through; this modal has no notes field of its own.
    const notes = initialNotes ?? "";

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Pressable
                        style={styles.closeBtn}
                        onPress={onCancel}
                        hitSlop={10}>
                        <Feather
                            name="x"
                            size={20}
                            color="#666"
                        />
                    </Pressable>
                    <Text style={styles.title}>End {eventTitle}?</Text>
                    <Text style={styles.body}>
                        Ending this event will lead you to the draft event
                        document page.
                    </Text>
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorTitle}>
                                Could not end the event
                            </Text>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                    <Pressable
                        style={[
                            styles.confirmBtn,
                            loading && styles.confirmBtnDisabled,
                        ]}
                        onPress={() => onConfirm(notes)}
                        disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.confirmRow}>
                                <Text style={styles.confirmText}>CONFIRM</Text>
                                <Feather
                                    name="chevron-right"
                                    size={16}
                                    color="#fff"
                                />
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    card: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 22,
        gap: 14,
    },
    closeBtn: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F0F0F0",
    },
    title: {
        fontSize: 18,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        color: "#111",
        paddingRight: 24,
    },
    body: {
        fontSize: 14,
        color: "#555",
        fontFamily: "Lato_400Regular",
        lineHeight: 20,
    },
    errorBox: {
        backgroundColor: "#FDECEC",
        borderRadius: 10,
        padding: 10,
        gap: 2,
    },
    errorTitle: {
        fontSize: 13,
        color: "#A33B3D",
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
    },
    errorText: {
        fontSize: 13,
        color: "#A33B3D",
        fontFamily: "Lato_400Regular",
        lineHeight: 18,
    },
    confirmBtn: {
        alignSelf: "flex-start",
        backgroundColor: Palette.green,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 9999,
        marginTop: 6,
    },
    confirmBtnDisabled: {
        opacity: 0.6,
    },
    confirmRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    confirmText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.6,
        fontFamily: "Lato_700Bold",
    },
});
