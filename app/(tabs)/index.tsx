import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
    const router = useRouter();
    const { user, loading, error, handleSignOut } = useGoogleAuth();
    
    // temporary for testing trail document screen 
    const eventCardID = "69b9c0d995522b9b514f88fb";

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Home</Text>
                {user && (
                    <>
                        <Text style={styles.name}>
                            {user.displayName ?? "User"}
                        </Text>
                        <Text style={styles.email}>{user.email}</Text>
                    </>
                )}
                {/* Add temporary Trello button */}
                <Pressable
                    style={styles.trelloButton}
                    onPress={() => router.push("/home-screen")}>
                    <Text style={styles.trelloButtonText}>
                        Go to Home Screen
                    </Text>
                </Pressable>
                <Pressable
                    style={styles.trelloButton}
                    onPress={() => router.push("/trello")}>
                    <Text style={styles.trelloButtonText}>
                        Go to Trello Test
                    </Text>
                </Pressable>
                <Pressable
                    style={styles.trelloButton}
                    onPress={() => router.push({
                        pathname: "/trail-document-screen",
                        params: { eventCardID }
                    })}>
                    <Text style={styles.trelloButtonText}>
                        Go to Trail Document
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.signOutButton,
                        loading && styles.signOutDisabled,
                    ]}
                    onPress={handleSignOut}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.signOutText}>Sign Out</Text>
                    )}
                </Pressable>
                {error && <Text style={styles.errorText}>{error.message}</Text>}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: "700",
        marginBottom: 8,
    },
    name: {
        fontSize: 20,
        fontWeight: "600",
    },
    email: {
        fontSize: 16,
        color: "#555",
    },
    signOutButton: {
        marginTop: 32,
        backgroundColor: "#0a7ea4",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 120,
        alignItems: "center",
    },
    signOutDisabled: {
        opacity: 0.7,
    },
    signOutText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    errorText: {
        color: "#c0392b",
        fontSize: 14,
        textAlign: "center",
    },
    trelloButton: {
        backgroundColor: "#0a7ea4",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 120,
        alignItems: "center",
    },
    trelloButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
});
