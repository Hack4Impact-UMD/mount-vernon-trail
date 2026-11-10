import { Palette } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface AlertPopupProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    onCancel?: () => void;
}

export default function AlertPopup({
    visible,
    title,
    message,
    onClose,
    confirmText = "OK",
    onConfirm,
    cancelText,
    onCancel,
}: AlertPopupProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}>
            <View style={styles.overlay}>
                <LinearGradient
                    colors={[Palette.primaryPurple70, Palette.primaryPurple100]}
                    style={styles.card}>
                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        <View style={styles.buttonRow}>
                            {cancelText && onCancel && (
                                <Pressable
                                    style={styles.cancelButton}
                                    onPress={onCancel}>
                                    <Text style={styles.buttonText}>
                                        {cancelText}
                                    </Text>
                                </Pressable>
                            )}

                            <Pressable
                                style={styles.confirmButton}
                                onPress={onConfirm ?? onClose}>
                                <Text style={styles.buttonText}>
                                    {confirmText}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    <Image
                        source={require("../../assets/images/beaver-limbloppers.png")}
                        style={styles.beaver}
                        resizeMode="contain"
                    />
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#D9D9D999",
        paddingHorizontal: 24,
    },
    card: {
        width: "100%",
        minHeight: 160,
        borderRadius: 16,
        overflow: "hidden",
        justifyContent: "center",
    },
    content: {
        padding: 20,
        paddingRight: 110,
        gap: 10,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    message: {
        fontSize: 14,
        color: "#FFFFFF",
        lineHeight: 21,
    },
    buttonRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
    },
    cancelButton: {
        alignSelf: "flex-start",
        backgroundColor: "#A33B3D",
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 7,
    },
    confirmButton: {
        alignSelf: "flex-start",
        backgroundColor: Palette.primaryPurple100,
        borderWidth: 1,
        borderColor: "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 7,
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    beaver: {
        position: "absolute",
        width: 115,
        height: 115,
        right: -15,
        bottom: -20,
    },
});
