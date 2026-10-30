import { Colors, Palette } from "@/constants/theme";
import {
    GeoJSONSource,
    Layer,
    ViewAnnotation,
} from "@maplibre/maplibre-react-native";
import { StyleSheet, View } from "react-native";

export type MapPin = {
    id: string;
    coordinates: [number, number];
    title?: string;
    locationName?: string;
    imageUrl?: string;
    status?: "Not started" | "In Progress" | "Completed";
    elapsedTime?: string;
};

type Props = {
    pins?: MapPin[];
    selectedId?: string;
    onSelectPin?: (pin: MapPin) => void;
    trail?: React.ComponentProps<typeof GeoJSONSource>["data"];
};

export default function MapOverlays({
    pins = [],
    trail,
    selectedId,
    onSelectPin,
}: Props) {
    const heatmapData = JSON.stringify({
        type: "FeatureCollection",
        features: pins.map((pin) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: pin.coordinates },
        })),
    });
    return (
        <>
            {trail && (
                <GeoJSONSource
                    id="mount-vernon-trail"
                    data={trail}>
                    <Layer
                        id="trail-outline"
                        type="line"
                        layout={{
                            "line-cap": "round",
                            "line-join": "round",
                        }}
                        paint={{
                            "line-color": Colors.light.background,
                            "line-width": 8,
                        }}
                    />
                    <Layer
                        id="trail-highlight"
                        type="line"
                        layout={{
                            "line-cap": "round",
                            "line-join": "round",
                        }}
                        paint={{
                            "line-color": Palette.primaryPurple100,
                            "line-width": 4,
                        }}
                    />
                </GeoJSONSource>
            )}

            <GeoJSONSource
                id="issue-density"
                data={heatmapData}>
                <Layer
                    id="issue-heatmap"
                    type="heatmap"
                    paint={{
                        "heatmap-weight": 1,
                        "heatmap-radius": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            8,
                            20,
                            14,
                            40,
                            18,
                            60,
                        ],
                        "heatmap-intensity": 1,
                        "heatmap-opacity": 0.7,
                        "heatmap-color": [
                            "interpolate",
                            ["linear"],
                            ["heatmap-density"],
                            0,
                            `${Palette.green}00`,
                            0.2,
                            Palette.green,
                            0.5,
                            Palette.heatmapOrange,
                            0.8,
                            Palette.heatmapRed,
                            1,
                            Palette.heatmapRed,
                        ],
                    }}
                />
            </GeoJSONSource>

            {pins.map((pin) => {
                const selected = selectedId === pin.id;

                return (
                    <ViewAnnotation
                        key={pin.id}
                        id={pin.id}
                        lngLat={pin.coordinates}
                        anchor="bottom"
                        onPress={() => onSelectPin?.(pin)}>
                        <View
                            collapsable={false}
                            style={[
                                styles.pin,
                                {
                                    backgroundColor: selected
                                        ? Palette.primaryPurple100
                                        : Palette.primaryPurple30,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: selected
                                            ? Colors.light.background
                                            : Palette.primaryPurple100,
                                    },
                                ]}
                            />
                        </View>
                    </ViewAnnotation>
                );
            })}
        </>
    );
}

const styles = StyleSheet.create({
    pin: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderBottomRightRadius: 0,
        borderWidth: 1.5,
        borderColor: Palette.primaryPurple100,
        transform: [{ rotate: "45deg" }],
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
