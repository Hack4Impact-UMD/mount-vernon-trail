import {
    Camera,
    Map,
    ViewAnnotation,
    type CameraRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUserLocation } from "@/hooks/use-user-location";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Palette } from "@/constants/theme";
import { MAP_STYLES } from "@/config/map-styles";
import { resolveIssueLocation, type MapLocation } from "@/services/map-service";
import { getTrelloClient } from "@/services/trello-config";
import MapOverlays from "./map-overlays";

export type IssueMapPreviewProps = { issueId: string };

export default function IssueMapPreview({ issueId }: IssueMapPreviewProps) {
    const router = useRouter();
    const camera = useRef<CameraRef>(null);
    const [mapReady, setMapReady] = useState(false);
    const {
        position,
        status: locationStatus,
        error: locationError,
        locate,
    } = useUserLocation();
    const [location, setLocation] = useState<MapLocation | null>(null);
    const [message, setMessage] = useState("Loading issue location…");
    useEffect(() => {
        if (location && locationStatus === "idle") void locate();
    }, [location, locationStatus, locate]);
    useEffect(() => {
        if (!mapReady || !location || !position) return;
        const [lng, lat] = location.coordinates;
        const { longitude, latitude } = position.coords;
        camera.current?.fitBounds(
            [
                Math.min(lng, longitude),
                Math.min(lat, latitude),
                Math.max(lng, longitude),
                Math.max(lat, latitude),
            ],
            {
                padding: { top: 32, right: 32, bottom: 48, left: 32 },
                duration: 400,
            },
        );
    }, [mapReady, location, position]);
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setMapReady(false);
            setLocation(null);
            setMessage("Loading issue location…");
            const load = async () => {
                try {
                    const key = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
                    if (!key) throw new Error("Trello API key is missing.");
                    const card = await getTrelloClient(key).getCard(issueId);
                    const result = await resolveIssueLocation(card);
                    if (!active) return;
                    setLocation(result);
                    if (!result)
                        setMessage(
                            "This issue does not have a map location yet.",
                        );
                } catch {
                    if (active)
                        setMessage("Could not load this issue’s map location.");
                }
            };
            void load();
            return () => {
                active = false;
            };
        }, [issueId]),
    );

    return (
        <View style={styles.section}>
            <Text style={styles.label}>MAPS</Text>
            {location ? (
                <Pressable
                    style={styles.preview}
                    accessibilityRole="link"
                    accessibilityLabel={`Show ${location.locationName} on the map`}
                    onPress={() =>
                        router.navigate({
                            pathname: "/maps",
                            params: { issueId },
                        })
                    }>
                    <View
                        pointerEvents="none"
                        style={StyleSheet.absoluteFill}>
                        <Map
                            style={StyleSheet.absoluteFill}
                            onDidFinishLoadingMap={() => setMapReady(true)}
                            mapStyle={MAP_STYLES.normal}>
                            <Camera
                                ref={camera}
                                maxZoom={15}
                                key={`${issueId}:${location.coordinates.join(",")}`}
                                initialViewState={{
                                    center: location.coordinates,
                                    zoom: 14,
                                }}
                            />
                            <MapOverlays
                                pins={[
                                    {
                                        id: issueId,
                                        coordinates: location.coordinates,
                                    },
                                ]}
                                selectedId={issueId}
                            />
                            {position && (
                                <ViewAnnotation
                                    id="preview-user-location"
                                    lngLat={[
                                        position.coords.longitude,
                                        position.coords.latitude,
                                    ]}
                                    anchor="center">
                                    <View
                                        collapsable={false}
                                        style={styles.locationHalo}
                                        accessibilityLabel="Your current location">
                                        <View style={styles.locationDot} />
                                    </View>
                                </ViewAnnotation>
                            )}
                        </Map>
                    </View>
                </Pressable>
            ) : (
                <Text style={styles.message}>{message}</Text>
            )}
            {location && locationError && (
                <Text style={styles.message}>{locationError}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginBottom: 24 },
    label: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.2,
        color: "#888",
        marginBottom: 12,
    },
    preview: {
        height: 180,
        backgroundColor: "#FAF8FC",
        borderWidth: 1.5,
        borderColor: "#C4B4D7",
        borderRadius: 16,
        overflow: "hidden",
    },
    message: { color: Palette.primaryBlack70, fontFamily: "Lato_400Regular" },
    locationHalo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: `${Palette.blue}33`,
        alignItems: "center",
        justifyContent: "center",
    },
    locationDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Palette.blue,
        borderWidth: 2,
        borderColor: "white",
    },
});
