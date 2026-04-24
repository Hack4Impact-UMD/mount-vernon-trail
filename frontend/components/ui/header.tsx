import { useGoogleAuth } from "@/auth";
import { Palette } from "@/constants/theme";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeHeader({
    showGreeting = false,
}: {
    showGreeting?: boolean;
}) {
    const insets = useSafeAreaInsets();
	const { user } = useGoogleAuth();

    return (
        <View>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.topRow}>
                    <View>
                        <Image
                            source={require("../../assets/images/mvt-logo-white.png")}
                            resizeMode="contain"
                            style={styles.logo}
                        />
                    </View>
                </View>
            </View>
            {showGreeting && (
                <View style={styles.greetingContainer}>
                    <Text style={styles.greeting}>
                        Ready to make an impact,{"\n"}
                        <Text style={styles.name}>{user?.displayName?.split(" ")[0]}</Text>?
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Palette.primaryPurple100,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    logo: {
        width: 51,
        height: 51,
    },
    menu: {
        color: "white",
    },
    greetingContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    greeting: {
        fontFamily: "Lato_700Bold",
        fontSize: 22,
        color: "#000000",
    },
    name: {
        fontWeight: "700",
        color: Palette.primaryPurple100,
    },
});
