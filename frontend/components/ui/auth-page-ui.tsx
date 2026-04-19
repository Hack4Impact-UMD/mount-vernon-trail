import React from 'react';
import { StyleSheet, View, ImageBackground, Image, ActivityIndicator, Pressable, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type AuthPageUIProps = {
    onPressGoogle: () => void;
    isLoading?: boolean;
    errorMessage?: string;
};

export default function AuthPageUI({ onPressGoogle, isLoading = false, errorMessage }: AuthPageUIProps) {
    return (
        <ImageBackground source={require("../../assets/images/splash-screen-bg.png")} resizeMode="cover" style={styles.bg}>
            <SafeAreaView style={styles.mainBody} >
                <View style={styles.logoWrap}>
                    <Image source={require("../../assets/images/mvt-logo-white.png")} resizeMode="contain" style={styles.logo}/>
                </View>

                <View style={styles.welcomeWrap}>
                    <Text style={styles.welcome}>Welcome to{"\n"}Mount Vernon Trail</Text>
                </View>

                <View style={styles.button}>
                    <Pressable
                        onPress={onPressGoogle}
                        disabled={isLoading}
                        accessibilityLabel="Sign in with Google"
                        style={({ pressed }) => [
                            styles.googleButton,
                            pressed && !isLoading ? styles.googleButtonPressed : null,
                            isLoading ? styles.googleButtonDisabled : null,
                        ]}
                    >
                        <View style={styles.googleContent}>
                            <Image source={require("../../assets/images/g-logo.png")} style={styles.googleIcon}></Image>
                            <Text style={styles.googleText}>Sign in with Google</Text>
                            {isLoading && <ActivityIndicator/>}
                        </View>
                    </Pressable>
                    {errorMessage ? (
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                </View>
                
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
    },
    mainBody: {
        flex: 1,
        paddingTop: SCREEN_HEIGHT * 0.08,
        justifyContent: "space-between",
        alignItems: "center",
    },
    logoWrap: {
        alignItems: "center",
    },
    logo: {
        width: SCREEN_HEIGHT * 0.22,
        height: SCREEN_HEIGHT * 0.22,
    },
    welcomeWrap: {
        alignItems: "center",
        flex: 1,
        justifyContent: "flex-end",
        paddingBottom: SCREEN_HEIGHT * 0.06,
    },
    welcome: {
        fontSize: 36,
        color: "white",
        fontWeight: "700",
        textAlign: "center",
        fontFamily: "Lato_700Bold",
    },
    button: {
        alignItems: "center",
        width: "100%",
        paddingBottom: SCREEN_HEIGHT * 0.08,
    },
    googleButton: {
        width: "65%",                      
        height: SCREEN_HEIGHT * 0.072,
        backgroundColor: "white",
        borderRadius: 100,
        borderWidth: 1,
        justifyContent: "center",
    },
    googleButtonPressed: {
        transform: [{ scale: 0.99 }],
        opacity: 0.95,
    },
    googleButtonDisabled: {
        opacity: 0.9,
    },
    googleContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    googleIcon: {
        width: SCREEN_HEIGHT * 0.033,
        height: SCREEN_HEIGHT * 0.033,
        marginRight: SCREEN_HEIGHT * 0.012,
    },
    googleText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000000",
    },
    errorText: {
        marginTop: 12,
        color: "white",
        fontSize: 14,
        textAlign: "center",
    },
});
