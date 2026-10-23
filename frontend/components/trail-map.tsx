import { Palette } from "@/constants/theme";
import { Camera, Map } from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MapOverlays from "@/components/map-overlays";
import {demoPins} from "@/data/map-demo";
import trail from "@/data/mount-vernon-trail.json";
import MileMarkers from "@/components/mile-markers";
import { MAP_STYLES, type MapMode } from "@/config/map-styles";

const TRAIL_DATA = JSON.stringify(trail);

export default function TrailMap() {
    const [mode, setMode] = useState<MapMode>("normal");
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] =
        useState<"loading" | "loaded" | "error">("loading");

    function toggleMap() {
        setStatus("loading");
        setMode((current) =>
            current === "normal" ? "satellite" : "normal",
        );
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
                    initialViewState={{
                        center: [-77.06, 38.78],
                        zoom: 10,
                    }}
                />

                <MapOverlays
                    pins={demoPins}
                    trail={TRAIL_DATA}
                />

                <MileMarkers />
            </Map>

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

            {status !== "loaded" && (
                <View
                    style={styles.notice}
                    accessibilityLiveRegion="polite">
                    {status === "loading" ? (
                        <>
                            <ActivityIndicator
                                color={Palette.primaryPurple100}
                            />
                            <Text style={styles.text}>
                                Loading map…
                            </Text>
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