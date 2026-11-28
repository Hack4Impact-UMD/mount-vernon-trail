import { ChevronRight } from "lucide-react-native";
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
    onCancel: () => void;
    onConfirm: () => void;
    loading?: boolean;
    // Shown in this modal rather than in a separate AlertPopup: iOS presents
    // only one modal at a time, so a sibling popup stayed hidden behind this one.
    error?: string | null;
};

export default function PublishEventModal({
    visible,
    onCancel,
    onConfirm,
    loading = false,
    error,
}: Props) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>
                        Are you sure you want to{" "}
                        <Text style={styles.titleEmph}>publish</Text> this event
                        in Trello?
                    </Text>
                    <Text style={styles.body}>
                        Please note: <Text style={styles.bodyEmph}>This action is irreversible.</Text>
                    </Text>
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorTitle}>Publish failed</Text>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                    <View style={styles.actions}>
                        <Pressable
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onCancel}
                            disabled={loading}>
                            <Text style={styles.cancelText}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.btn,
                                styles.confirmBtn,
                                loading && styles.btnDisabled,
                            ]}
                            onPress={onConfirm}
                            disabled={loading}>
								<Text style={styles.confirmText}>CONFIRM</Text>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                
								<ChevronRight
                                size={16}
                                color="#FFFFFF"
                            />
                            )}
                        </Pressable>
                    </View>
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
        backgroundColor: "#D4930D",
        borderRadius: 16,
        padding: 22,
        gap: 12,
    },
    title: {
        fontSize: 16,
        color: "white",
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        lineHeight: 22,
    },
    titleEmph: {
        fontWeight: "800",
    },
    body: {
        fontSize: 14,
        color: "white",
        fontFamily: "Lato_400Regular",
        lineHeight: 20,
    },
    bodyEmph: {
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
    },
    errorBox: {
        backgroundColor: "rgba(0,0,0,0.18)",
        borderRadius: 10,
        padding: 10,
        gap: 2,
    },
    errorTitle: {
        fontSize: 13,
        color: "white",
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
    },
    errorText: {
        fontSize: 13,
        color: "white",
        fontFamily: "Lato_400Regular",
        lineHeight: 18,
    },
    actions: {
        flexDirection: "row",
        gap: 20,
        marginTop: 6,
    },
    btn: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 9999,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtn: {
        backgroundColor: "#D43F44",
    },
    confirmBtn: {
		flexDirection: "row",
        backgroundColor: "#3BA34C",
		gap: 4
    },
    btnDisabled: {
        opacity: 0.6,
    },
    cancelText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.6,
        fontFamily: "Lato_700Bold",
    },
    confirmText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.6,
        fontFamily: "Lato_700Bold",
    },
});
