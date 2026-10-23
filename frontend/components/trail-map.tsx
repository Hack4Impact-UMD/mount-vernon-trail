import { Palette } from "@/constants/theme";
import { Camera, Map } from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

// Public basemap for the initial map screen; no provider key is required.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function TrailMap() {
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

    return (
        <View style={styles.container}>
            <Map
                key={attempt}
                style={styles.map}
                mapStyle={MAP_STYLE}
                onDidFinishLoadingMap={() => setStatus("loaded")}
                onDidFailLoadingMap={() => setStatus("error")}>
                <Camera initialViewState={{ center: [-77.06, 38.78], zoom: 10 }} />
            </Map>
            {status !== "loaded" && (
                <View style={styles.notice} accessibilityLiveRegion="polite">
                    {status === "loading" ? (
                        <>
                            <ActivityIndicator color={Palette.primaryPurple100} />
                            <Text style={styles.text}>Loading map…</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.text}>Could not load the map. Check your connection.</Text>
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
    text: { fontFamily: "Lato_400Regular", textAlign: "center" },
    retry: { color: Palette.primaryPurple100, fontFamily: "Lato_700Bold", padding: 8 },
});
