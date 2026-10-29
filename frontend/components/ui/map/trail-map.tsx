import { Palette } from "@/constants/theme";
import {
    Camera,
    Map,
    ViewAnnotation,
    type CameraRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import MapEventFilter from "@/components/ui/map/map-event-filter";
import {
    fetchMapEvents,
    filterIssuesByEvent,
    type MapEvent,
} from "@/services/map-event-service";
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
import MapOverlays, { type MapPin } from "@/components/ui/map/map-overlays";
import trail from "@/data/mount-vernon-trail.json";
import TrailLandmarks, {
    type TrailLandmark,
} from "@/components/ui/map/trail-landmark-markers";
import TrailLandmarkDetailPopup from "@/components/ui/map/trail-landmark-detail-popup";
import TrailLandmarkSearch from "@/components/ui/map/trail-landmark-search";
import { MAP_STYLES, type MapMode } from "@/config/map-styles";

const TRAIL_DATA = JSON.stringify(trail);
// Derive the full extent from the rendered trail, rather than a fixed center/zoom.
const TRAIL_BOUNDS: [number, number, number, number] = trail.features
    .flatMap((feature) => feature.geometry.coordinates)
    .reduce<
        [number, number, number, number]
    >((bounds, [longitude, latitude]) => [Math.min(bounds[0], longitude), Math.min(bounds[1], latitude), Math.max(bounds[2], longitude), Math.max(bounds[3], latitude)], [Infinity, Infinity, -Infinity, -Infinity]);

export default function TrailMap({
    selectedIssue,
    onSelectIssue,
}: {
    selectedIssue: MapPin | null;
    onSelectIssue: (issue: MapPin | null) => void;
}) {
    const camera = useRef<CameraRef>(null);
    const [selectedLandmark, setSelectedLandmark] =
        useState<TrailLandmark | null>(null);
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
    const [issueData, setIssueData] = useState<MapIssueData | null>(null);
    const [events, setEvents] = useState<MapEvent[]>([]);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState("all");
    const effectiveEvent =
        eventsLoading ||
        eventsError ||
        (selectedEvent !== "unassigned" &&
            selectedEvent !== "all" &&
            !events.some((event) => event.id === selectedEvent))
            ? "all"
            : selectedEvent;
    const filteredData = issueData
        ? filterIssuesByEvent(issueData, events, effectiveEvent)
        : null;
    const issuePins: MapPin[] = (filteredData?.geojson.features ?? []).map(
        (feature) => ({
            id: feature.properties.cardId,
            title: feature.properties.name,
            locationName: feature.properties.locationName,
            imageUrl: feature.properties.imageUrl ?? undefined,
            coordinates: feature.geometry.coordinates,
        }),
    );
    const unlocatedIssues = filteredData?.unlocatedIssues ?? [];
    const options = issueData
        ? [
              {
                  id: "all",
                  name: "All issues",
                  count:
                      issueData.geojson.features.length +
                      issueData.unlocatedIssues.length,
              },
              {
                  id: "unassigned",
                  name: "Unassigned",
                  count: (() => {
                      const data = filterIssuesByEvent(
                          issueData,
                          events,
                          "unassigned",
                      );
                      return (
                          data.geojson.features.length +
                          data.unlocatedIssues.length
                      );
                  })(),
              },
              ...events.map((event) => ({
                  id: event.id,
                  name: event.name,
                  count: event.issueIds.length,
              })),
          ]
        : [{ id: "all", name: "All issues", count: 0 }];
    const [issueError, setIssueError] = useState<string | null>(null);
    const [issuesLoading, setIssuesLoading] = useState(true);
    const [showUnlocated, setShowUnlocated] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const refreshVersion = useRef(0);
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setNoticeDismissed(false);
            onSelectIssue(null);
            setIssueData(null);
            setEvents([]);
            setEventsError(null);
            setEventsLoading(true);
            setIssuesLoading(true);
            setIssueError(null);
            const load = async () => {
                try {
                    const key = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
                    if (!key) throw new Error("Trello API key is missing.");
                    const result = await fetchMapIssues(key);
                    if (!active || refresh !== refreshVersion.current) return;
                    setIssueData(result);
                    setIssuesLoading(false);
                    try {
                        const loadedEvents = await fetchMapEvents(
                            key,
                            result.issueAliases,
                        );
                        if (active && refresh === refreshVersion.current)
                            setEvents(loadedEvents);
                    } catch (error: unknown) {
                        if (active)
                            setEventsError(
                                error instanceof Error
                                    ? error.message
                                    : "Could not load events.",
                            );
                    }
                } catch (error) {
                    if (active)
                        setIssueError(
                            error instanceof Error
                                ? error.message
                                : "Could not load trail issues.",
                        );
                } finally {
                    if (active) {
                        setIssuesLoading(false);
                        setEventsLoading(false);
                    }
                }
            };
            void load();
            return () => {
                active = false;
                setSelectedLandmark(null);
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
            <MapEventFilter
                options={options}
                selectedId={effectiveEvent}
                loading={issuesLoading || eventsLoading}
                error={eventsError}
                pinCount={issuePins.length}
                onSelect={(id) => {
                    setSelectedEvent(id);
                    onSelectIssue(null);
                    if (!issueData) return;
                    const pins = filterIssuesByEvent(issueData, events, id)
                        .geojson.features;
                    if (pins.length === 1)
                        camera.current?.flyTo({
                            center: pins[0].geometry.coordinates,
                            zoom: 14,
                            duration: 600,
                        });
                    if (pins.length > 1) {
                        const lngs = pins.map(
                            (pin) => pin.geometry.coordinates[0],
                        );
                        const lats = pins.map(
                            (pin) => pin.geometry.coordinates[1],
                        );
                        camera.current?.fitBounds(
                            [
                                Math.min(...lngs),
                                Math.min(...lats),
                                Math.max(...lngs),
                                Math.max(...lats),
                            ],
                            {
                                padding: {
                                    top: 48,
                                    right: 48,
                                    bottom: 48,
                                    left: 48,
                                },
                                duration: 600,
                            },
                        );
                    }
                }}
            />
            <TrailLandmarkSearch
                onSelect={(marker) => {
                    onSelectIssue(null);
                    camera.current?.flyTo({
                        center: [
                            marker.coordinates.longitude,
                            marker.coordinates.latitude,
                        ],
                        zoom: 14,
                        duration: 700,
                    });
                    setSelectedLandmark(marker);
                }}
            />
            <View style={styles.mapRegion}>
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

                    <TrailLandmarks onSelect={setSelectedLandmark} />
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
                <TrailLandmarkDetailPopup
                    marker={selectedLandmark}
                    onClose={() => setSelectedLandmark(null)}
                />

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
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Recenter map to the whole Mount Vernon Trail"
                    accessibilityHint="Fits the entire trail on screen"
                    disabled={status !== "loaded"}
                    accessibilityState={{ disabled: status !== "loaded" }}
                    onPress={() => {
                        centerOnNextFix.current = false;
                        onSelectIssue(null);
                        setSelectedLandmark(null);
                        camera.current?.fitBounds(TRAIL_BOUNDS, {
                            padding: {
                                top: 40,
                                right: 40,
                                bottom: 136,
                                left: 40,
                            },
                            bearing: 0,
                            pitch: 0,
                            duration: 800,
                        });
                    }}
                    style={[styles.switchButton, styles.recenterButton]}>
                    <Text style={styles.switchText}>Recenter</Text>
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
                                These intake cards were loaded from Trello. Add
                                a saved location, latitude and longitude, or a
                                map link with explicit coordinates to place a
                                pin.
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
                                    Could not load the map. Check your
                                    connection.
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    mapRegion: { flex: 1 },
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
        width: 104,
        alignItems: "center",
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
    recenterButton: { bottom: 120 },
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
