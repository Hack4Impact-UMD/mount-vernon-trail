import { fetchMapEvents } from "@/services/map-event-service";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import TrailMap from "../trail-map";
import { fetchMapIssues } from "@/services/map-service";
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
    Map: (props: Record<string, unknown>) => {
        const React = require("react");
        const { View } = require("react-native");
        return React.createElement(View, { ...props, testID: "trail-map" });
    },
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
const data = {
    geojson: {
        type: "FeatureCollection",
        features: ["first", "second"].map((id, index) => ({
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
    jest.mocked(fetchMapIssues).mockResolvedValue(data as never);
    const onSelectIssue = jest.fn();
    const screen = (focusIssueId?: string) => (
        <TrailMap
            selectedIssue={null}
            onSelectIssue={onSelectIssue}
            focusIssueId={focusIssueId}
        />
    );
    const view = await render(screen("first"));
    await waitFor(() => expect(fetchMapIssues).toHaveBeenCalledTimes(1));
    // Native map callbacks can fire separately from the async Trello load.
    await fireEvent(view.getByTestId("trail-map"), "onDidFinishLoadingMap");
    await waitFor(() =>
        expect(onSelectIssue).toHaveBeenCalledWith(
            expect.objectContaining({ id: "first" }),
        ),
    );
    expect(mockRouter.setParams).toHaveBeenCalledWith({ issueId: undefined });
    await view.rerender(screen());
    expect(fetchMapIssues).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId("select-second"));
    expect(onSelectIssue).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "second" }),
    );
    mockFocused = false;
    await view.rerender(screen());
    mockFocused = true;
    await view.rerender(screen());
    await waitFor(() => expect(fetchMapIssues).toHaveBeenCalledTimes(2));
    expect(
        onSelectIssue.mock.calls.filter(([pin]) => pin?.id === "first"),
    ).toHaveLength(1);
    // Explicitly opening the original preview again still focuses that issue.
    await view.rerender(screen("first"));
    await waitFor(() =>
        expect(
            onSelectIssue.mock.calls.filter(([pin]) => pin?.id === "first"),
        ).toHaveLength(2),
    );
});

const linkedEvent = {
    id: "event",
    name: "Cleanup",
    issueIds: ["first", "second"],
    status: "In Progress" as const,
};

it.each([false, true])(
    "refreshes preview statuses after delayed events (grouped: %s)",
    async (grouped) => {
        process.env.EXPO_PUBLIC_TRELLO_API_KEY = "test-key";
        mockFocused = true;
        let finishEvents!: (events: (typeof linkedEvent)[]) => void;
        jest.mocked(fetchMapEvents).mockReturnValueOnce(
            new Promise((resolve) => {
                finishEvents = resolve;
            }),
        );
        const issues = grouped
            ? {
                  ...data,
                  geojson: {
                      ...data.geojson,
                      features: data.geojson.features.map((feature) => ({
                          ...feature,
                          geometry: {
                              ...feature.geometry,
                              coordinates: [-77, 38],
                          },
                      })),
                  },
              }
            : data;
        jest.mocked(fetchMapIssues).mockResolvedValue(issues as never);
        const selections = jest.fn();
        function Screen() {
            const [selected, setSelected] = React.useState<MapPin | null>(null);
            const [focus, setFocus] = React.useState<string | undefined>(
                "first",
            );
            const select = React.useCallback((pin: MapPin | null) => {
                selections(pin);
                setSelected(pin);
                if (pin) setFocus(undefined);
            }, []);
            return (
                <TrailMap
                    selectedIssue={selected}
                    onSelectIssue={select}
                    focusIssueId={focus}
                />
            );
        }
        const view = await render(<Screen />);
        await waitFor(() => expect(finishEvents).toBeDefined());
        await fireEvent(view.getByTestId("trail-map"), "onDidFinishLoadingMap");
        await waitFor(() =>
            expect(selections).toHaveBeenCalledWith(
                expect.objectContaining({ id: "first", eventStatuses: [] }),
            ),
        );
        await act(async () => {
            finishEvents([linkedEvent]);
        });
        await waitFor(() =>
            expect(selections).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    id: "first",
                    eventStatuses: [{ name: "Cleanup", status: "In Progress" }],
                    sameLocationIssues: expect.arrayContaining([
                        expect.objectContaining({
                            id: grouped ? "second" : "first",
                            eventStatuses: [
                                { name: "Cleanup", status: "In Progress" },
                            ],
                        }),
                    ]),
                }),
            ),
        );
    },
);

it("includes event statuses in grouped previews when events have already loaded", async () => {
    process.env.EXPO_PUBLIC_TRELLO_API_KEY = "test-key";
    mockFocused = true;
    jest.mocked(fetchMapEvents).mockResolvedValue([linkedEvent]);
    jest.mocked(fetchMapIssues).mockResolvedValue({
        ...data,
        geojson: {
            ...data.geojson,
            features: data.geojson.features.map((feature) => ({
                ...feature,
                geometry: { ...feature.geometry, coordinates: [-77, 38] },
            })),
        },
    } as never);
    const select = jest.fn();
    const view = await render(
        <TrailMap
            selectedIssue={null}
            onSelectIssue={select}
            focusIssueId="first"
        />,
    );
    await waitFor(() => expect(fetchMapEvents).toHaveBeenCalled());
    await act(async () => {});
    await fireEvent(view.getByTestId("trail-map"), "onDidFinishLoadingMap");
    await waitFor(() =>
        expect(select).toHaveBeenLastCalledWith(
            expect.objectContaining({
                sameLocationIssues: expect.arrayContaining(
                    ["first", "second"].map((id) =>
                        expect.objectContaining({
                            id,
                            eventStatuses: [
                                { name: "Cleanup", status: "In Progress" },
                            ],
                        }),
                    ),
                ),
            }),
        ),
    );
});
