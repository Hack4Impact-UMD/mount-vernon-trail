import markers from "@/data/monument_markers.json";
import { Colors, Palette } from "@/constants/theme";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import type { MonumentMarker } from "@/services/monument-service";
export type { MonumentMarker } from "@/services/monument-service";
const MIN_ZOOM = 13;
const MARKER_DATA = JSON.stringify({
    type: "FeatureCollection",
    features: markers.map((marker) => ({
        type: "Feature",
        id: marker.id,
        properties: { markerId: marker.id, label: marker.abbreviation },
        geometry: {
            type: "Point",
            coordinates: [
                marker.coordinates.longitude,
                marker.coordinates.latitude,
            ],
        },
    })),
});

export default function MonumentMarkers({
    onSelect,
}: {
    onSelect: (marker: MonumentMarker) => void;
}) {
    return (
        <GeoJSONSource
            id="monument-markers"
            data={MARKER_DATA}
            onPress={(event) => {
                const id = event.nativeEvent.features[0]?.properties?.markerId;
                const marker = markers.find((item) => item.id === id);
                if (!marker) return;
                event.stopPropagation();
                onSelect(marker);
            }}>
            <Layer
                id="monument-marker-circles"
                type="circle"
                minzoom={MIN_ZOOM}
                paint={{
                    "circle-radius": 11,
                    "circle-color": Colors.light.background,
                    "circle-stroke-color": Palette.primaryBlack50,
                    "circle-stroke-width": 1,
                }}
            />
            <Layer
                id="monument-marker-abbreviations"
                type="symbol"
                minzoom={MIN_ZOOM}
                layout={{
                    "text-field": ["get", "label"],
                    "text-font": ["Noto Sans Regular"],
                    "text-size": 10,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{ "text-color": Palette.primaryBlack70 }}
            />
        </GeoJSONSource>
    );
}
