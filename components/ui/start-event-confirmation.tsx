import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { Palette } from "@/constants/theme";

interface StartEventConfirmationProps {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function StartEventConfirmation({
    visible,
    onConfirm,
    onCancel,
}: StartEventConfirmationProps) {
    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <LinearGradient
                colors={[Palette.primaryPurple100, Palette.primaryPurple70]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}>
                <View style={styles.content}>
                    <Text style={styles.message}>
                        Are you sure you want to{" "}
                        <Text style={styles.messageBold}>start</Text>
                        {"\n"}this event?
                    </Text>

                    <View style={styles.buttonRow}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.cancelButton,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={onCancel}>
                            <Text style={styles.cancelText}>CANCEL</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.confirmButton,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={onConfirm}>
                            <Text style={styles.confirmText}>CONFIRM</Text>
                            <ChevronRight
                                size={16}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    </View>
                </View>

                <Image
                    source={require("../../assets/images/beaver-limbloppers.png")}
                    style={styles.beaverImage}
                    resizeMode="contain"
                />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        paddingHorizontal: 24,
        zIndex: 10,
    },
    card: {
        width: "100%",
        minHeight: 127,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
        shadowColor: "#693894",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    content: {
        flex: 1,
        paddingLeft: 20,
        paddingVertical: 18,
        gap: 14,
    },
    message: {
        fontSize: 16,
        fontFamily: "Lato_400Regular",
        fontWeight: "400",
        color: "#FFFFFF",
        lineHeight: 22,
    },
    messageBold: {
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
    },
    buttonRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    cancelButton: {
        paddingHorizontal: 20,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 9999,
        backgroundColor: "#A33B3D",
    },
    confirmButton: {
        flexDirection: "row",
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
        borderRadius: 9999,
        backgroundColor: Palette.green,
        gap: 4,
    },
    buttonPressed: {
        opacity: 0.75,
    },
    cancelText: {
        fontSize: 13,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
    confirmText: {
        fontSize: 13,
        fontFamily: "Lato_700Bold",
        fontWeight: "700",
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
    beaverImage: {
        width: 120,
        height: 120,
        marginRight: -10,
    },
});
