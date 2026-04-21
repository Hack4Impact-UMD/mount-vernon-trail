import BottomNav from "@/components/ui/bottom-nav";
import { Palette } from "@/constants/theme";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
    const { user, loading, error, handleSignOut } = useGoogleAuth();

    useEffect(() => {
        if (error) {
            Alert.alert("Sign Out Failed", error.message);
        }
    }, [error]);

    return (
        <View style={styles.screen}>
            <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
                <Text style={styles.name}>{user?.displayName ?? "User"}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                <Pressable
                    style={[styles.signOutButton, loading && styles.disabled]}
                    onPress={handleSignOut}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.signOutText}>Sign Out</Text>
                    )}
                </Pressable>
            </SafeAreaView>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        padding: 24,
    },
    name: { fontSize: 22, fontWeight: "700", fontFamily: "Lato_700Bold" },
    email: { fontSize: 16, color: "#555", fontFamily: "Lato_400Regular" },
    signOutButton: {
        marginTop: 20,
        backgroundColor: Palette.primaryPurple100,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 160,
        alignItems: "center",
    },
    disabled: { opacity: 0.7 },
    signOutText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        fontFamily: "Lato_700Bold",
    },
});
