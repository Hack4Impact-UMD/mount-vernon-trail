import {
    TRAIL_LANDMARKS as markers,
    LANDMARK_MIN_ZOOM,
} from "@/services/trail-landmark-service";
import { Colors, Palette } from "@/constants/theme";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import type { TrailLandmark } from "@/services/trail-landmark-service";
export type { TrailLandmark } from "@/services/trail-landmark-service";

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

export default function TrailLandmarks({
    onSelect,
}: {
    onSelect: (marker: TrailLandmark) => void;
}) {
    return (
        <GeoJSONSource
            id="trail-landmark-markers"
            data={MARKER_DATA}
            onPress={(event) => {
                const id = event.nativeEvent.features[0]?.properties?.markerId;
                const marker = markers.find((item) => item.id === id);
                if (!marker) return;
                event.stopPropagation();
                onSelect(marker);
            }}>
            <Layer
                id="trail-landmark-marker-circles"
                type="circle"
                minzoom={LANDMARK_MIN_ZOOM}
                paint={{
                    "circle-radius": 11,
                    "circle-color": Colors.light.background,
                    "circle-stroke-color": Palette.primaryBlack50,
                    "circle-stroke-width": 1,
                }}
            />
            <Layer
                id="trail-landmark-marker-abbreviations"
                type="symbol"
                minzoom={LANDMARK_MIN_ZOOM}
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
