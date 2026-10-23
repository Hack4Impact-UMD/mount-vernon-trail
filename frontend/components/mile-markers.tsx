import markers from "@/data/mile_markers.json";
import {
    GeoJSONSource,
    Layer,
} from "@maplibre/maplibre-react-native";
import { Alert } from "react-native";

const MIN_ZOOM = 13;

const MARKER_DATA = JSON.stringify({
    type: "FeatureCollection",
    features: markers.map((marker) => ({
        type: "Feature",
        id: `mile-${marker.mile_marker}`,
        properties: {
            mile: marker.mile_marker,
            label: String(marker.mile_marker),
            name: marker.location_name,
            description: marker.description,
        },
        geometry: {
            type: "Point",
            coordinates: [
                marker.coordinates.longitude,
                marker.coordinates.latitude,
            ],
        },
    })),
});

export default function MileMarkers() {
    return (
        <GeoJSONSource
            id="mile-markers"
            data={MARKER_DATA}
            onPress={(event) => {
                const properties =
                    event.nativeEvent.features[0]?.properties;

                if (!properties) return;

                event.stopPropagation();
                Alert.alert(
                    `Mile ${properties.mile}`,
                    `${properties.name}\n\n${properties.description}`,
                );
            }}>
            <Layer
                id="mile-marker-circles"
                type="circle"
                minzoom={MIN_ZOOM}
                paint={{
                    "circle-radius": 11,
                    "circle-color": "#ffffff",
                    "circle-stroke-color": "#939598",
                    "circle-stroke-width": 1,
                }}
            />

            <Layer
                id="mile-marker-numbers"
                type="symbol"
                minzoom={MIN_ZOOM}
                layout={{
                    "text-field": ["get", "label"],
                    "text-font": ["Noto Sans Regular"],
                    "text-size": 10,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{
                    "text-color": "#6d6e71",
                }}
            />
        </GeoJSONSource>
    );
}