import { Colors, Palette } from "@/constants/theme";
import type { MapPin } from "@/components/map-overlays";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MapIssueCard({
    issue: selectedIssue,
    onClose,
}: {
    issue: MapPin | null;
    onClose: () => void;
}) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [progress] = useState(() => new Animated.Value(0));
    const [displayedIssue, setDisplayedIssue] = useState<MapPin | null>(
        selectedIssue,
    );
    const issue = selectedIssue ?? displayedIssue;
    if (selectedIssue && selectedIssue !== displayedIssue) {
        setDisplayedIssue(selectedIssue);
    }
    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: selectedIssue ? 1 : 0,
            duration: selectedIssue ? 280 : 320,
            easing: selectedIssue
                ? Easing.out(Easing.cubic)
                : Easing.inOut(Easing.cubic),
            useNativeDriver: true,
        });
        animation.start(({ finished }) => {
            if (finished && !selectedIssue) setDisplayedIssue(null);
        });
        return () => animation.stop();
    }, [selectedIssue, progress]);
    const status = issue?.status;
    if (!issue) return null;
    return (
        <View
            style={styles.container}
            pointerEvents="box-none">
            <Animated.View
                style={[
                    styles.card,
                    {
                        paddingBottom: Math.max(insets.bottom, 24),
                        transform: [
                            {
                                translateY: progress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [height, 0],
                                }),
                            },
                        ],
                    },
                ]}>
                <Pressable
                    onPress={onClose}
                    style={styles.close}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close issue details">
                    <X
                        size={20}
                        color={Palette.primaryBlack70}
                    />
                </Pressable>
                <Image
                    source={
                        issue?.imageUrl
                            ? { uri: issue.imageUrl }
                            : require("@/assets/images/placeholder.png")
                    }
                    style={styles.image}
                    contentFit="cover"
                    accessibilityLabel={issue?.title ?? "Trail issue photo"}
                />
                {(status || issue?.elapsedTime) && (
                    <View style={styles.metadata}>
                        {status && (
                            <View
                                style={[
                                    styles.badge,
                                    status === "Completed" && styles.completed,
                                ]}>
                                <Text
                                    style={[
                                        styles.status,
                                        status === "Completed" &&
                                            styles.completedText,
                                    ]}>
                                    {status}
                                </Text>
                            </View>
                        )}
                        {issue?.elapsedTime && (
                            <Text style={styles.elapsed}>
                                {issue.elapsedTime}
                            </Text>
                        )}
                    </View>
                )}
                <Text
                    accessibilityRole="header"
                    style={styles.title}>
                    {issue?.title ?? "Trail issue"}
                </Text>
                {issue?.locationName && (
                    <Text style={styles.location}>{issue.locationName}</Text>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 10,
        justifyContent: "flex-end",
        backgroundColor: "transparent",
    },
    card: {
        backgroundColor: Colors.light.background,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: Palette.primaryBlack30,
        paddingHorizontal: 24,
        paddingTop: 42,
    },
    close: { position: "absolute", top: 12, right: 18, padding: 4 },
    image: {
        width: "100%",
        aspectRatio: 2,
        borderRadius: 18,
        backgroundColor: `${Palette.primaryBlack30}20`,
        marginBottom: 16,
    },
    metadata: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    badge: {
        backgroundColor: Palette.statusAmberBackground,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    status: {
        color: Palette.statusAmber,
        fontSize: 14,
        fontFamily: "Lato_400Regular",
    },
    completed: { backgroundColor: `${Palette.green}18` },
    completedText: { color: Palette.green },
    elapsed: {
        color: Palette.primaryBlack70,
        fontSize: 14,
        fontFamily: "Lato_400Regular",
        fontVariant: ["tabular-nums"],
    },
    title: {
        color: Palette.primaryBlack100,
        fontSize: 23,
        fontFamily: "Lato_700Bold",
        marginBottom: 6,
    },
    location: {
        color: Palette.primaryBlack70,
        fontSize: 16,
        fontFamily: "Lato_700Bold",
    },
});
