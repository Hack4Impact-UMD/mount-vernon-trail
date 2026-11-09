import {
    createElement,
    forwardRef,
    useImperativeHandle,
    type ComponentProps,
} from "react";
import type * as MapLibre from "@maplibre/maplibre-react-native";

export const flyTo = jest.fn();
export const fitBounds = jest.fn();

export const Camera = forwardRef<
    Pick<MapLibre.CameraRef, "flyTo" | "fitBounds">,
    ComponentProps<typeof MapLibre.Camera>
>(function Camera(props, ref) {
    useImperativeHandle(ref, () => ({ flyTo, fitBounds }), []);
    return createElement("NativeCamera", { ...props, testID: "native-camera" });
});

export function Map(props: ComponentProps<typeof MapLibre.Map>) {
    return createElement("NativeMap", { ...props, testID: "native-map" });
}

export function GeoJSONSource(
    props: ComponentProps<typeof MapLibre.GeoJSONSource>,
) {
    return createElement("NativeSource", {
        ...props,
        testID: `source-${props.id}`,
    });
}

export function ViewAnnotation(
    props: ComponentProps<typeof MapLibre.ViewAnnotation>,
) {
    return createElement("NativeAnnotation", {
        ...props,
        testID: `pin-${props.id}`,
    });
}

export function Layer(props: ComponentProps<typeof MapLibre.Layer>) {
    return createElement("NativeLayer", {
        ...props,
        testID: `layer-${props.id}`,
    });
}

export const Images = () => null;
