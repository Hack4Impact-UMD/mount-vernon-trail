import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/constants/theme";
import BottomNav from "./bottom-nav";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

type TrelloLoginUIProps = {
    userName: string;
    onPressTrello: () => void;
    isLoading?: boolean;
};

export default function TrelloLoginUI({
    userName,
    onPressTrello,
    isLoading = false,
}: TrelloLoginUIProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Image
                    source={require("../../assets/images/mvt-logo-white.png")}
                    resizeMode="contain"
                    style={styles.logo}
                />
            </View>

            <View style={styles.body}>
                <View style={styles.topSection}>
                    <View style={styles.content}>
                        <Text style={styles.welcome}>
                            Welcome,{" "}
                            <Text style={styles.userName}>{userName}!</Text>
                        </Text>
                        <Text style={styles.subtitle}>
                            Log in with Trello to view your events!
                        </Text>
                    </View>

                    <Pressable
                        onPress={onPressTrello}
                        disabled={isLoading}
                        accessibilityLabel="Sign in with Trello"
                        style={({ pressed }) => [
                            styles.trelloButton,
                            pressed && !isLoading
                                ? styles.trelloButtonPressed
                                : null,
                            isLoading ? styles.trelloButtonDisabled : null,
                        ]}>
                        <View style={styles.trelloContent}>
                            <Image
                                source={require("../../assets/images/trello-logo.png")}
                                resizeMode="contain"
                                style={styles.trelloLogo}
                            />
                            {isLoading && (
                                <ActivityIndicator style={styles.spinner} />
                            )}
                        </View>
                    </Pressable>
                </View>

                <View style={styles.beaverWrap}>
                    <Image
                        source={require("../../assets/images/beaver-limbloppers.png")}
                        resizeMode="contain"
                        style={styles.beaver}
                    />
                </View>
            </View>

            <BottomNav
                active="home"
                onTabPress={() => {}}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    header: {
        backgroundColor: Palette.primaryPurple100,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    logo: {
        width: 51,
        height: 51,
    },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 30,
        paddingTop: SCREEN_HEIGHT * (180 / 810),
    },
    topSection: {
        alignItems: "center",
        width: "100%",
    },
    content: {
        alignItems: "center",
        marginBottom: 65,
    },
    welcome: {
        fontFamily: "Lato_700Bold",
        fontSize: 20,
        lineHeight: 28,
        color: "#1A1A1A",
        textAlign: "center",
    },
    userName: {
        color: Palette.primaryPurple100,
    },
    subtitle: {
        fontFamily: "Lato_700Bold",
        fontSize: 17,
        lineHeight: 28,
        color: "#1A1A1A",
        textAlign: "center",
        marginTop: 12,
    },
    trelloButton: {
        width: SCREEN_WIDTH * (265 / 390),
        height: SCREEN_HEIGHT * (61 / 810),
        backgroundColor: "#ffffff",
        borderRadius: 50,
        borderWidth: 3,
        borderColor: "#8A6BAD",
        justifyContent: "center",
        alignSelf: "center",
    },
    trelloButtonPressed: {
        transform: [{ scale: 0.99 }],
        opacity: 0.95,
    },
    trelloButtonDisabled: {
        opacity: 0.7,
    },
    trelloContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    trelloLogo: {
        width: "80%",
        height: SCREEN_HEIGHT * 0.06,
    },
    spinner: {
        marginLeft: 8,
    },
    beaverWrap: {
        alignItems: "center",
        marginBottom: -60,
    },
    beaver: {
        width: SCREEN_WIDTH * (270 / 390),
        height: SCREEN_HEIGHT * (200 / 810),
    },
});
