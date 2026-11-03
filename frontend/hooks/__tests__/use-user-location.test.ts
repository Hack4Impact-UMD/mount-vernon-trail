import { act, renderHook } from "@testing-library/react-native";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import {
    LocationManager,
    type GeolocationPosition,
} from "@maplibre/maplibre-react-native";
import { useUserLocation } from "../use-user-location";

jest.mock("react-native/Libraries/AppState/AppState", () => ({
    __esModule: true,
    default: { currentState: "active", addEventListener: jest.fn() },
}));

jest.mock("@maplibre/maplibre-react-native", () => ({
    LocationManager: {
        requestPermissions: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
    },
}));
jest.mock("expo-router", () => ({
    useFocusEffect: (callback: () => void | (() => void)) => {
        const React = require("react");
        React.useEffect(callback, [callback]);
    },
}));

let changeAppState: (state: "active" | "background" | "inactive") => void;
const fix = (): GeolocationPosition => ({
    timestamp: Platform.OS === "ios" ? Date.now() / 1000 : Date.now(),
    coords: {
        latitude: 38.78,
        longitude: -77.06,
        accuracy: 20,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
    },
});
const lastListener = () =>
    jest.mocked(LocationManager.addListener).mock.calls.at(-1)![0];

beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, "OS", "ios");
    jest.replaceProperty(AppState, "currentState", "active");
    jest.spyOn(AppState, "addEventListener").mockImplementation(
        (_event, listener) => {
            changeAppState = listener;
            return { remove: jest.fn() };
        },
    );
    jest.mocked(LocationManager.requestPermissions).mockResolvedValue(true);
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

it("requests access only on demand and waits for a fresh fix", async () => {
    const { result } = renderHook(() => useUserLocation());
    expect(LocationManager.requestPermissions).not.toHaveBeenCalled();
    await act(async () => {
        await result.current.locate();
    });
    expect(result.current.status).toBe("locating");
    act(() =>
        lastListener()({ ...fix(), timestamp: (Date.now() - 60000) / 1000 }),
    );
    expect(result.current.position).toBeNull();
    act(() => lastListener()(fix()));
    expect(result.current.status).toBe("ready");
    expect(result.current.position?.coords.latitude).toBe(38.78);
});

it("keeps tracking off when permission is denied", async () => {
    jest.mocked(LocationManager.requestPermissions).mockResolvedValue(false);
    const { result } = renderHook(() => useUserLocation());
    await act(async () => {
        await result.current.locate();
    });
    expect(result.current.status).toBe("denied");
    expect(LocationManager.addListener).not.toHaveBeenCalled();
});

it("accepts Android approximate location", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    jest.spyOn(PermissionsAndroid, "requestMultiple").mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: "granted",
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: "denied",
    } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    const { result } = renderHook(() => useUserLocation());
    await act(async () => {
        await result.current.locate();
    });
    expect(result.current.status).toBe("locating");
    expect(LocationManager.addListener).toHaveBeenCalledTimes(1);
});

it("stops in the background, resumes in the foreground, and cleans up on unmount", async () => {
    const { result, unmount } = renderHook(() => useUserLocation());
    await act(async () => {
        await result.current.locate();
    });
    const listener = lastListener();
    act(() => listener(fix()));
    act(() => changeAppState("background"));
    expect(LocationManager.removeListener).toHaveBeenCalledWith(listener);
    expect(result.current.position).toBeNull();
    act(() => changeAppState("active"));
    expect(LocationManager.addListener).toHaveBeenCalledTimes(2);
    const resumedListener = lastListener();
    unmount();
    expect(LocationManager.removeListener).toHaveBeenCalledWith(
        resumedListener,
    );
});

it("does not start tracking if permission resolves after leaving the map", async () => {
    let grant!: (allowed: boolean) => void;
    jest.mocked(LocationManager.requestPermissions).mockReturnValue(
        new Promise((resolve) => {
            grant = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useUserLocation());
    let request!: Promise<void>;
    act(() => {
        request = result.current.locate();
    });
    unmount();
    await act(async () => {
        grant(true);
        await request;
    });
    expect(LocationManager.addListener).not.toHaveBeenCalled();
});

it("stops listening and explains a missing position after the timeout", async () => {
    const { result } = renderHook(() => useUserLocation());
    await act(async () => {
        await result.current.locate();
    });
    const listener = lastListener();
    act(() => jest.advanceTimersByTime(15000));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Location Services");
    expect(LocationManager.removeListener).toHaveBeenCalledWith(listener);
});
