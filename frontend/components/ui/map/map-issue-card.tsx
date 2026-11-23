import { Colors, Palette } from "@/constants/theme";
import type { MapPin } from "@/components/ui/map/map-overlays";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
    Animated,
    Easing,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { getIssueSheetTarget } from "@/utils/issue-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MapIssueCard({
    issue: selectedIssue,
    onClose,
}: {
    issue: MapPin | null;
    onClose: () => void;
}) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [availableHeight, setAvailableHeight] = useState(height);
    const expandedHeight = availableHeight * 0.9;
    const compactHeight = Math.min(340, availableHeight * 0.44);
    const compactOffset = expandedHeight - compactHeight;
    const [translation] = useState(() => new Animated.Value(height));
    const visible = selectedIssue !== null;
    const groupSelected = (selectedIssue?.sameLocationIssues?.length ?? 0) > 1;
    const [displayedIssue, setDisplayedIssue] = useState<MapPin | null>(
        selectedIssue,
    );
    const issue = selectedIssue ?? displayedIssue;
    if (selectedIssue && selectedIssue !== displayedIssue) {
        setDisplayedIssue(selectedIssue);
    }
    useEffect(() => {
        const animation = Animated.timing(translation, {
            toValue: visible
                ? groupSelected
                    ? 0
                    : compactOffset
                : expandedHeight,
            duration: visible ? 280 : 320,
            easing: visible
                ? Easing.out(Easing.cubic)
                : Easing.inOut(Easing.cubic),
            useNativeDriver: true,
        });
        animation.start(({ finished }) => {
            if (finished && !visible) setDisplayedIssue(null);
        });
        return () => animation.stop();
    }, [visible, groupSelected, translation, compactOffset, expandedHeight]);

    const panResponder = useMemo(() => {
        let dragStart = compactOffset;
        const snap = (offset: number) =>
            Animated.spring(translation, {
                toValue: offset,
                useNativeDriver: true,
                damping: 26,
                stiffness: 240,
                mass: 1,
                overshootClamping: true,
            }).start();
        return PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) =>
                Math.abs(gesture.dy) > 5 &&
                Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderGrant: () => {
                translation.stopAnimation((value) => {
                    dragStart = value;
                });
            },
            onPanResponderMove: (_, gesture) => {
                translation.setValue(
                    Math.max(
                        0,
                        Math.min(expandedHeight, dragStart + gesture.dy),
                    ),
                );
            },
            onPanResponderRelease: (_, gesture) => {
                const offset = Math.max(0, dragStart + gesture.dy);
                const target = getIssueSheetTarget(
                    offset,
                    gesture.vy,
                    compactOffset,
                );
                if (target === "dismissed") onClose();
                else snap(target === "expanded" ? 0 : compactOffset);
            },
            onPanResponderTerminate: () =>
                snap(dragStart < compactOffset / 2 ? 0 : compactOffset),
        });
    }, [translation, compactOffset, expandedHeight, onClose]);
    const status = issue?.status;
    const groupedIssues = issue?.sameLocationIssues;
    const isGroup = !!groupedIssues && groupedIssues.length > 1;
    const openIssue = (item: MapPin) => {
        onClose();
        router.push({
            pathname: "/trail-issue-screen",
            params: {
                issueId: item.id,
                issueName: item.title ?? "Trail issue",
            },
        });
    };
    if (!issue) return null;
    return (
        <View
            style={styles.container}
            pointerEvents="box-none"
            onLayout={(event) =>
                setAvailableHeight(event.nativeEvent.layout.height)
            }>
            <Animated.View
                style={[
                    styles.card,
                    {
                        height: expandedHeight,
                        transform: [{ translateY: translation }],
                    },
                ]}>
                <View
                    style={styles.dragArea}
                    {...panResponder.panHandlers}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Expand or collapse issue details"
                        accessibilityHint="Drag up to expand, down to collapse or dismiss"
                        onPress={() =>
                            translation.stopAnimation((value) => {
                                Animated.spring(translation, {
                                    toValue:
                                        value < compactOffset / 2
                                            ? compactOffset
                                            : 0,
                                    useNativeDriver: true,
                                    overshootClamping: true,
                                }).start();
                            })
                        }
                        style={styles.handleTouch}>
                        <View style={styles.handle} />
                    </Pressable>
                </View>
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
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{
                        paddingBottom: Math.max(insets.bottom, 24),
                    }}
                    showsVerticalScrollIndicator={isGroup}
                    accessibilityLabel={
                        isGroup ? "Issues at this location" : "Issue details"
                    }>
                    {isGroup ? (
                        <>
                            <Text style={styles.groupTitle}>
                                {issue.locationName ?? "Trail issues"}
                            </Text>
                            <Text style={styles.groupCount}>
                                {groupedIssues.length} issues at this location
                            </Text>
                            {groupedIssues.map((item) => (
                                <Pressable
                                    key={item.id}
                                    accessibilityRole="link"
                                    accessibilityLabel={`Open issue: ${item.title ?? "Trail issue"}`}
                                    disabled={!selectedIssue}
                                    onPress={() => openIssue(item)}
                                    style={styles.issueRow}>
                                    <Image
                                        source={
                                            item.imageUrl
                                                ? { uri: item.imageUrl }
                                                : require("@/assets/images/placeholder.png")
                                        }
                                        style={styles.thumbnail}
                                        contentFit="cover"
                                    />
                                    <View style={styles.rowDetails}>
                                        <Text style={styles.rowTitle}>
                                            {item.title ?? "Trail issue"}
                                        </Text>
                                        {item.status && (
                                            <Text style={styles.location}>
                                                {item.status}
                                            </Text>
                                        )}
                                        {item.elapsedTime && (
                                            <Text style={styles.elapsed}>
                                                {item.elapsedTime}
                                            </Text>
                                        )}
                                    </View>
                                </Pressable>
                            ))}
                        </>
                    ) : (
                        <>
                            <Image
                                source={
                                    issue?.imageUrl
                                        ? { uri: issue.imageUrl }
                                        : require("@/assets/images/placeholder.png")
                                }
                                style={styles.image}
                                contentFit="cover"
                                accessibilityLabel={
                                    issue?.title ?? "Trail issue photo"
                                }
                            />
                            {(status || issue?.elapsedTime) && (
                                <View style={styles.metadata}>
                                    {status && (
                                        <View
                                            style={[
                                                styles.badge,
                                                status === "Completed" &&
                                                    styles.completed,
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
                            <Pressable
                                accessibilityRole="link"
                                accessibilityLabel={`Open issue: ${issue.title ?? "Trail issue"}`}
                                disabled={!selectedIssue}
                                onPress={() => openIssue(issue)}>
                                <Text style={styles.title}>
                                    {issue.title ?? "Trail issue"}
                                </Text>
                            </Pressable>
                            {issue?.locationName && (
                                <Text style={styles.location}>
                                    {issue.locationName}
                                </Text>
                            )}
                        </>
                    )}
                </ScrollView>
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
        overflow: "hidden",
    },
    dragArea: { height: 44, marginHorizontal: 28 },
    handleTouch: { flex: 1, alignItems: "center", justifyContent: "center" },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Palette.primaryBlack30,
    },
    content: { flex: 1 },
    groupTitle: {
        fontSize: 23,
        fontFamily: "Lato_700Bold",
        color: Palette.primaryBlack100,
        marginBottom: 6,
    },
    groupCount: {
        fontSize: 14,
        fontFamily: "Lato_400Regular",
        color: Palette.primaryBlack70,
        marginBottom: 16,
    },
    issueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Palette.primaryBlack30,
    },
    thumbnail: { width: 80, height: 72, borderRadius: 12 },
    rowDetails: { flex: 1, gap: 6 },
    rowTitle: {
        fontSize: 18,
        fontFamily: "Lato_700Bold",
        color: Palette.primaryPurple100,
        textDecorationLine: "underline",
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
        color: Palette.primaryPurple100,
        textDecorationLine: "underline",
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
