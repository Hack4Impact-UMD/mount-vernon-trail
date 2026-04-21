import BottomNav from "@/components/ui/bottom-nav";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function DraftsScreen() {
    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <Text style={styles.text}>Drafts</Text>
            </View>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    content: { flex: 1, justifyContent: "center", alignItems: "center" },
    text: { fontSize: 16, color: "#888", fontFamily: "Lato_400Regular" },
});
