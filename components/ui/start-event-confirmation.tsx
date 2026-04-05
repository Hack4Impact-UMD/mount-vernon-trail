import React from "react";
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { Palette } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const BEAVER_SIZE = Math.round(CARD_WIDTH * 0.42);
const BEAVER_OFFSET_RIGHT = Math.round(BEAVER_SIZE * -0.18);
const BEAVER_OFFSET_BOTTOM = Math.round(BEAVER_SIZE * -0.3);

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
                colors={[Palette.primaryPurple70, Palette.primaryPurple100]}
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
        backgroundColor: "#D9D9D999",
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
        gap: 22,
        paddingLeft: 16,
    },
    cancelButton: {
        width: 74,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 9999,
        backgroundColor: "#A33B3D",
    },
    confirmButton: {
        flexDirection: "row",
        width: 95,
        height: 24,
        paddingLeft: 10,
        paddingRight: 6,
        alignItems: "center",
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
        width: BEAVER_SIZE,
        height: BEAVER_SIZE,
        position: "absolute",
        right: BEAVER_OFFSET_RIGHT,
        bottom: BEAVER_OFFSET_BOTTOM,
    },
});
