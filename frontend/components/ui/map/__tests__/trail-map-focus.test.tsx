import React from "react";
import {
    fireEvent,
    fireEventAsync,
    render,
} from "@testing-library/react-native";
import TrailMap from "../trail-map";
import {
    fetchMapIssues,
    type MapIssueData,
    type MapIssueFeature,
} from "@/services/map-service";
import type { MapPin } from "../map-overlays";

let mockFocused = true;
const mockRouter = { setParams: jest.fn() };
jest.mock("expo-router", () => ({
    useRouter: () => mockRouter,
    useFocusEffect: (callback: () => (() => void) | void) => {
        const React = require("react");
        const focused = mockFocused;
        React.useEffect(
            () => (focused ? callback() : undefined),
            [callback, focused],
        );
    },
}));
jest.mock("@maplibre/maplibre-react-native", () => ({
    Map: "MockMap",
    Camera: () => null,
    ViewAnnotation: "MockAnnotation",
}));
jest.mock("../map-overlays", () => {
    const { Pressable } = require("react-native");
    return function MockMapOverlays({
        pins,
        onSelectPin,
    }: {
        pins: MapPin[];
        onSelectPin: (pin: MapPin) => void;
    }) {
        return (
            <Pressable
                testID="select-second"
                onPress={() => onSelectPin(pins[1])}
            />
        );
    };
});
jest.mock("../map-event-filter", () => () => null);
jest.mock("../trail-landmark-markers", () => () => null);
jest.mock("../trail-landmark-search", () => () => null);
jest.mock("../trail-landmark-detail-popup", () => () => null);
jest.mock("@/hooks/use-user-location", () => ({
    useUserLocation: () => ({
        position: null,
        status: "idle",
        locate: jest.fn(),
    }),
}));
jest.mock("@/services/map-service", () => ({ fetchMapIssues: jest.fn() }));
jest.mock("@/services/map-event-service", () => ({
    fetchMapEvents: jest.fn(async () => []),
    filterIssuesByEvent: (data: unknown) => data,
}));
const data: MapIssueData = {
    geojson: {
        type: "FeatureCollection",
        features: ["first", "second"].map<MapIssueFeature>((id, index) => ({
            type: "Feature",
            id,
            geometry: { type: "Point", coordinates: [-77, 38 + index] },
            properties: {
                cardId: id,
                name: id,
                locationName: id,
                imageUrl: null,
                eventNames: [],
            },
        })),
    },
    unlocatedIssues: [],
    issueAliases: {},
};

it("consumes the preview request and does not reopen it after visiting another issue", async () => {
    process.env.EXPO_PUBLIC_TRELLO_API_KEY = "test-key";
    mockFocused = true;
    jest.mocked(fetchMapIssues).mockResolvedValue(data);
    const onSelectIssue = jest.fn();
    const screen = (focusIssueId?: string) => (
        <TrailMap
            selectedIssue={null}
            onSelectIssue={onSelectIssue}
            focusIssueId={focusIssueId}
        />
    );
    const view = render(screen("first"));
    expect(fetchMapIssues).toHaveBeenCalledTimes(1);
    // Flush the native map callback and the pending Trello result together.
    await fireEventAsync(
        view.UNSAFE_getByType("MockMap" as never),
        "onDidFinishLoadingMap",
    );
    expect(onSelectIssue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "first" }),
    );
    expect(mockRouter.setParams).toHaveBeenCalledWith({ issueId: undefined });
    view.rerender(screen());
    expect(fetchMapIssues).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByTestId("select-second"));
    expect(onSelectIssue).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "second" }),
    );
    mockFocused = false;
    view.rerender(screen());
    mockFocused = true;
    await view.rerenderAsync(screen());
    expect(fetchMapIssues).toHaveBeenCalledTimes(2);
    expect(
        onSelectIssue.mock.calls.filter(([pin]) => pin?.id === "first"),
    ).toHaveLength(1);
    // Explicitly opening the original preview again still focuses that issue.
    await view.rerenderAsync(screen("first"));
    expect(
        onSelectIssue.mock.calls.filter(([pin]) => pin?.id === "first"),
    ).toHaveLength(2);
});
