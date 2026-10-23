import { Palette } from "@/constants/theme";
import {
    GeoJSONSource,
    Layer,
    ViewAnnotation,
} from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

export type MapPin = {
    id: string;
    coordinates: [number, number];
};

type Props = {
    pins?: MapPin[];
    trail?: React.ComponentProps<typeof GeoJSONSource>["data"];
};

export default function MapOverlays({ pins = [], trail }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <>
            {trail && (
                <GeoJSONSource id="mount-vernon-trail" data={trail}>
                    <Layer
                        id="trail-outline"
                        type="line"
                        layout={{
                            "line-cap": "round",
                            "line-join": "round",
                        }}
                        paint={{
                            "line-color": "#ffffff",
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

            {pins.map((pin) => {
                const selected = selectedId === pin.id;

                return (
                    <ViewAnnotation
                        key={pin.id}
                        id={pin.id}
                        lngLat={pin.coordinates}
                        anchor="bottom"
                        onPress={() =>
                            setSelectedId(selected ? null : pin.id)
                        }>
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
                                            ? "#ffffff"
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