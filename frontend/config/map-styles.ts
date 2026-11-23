import type { Map } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";

export type MapMode = "normal" | "satellite";
type MapStyle = ComponentProps<typeof Map>["mapStyle"];

export const MAP_STYLES: Record<MapMode, MapStyle> = {
    normal: "https://tiles.openfreemap.org/styles/liberty",

    satellite: {
        version: 8,
        glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
        sources: {
            imagery: {
                type: "raster",
                tiles: [
                    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution:
                    "Sources: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
            },
        },
        layers: [
            {
                id: "satellite-imagery",
                type: "raster",
                source: "imagery",
            },
        ],
    },
};