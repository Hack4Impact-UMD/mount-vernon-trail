import {
    LocationManager,
    type GeolocationPosition,
} from "@maplibre/maplibre-react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { getErrorMessage } from "@/utils/errors";

type LocationStatus =
    | "idle"
    | "requesting"
    | "locating"
    | "ready"
    | "denied"
    | "error";

export function useUserLocation() {
    const [status, setStatus] = useState<LocationStatus>("idle");
    const [position, setPosition] = useState<GeolocationPosition | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [focused, setFocused] = useState(false);
    const [appState, setAppState] = useState(AppState.currentState);
    const requestId = useRef(0);
    const requesting = useRef(false);

    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => {
                requestId.current += 1;
                requesting.current = false;
                setFocused(false);
                setEnabled(false);
                setPosition(null);
                setStatus("idle");
                setError(null);
            };
        }, []),
    );

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            setAppState(next);
            setPosition(null);
            if (enabled) setStatus("locating");
        });
        return () => subscription.remove();
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !focused || appState !== "active") return;
        let active = true;
        const timeout = setTimeout(() => {
            if (!active) return;
            setEnabled(false);
            setStatus("error");
            setError(
                "Could not find your location. Check that Location Services are on, then try again.",
            );
        }, 15000);
        const onLocation = (next: GeolocationPosition) => {
            const { latitude, longitude } = next.coords;
            // MapLibre emits seconds on iOS and milliseconds on Android.
            const timestampMs =
                Platform.OS === "ios" ? next.timestamp * 1000 : next.timestamp;
            // The native manager can replay a cached fix when a listener joins.
            if (
                !active ||
                !Number.isFinite(next.timestamp) ||
                Date.now() - timestampMs > 30000 ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                Math.abs(latitude) > 90 ||
                Math.abs(longitude) > 180
            )
                return;
            clearTimeout(timeout);
            setPosition(next);
            setStatus("ready");
        };
        LocationManager.addListener(onLocation);
        return () => {
            active = false;
            clearTimeout(timeout);
            LocationManager.removeListener(onLocation);
        };
    }, [enabled, focused, appState]);

    const locate = useCallback(async () => {
        if (requesting.current || !focused) return;
        requesting.current = true;
        const id = ++requestId.current;
        setEnabled(false);
        setPosition(null);
        setError(null);
        setStatus("requesting");
        try {
            let granted: boolean;
            if (Platform.OS === "android") {
                const permissions = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                ]);
                // Approximate location is sufficient to show a volunteer on the map.
                granted =
                    permissions[
                        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
                    ] === PermissionsAndroid.RESULTS.GRANTED ||
                    permissions[
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                    ] === PermissionsAndroid.RESULTS.GRANTED;
            } else {
                granted = await LocationManager.requestPermissions();
            }
            if (requestId.current !== id) return;
            if (!granted) {
                setStatus("denied");
                setError(
                    "Location access is off. You can enable it in your device settings and try again.",
                );
                return;
            }
            setStatus("locating");
            setEnabled(true);
        } catch (cause: unknown) {
            if (requestId.current !== id) return;
            setStatus("error");
            setError(
                `Could not access your location: ${getErrorMessage(cause)}`,
            );
        } finally {
            if (requestId.current === id) requesting.current = false;
        }
    }, [focused]);

    return {
        position: enabled && focused && appState === "active" ? position : null,
        status,
        error,
        locate,
    };
}
