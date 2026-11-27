import { Palette } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CameraPermissionPromptProps = {
    canAskAgain: boolean;
    onRequest: () => void;
    onOpenSettings: () => void;
    onBack: () => void;
};

export default function CameraPermissionPrompt({
    canAskAgain,
    onRequest,
    onOpenSettings,
    onBack,
}: CameraPermissionPromptProps) {
    const insets = useSafeAreaInsets();

    return (
        <LinearGradient
            colors={[Palette.primaryPurple70, Palette.primaryPurple100]}
            style={[
                styles.container,
                { paddingTop: insets.top + 12, paddingBottom: insets.bottom },
            ]}>
            <Pressable
                style={styles.backButton}
                onPress={onBack}
                accessibilityRole="button">
                <Text style={styles.backButtonText}>Go back</Text>
            </Pressable>

            <View style={styles.content}>
                <View style={styles.iconCircle}>
                    <Image
                        source={require("../../assets/images/camera-purple.png")}
                        style={styles.icon}
                        resizeMode="contain"
                    />
                </View>

                <Text style={styles.title}>Camera access needed</Text>
                <Text style={styles.message}>
                    Volunteers photograph each trail issue before and after
                    fixing it. Allow camera access to take those photos.
                </Text>

                {canAskAgain ? (
                    <Pressable
                        style={styles.primaryButton}
                        onPress={onRequest}
                        accessibilityRole="button">
                        <Text style={styles.primaryButtonText}>
                            Allow camera
                        </Text>
                    </Pressable>
                ) : (
                    <>
                        <Text style={styles.hint}>
                            Camera access is turned off for this app. Turn it on
                            in Settings, then come back here.
                        </Text>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={onOpenSettings}
                            accessibilityRole="button">
                            <Text style={styles.primaryButtonText}>
                                Open Settings
                            </Text>
                        </Pressable>
                    </>
                )}
            </View>

            <Image
                source={require("../../assets/images/beaver-limbloppers.png")}
                style={[styles.beaver, { bottom: insets.bottom - 20 }]}
                resizeMode="contain"
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    backButton: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF33",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    backButtonText: {
        color: "#FFFFFF",
        fontFamily: "Lato_700Bold",
        fontSize: 14,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        paddingBottom: 120,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },
    icon: {
        width: 56,
        height: 56,
    },
    title: {
        color: "#FFFFFF",
        fontFamily: "Lato_700Bold",
        fontSize: 24,
        textAlign: "center",
    },
    message: {
        color: "#FFFFFF",
        fontFamily: "Lato_400Regular",
        fontSize: 16,
        lineHeight: 23,
        textAlign: "center",
    },
    hint: {
        color: Palette.primaryPurple30,
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
    },
    primaryButton: {
        marginTop: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 28,
        paddingVertical: 14,
    },
    primaryButtonText: {
        color: Palette.primaryPurple100,
        fontFamily: "Lato_700Bold",
        fontSize: 16,
    },
    beaver: {
        position: "absolute",
        right: -10,
        width: 150,
        height: 150,
    },
});
