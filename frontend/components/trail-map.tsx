import { Palette } from "@/constants/theme";
import {
    Camera,
    Map,
    ViewAnnotation,
    type CameraRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { fetchMapIssues, type MapIssueData } from "@/services/map-service";
import { LocateFixed, RefreshCw, X } from "lucide-react-native";
import { useUserLocation } from "@/hooks/use-user-location";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MapOverlays, { type MapPin } from "@/components/map-overlays";
import trail from "@/data/mount-vernon-trail.json";
import MileMarkers from "@/components/mile-markers";
import { MAP_STYLES, type MapMode } from "@/config/map-styles";

const TRAIL_DATA = JSON.stringify(trail);

export default function TrailMap({
    selectedIssue,
    onSelectIssue,
}: {
    selectedIssue: MapPin | null;
    onSelectIssue: (issue: MapPin | null) => void;
}) {
    const camera = useRef<CameraRef>(null);
    const centerOnNextFix = useRef(false);
    const {
        position,
        status: locationStatus,
        error: locationError,
        locate,
    } = useUserLocation();
    const locationBusy =
        locationStatus === "requesting" || locationStatus === "locating";
    useEffect(() => {
        if (!position || !centerOnNextFix.current) return;
        centerOnNextFix.current = false;
        camera.current?.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
            duration: 800,
        });
    }, [position]);
    const [issuePins, setIssuePins] = useState<MapPin[]>([]);
    const [issueError, setIssueError] = useState<string | null>(null);
    const [issuesLoading, setIssuesLoading] = useState(true);
    const [unlocatedIssues, setUnlocatedIssues] = useState<
        MapIssueData["unlocatedIssues"]
    >([]);
    const [showUnlocated, setShowUnlocated] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const refreshVersion = useRef(0);
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setNoticeDismissed(false);
            onSelectIssue(null);
            setIssuePins([]);
            setUnlocatedIssues([]);
            setIssuesLoading(true);
            setIssueError(null);
            const load = async () => {
                try {
                    const key = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
                    if (!key) throw new Error("Trello API key is missing.");
                    const result = await fetchMapIssues(key);
                    if (!active || refresh !== refreshVersion.current) return;
                    setIssuePins(
                        result.geojson.features.map((feature) => ({
                            id: feature.properties.cardId,
                            title: feature.properties.name,
                            locationName: feature.properties.locationName,
                            imageUrl: feature.properties.imageUrl ?? undefined,
                            coordinates: feature.geometry.coordinates,
                        })),
                    );
                    setUnlocatedIssues(result.unlocatedIssues);
                } catch (error) {
                    if (active)
                        setIssueError(
                            error instanceof Error
                                ? error.message
                                : "Could not load trail issues.",
                        );
                } finally {
                    if (active) setIssuesLoading(false);
                }
            };
            void load();
            return () => {
                active = false;
            };
        }, [onSelectIssue, refresh]),
    );
    const [mode, setMode] = useState<MapMode>("normal");
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<"loading" | "loaded" | "error">(
        "loading",
    );

    function toggleMap() {
        setStatus("loading");
        setMode((current) => (current === "normal" ? "satellite" : "normal"));
    }

    return (
        <View style={styles.container}>
            <Map
                key={attempt}
                style={styles.map}
                mapStyle={MAP_STYLES[mode]}
                onDidFinishLoadingMap={() => setStatus("loaded")}
                onDidFinishLoadingStyle={() => setStatus("loaded")}
                onDidFailLoadingMap={() => setStatus("error")}>
                <Camera
                    ref={camera}
                    initialViewState={{
                        center: [-77.06, 38.78],
                        zoom: 10,
                    }}
                />

                <MapOverlays
                    pins={issuePins}
                    selectedId={selectedIssue?.id}
                    onSelectPin={onSelectIssue}
                    trail={TRAIL_DATA}
                />

                <MileMarkers />
                {position && (
                    <ViewAnnotation
                        id="current-user-location"
                        lngLat={[
                            position.coords.longitude,
                            position.coords.latitude,
                        ]}
                        anchor="center">
                        <View
                            collapsable={false}
                            accessible
                            accessibilityLabel="Your current location"
                            style={styles.userLocationHalo}>
                            <View style={styles.userLocationDot} />
                        </View>
                    </ViewAnnotation>
                )}
            </Map>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show my current location"
                accessibilityState={{
                    disabled: locationBusy,
                    busy: locationBusy,
                }}
                disabled={locationBusy}
                onPress={() => {
                    centerOnNextFix.current = true;
                    void locate();
                }}
                style={styles.locationButton}>
                {locationBusy ? (
                    <ActivityIndicator color={Palette.primaryPurple100} />
                ) : (
                    <LocateFixed
                        size={20}
                        color={Palette.primaryPurple100}
                    />
                )}
                <Text style={styles.switchText}>
                    {locationBusy ? "Finding location…" : "My location"}
                </Text>
            </Pressable>
            {status === "loaded" && locationError && (
                <View
                    style={styles.notice}
                    accessibilityLiveRegion="polite">
                    <Text style={styles.text}>{locationError}</Text>
                </View>
            )}

            {!noticeDismissed && (
                <View
                    style={styles.issueNotice}
                    accessibilityLiveRegion="polite">
                    <Text style={[styles.text, styles.issueNoticeText]}>
                        {issuesLoading
                            ? "Loading trail issues…"
                            : (issueError ??
                              `${issuePins.length + unlocatedIssues.length} intake cards · ${issuePins.length} pins${unlocatedIssues.length ? ` · ${unlocatedIssues.length} need a location` : ""}`)}
                    </Text>
                    {!issuesLoading && unlocatedIssues.length > 0 && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="View cards that need a location"
                            onPress={() => setShowUnlocated(true)}
                            style={styles.dismissNotice}>
                            <Text style={styles.retry}>Details</Text>
                        </Pressable>
                    )}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Refresh intake cards"
                        disabled={issuesLoading}
                        accessibilityState={{ disabled: issuesLoading }}
                        onPress={() => {
                            refreshVersion.current += 1;
                            setRefresh(refreshVersion.current);
                        }}
                        style={styles.dismissNotice}>
                        <RefreshCw
                            size={18}
                            color={Palette.primaryPurple100}
                        />
                    </Pressable>
                    <Pressable
                        onPress={() => setNoticeDismissed(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss issue pin notice"
                        hitSlop={8}
                        style={styles.dismissNotice}>
                        <X
                            size={18}
                            color={Palette.primaryBlack70}
                        />
                    </Pressable>
                </View>
            )}

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                    mode === "normal"
                        ? "Switch to satellite map"
                        : "Switch to normal map"
                }
                onPress={toggleMap}
                style={styles.switchButton}>
                <Text style={styles.switchText}>
                    {mode === "normal" ? "Satellite" : "Normal"}
                </Text>
            </Pressable>

            <Modal
                visible={showUnlocated}
                transparent
                animationType="slide"
                onRequestClose={() => setShowUnlocated(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.unlocatedSheet}>
                        <Text style={styles.sheetTitle}>
                            Cards needing a location
                        </Text>
                        <Text style={styles.text}>
                            These intake cards were loaded from Trello. Add a
                            saved location, latitude and longitude, or a map
                            link with explicit coordinates to place a pin.
                        </Text>
                        <ScrollView style={styles.unlocatedList}>
                            {unlocatedIssues.map((issue) => (
                                <Text
                                    key={issue.cardId}
                                    style={styles.unlocatedName}>
                                    {issue.name}
                                </Text>
                            ))}
                        </ScrollView>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setShowUnlocated(false)}>
                            <Text style={styles.retry}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {status !== "loaded" && (
                <View
                    style={styles.notice}
                    accessibilityLiveRegion="polite">
                    {status === "loading" ? (
                        <>
                            <ActivityIndicator
                                color={Palette.primaryPurple100}
                            />
                            <Text style={styles.text}>Loading map…</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.text}>
                                Could not load the map. Check your connection.
                            </Text>

                            <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                    setStatus("loading");
                                    setAttempt((value) => value + 1);
                                }}>
                                <Text style={styles.retry}>Retry</Text>
                            </Pressable>
                        </>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    issueNotice: {
        position: "absolute",
        bottom: 8,
        left: 16,
        right: 16,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        padding: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "#00000055",
        justifyContent: "center",
        padding: 24,
    },
    unlocatedSheet: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 20,
        gap: 16,
        maxHeight: "80%",
    },
    sheetTitle: {
        fontFamily: "Lato_700Bold",
        fontSize: 20,
        color: Palette.primaryBlack100,
    },
    unlocatedList: { flexGrow: 0 },
    unlocatedName: {
        fontFamily: "Lato_400Regular",
        paddingVertical: 12,
        color: Palette.primaryBlack100,
    },
    issueNoticeText: { flex: 1 },
    dismissNotice: { padding: 8 },

    switchButton: {
        position: "absolute",
        left: 16,
        bottom: 64,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 3,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    locationButton: {
        position: "absolute",
        right: 16,
        bottom: 64,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
    },
    userLocationHalo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#1976D233",
        alignItems: "center",
        justifyContent: "center",
    },
    userLocationDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#1976D2",
        borderWidth: 2,
        borderColor: "#ffffff",
    },
    switchText: {
        color: Palette.primaryPurple100,
        fontFamily: "Lato_700Bold",
    },

    notice: {
        position: "absolute",
        top: 16,
        left: 16,
        right: 16,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        padding: 12,
        alignItems: "center",
        gap: 8,
    },
    text: {
        fontFamily: "Lato_400Regular",
        textAlign: "center",
    },
    retry: {
        color: Palette.primaryPurple100,
        fontFamily: "Lato_700Bold",
        padding: 8,
    },
});
