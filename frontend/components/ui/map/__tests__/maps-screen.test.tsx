import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react-native";
import MapsScreen from "@/app/maps";
import { MAP_STYLES } from "@/config/map-styles";
import trail from "@/data/mount-vernon-trail.json";
import { useUserLocation } from "@/hooks/use-user-location";
import { fetchMapEvents } from "@/services/map-event-service";
import {
    fetchMapIssues,
    type MapIssueData,
    type MapIssueFeature,
} from "@/services/map-service";
import { fitBounds, flyTo } from "@/test-utils/maplibre-mock";

let mockIssueId: string | undefined;
const mockRouter = { push: jest.fn(), setParams: jest.fn() };

jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ issueId: mockIssueId }),
    useRouter: () => mockRouter,
    useFocusEffect: (callback: () => void | (() => void)) =>
        require("react").useEffect(callback, [callback]),
}));
jest.mock("@maplibre/maplibre-react-native", () =>
    require("@/test-utils/maplibre-mock"),
);
jest.mock("@/components/ui/header", () => () => null);
jest.mock("@/components/ui/bottom-nav", () => () => null);
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@/hooks/use-user-location", () => ({ useUserLocation: jest.fn() }));
jest.mock("@/services/map-service", () => ({ fetchMapIssues: jest.fn() }));
jest.mock("@/services/map-event-service", () => ({
    ...jest.requireActual("@/services/map-event-service"),
    fetchMapEvents: jest.fn(),
}));

const originalKey = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const locate = jest.fn(async () => undefined);
const location = {
    position: null,
    status: "idle",
    error: null,
    locate,
} as const;
const shared: [number, number] = [-77.045, 38.73];
const upstream: [number, number] = [-77.025, 38.81];
const unassigned: [number, number] = [-77.035, 38.76];

function issue(
    id: string,
    name: string,
    coordinates: [number, number],
): MapIssueFeature {
    return {
        type: "Feature",
        id,
        geometry: { type: "Point", coordinates },
        properties: {
            cardId: id,
            name,
            locationName: "Along the trail",
            eventNames: [],
            imageUrl: null,
        },
    };
}

const data: MapIssueData = {
    geojson: {
        type: "FeatureCollection",
        features: [
            issue("vines", "Clear vines", shared),
            issue("fence", "Repair fence", shared),
            issue("drain", "Clear drain", upstream),
            issue("litter", "Collect litter", unassigned),
        ],
    },
    issueAliases: { short: "vines" },
    unlocatedIssues: [{ cardId: "unknown", name: "Inspect fallen branch" }],
};

const events = [
    {
        id: "spring",
        name: "Spring cleanup",
        issueIds: ["vines", "fence", "drain", "unknown"],
    },
    { id: "survey", name: "Location survey", issueIds: ["unknown"] },
];

beforeEach(() => {
    process.env.EXPO_PUBLIC_TRELLO_API_KEY = "test-key";
    mockIssueId = undefined;
    jest.mocked(fetchMapIssues).mockReset().mockResolvedValue(data);
    jest.mocked(fetchMapEvents).mockReset().mockResolvedValue(events);
    jest.mocked(useUserLocation).mockReturnValue(location);
});

afterEach(() => {
    if (originalKey === undefined)
        delete process.env.EXPO_PUBLIC_TRELLO_API_KEY;
    else process.env.EXPO_PUBLIC_TRELLO_API_KEY = originalKey;
});

function nativeMap(event: string) {
    fireEvent(screen.getByTestId("native-map"), event);
}

async function waitForFilters() {
    await waitFor(() =>
        expect(
            screen.getByRole("button", { name: "Filter by event: All issues" }),
        ).toBeEnabled(),
    );
}

function chooseEvent(current: string, option: string) {
    fireEvent.press(
        screen.getByRole("button", { name: `Filter by event: ${current}` }),
    );
    fireEvent.press(screen.getByRole("radio", { name: option }));
}

it("retries a failed basemap and switches between normal and satellite", async () => {
    render(<MapsScreen />);
    await waitForFilters();
    const recenter = () => screen.getByRole("button", { name: /Recenter map/ });
    const initialMap = screen.getByTestId("native-map");
    expect(initialMap.props.mapStyle).toBe(MAP_STYLES.normal);
    expect(screen.getByText("Loading map…")).toBeOnTheScreen();
    expect(recenter()).toBeDisabled();

    nativeMap("onDidFailLoadingMap");
    expect(screen.getByText(/Could not load the map/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByTestId("native-map")).not.toBe(initialMap);
    expect(screen.getByText("Loading map…")).toBeOnTheScreen();
    nativeMap("onDidFinishLoadingMap");
    expect(recenter()).toBeEnabled();

    fireEvent.press(
        screen.getByRole("button", { name: "Switch to satellite map" }),
    );
    expect(screen.getByTestId("native-map").props.mapStyle).toBe(
        MAP_STYLES.satellite,
    );
    expect(recenter()).toBeDisabled();
    nativeMap("onDidFinishLoadingStyle");
    expect(recenter()).toBeEnabled();
    fireEvent.press(
        screen.getByRole("button", { name: "Switch to normal map" }),
    );
    expect(screen.getByTestId("native-map").props.mapStyle).toBe(
        MAP_STYLES.normal,
    );
    expect(fetchMapIssues).toHaveBeenCalledTimes(1);
});

it("filters pins and heatmap points, updates the camera, and handles an event with no pins", async () => {
    render(<MapsScreen />);
    await waitForFilters();

    chooseEvent("All issues", "Spring cleanup, 4 issues");
    expect(screen.getByText("4 intake cards · 3 pins")).toBeOnTheScreen();
    expect(screen.queryByTestId("pin-litter")).toBeNull();
    expect(screen.getByTestId("pin-vines")).toBeOnTheScreen();
    expect(screen.getByTestId("pin-drain")).toBeOnTheScreen();
    expect(
        JSON.parse(
            screen.getByTestId("source-issue-density").props.data,
        ).features.map(
            (feature: MapIssueFeature) => feature.geometry.coordinates,
        ),
    ).toEqual([shared, shared, upstream]);
    expect(fitBounds).toHaveBeenCalledWith(
        [shared[0], shared[1], upstream[0], upstream[1]],
        expect.objectContaining({ duration: 600 }),
    );

    chooseEvent("Spring cleanup", "Unassigned, 1 issues");
    expect(screen.getByTestId("pin-litter")).toBeOnTheScreen();
    expect(screen.queryByTestId("pin-vines")).toBeNull();
    expect(flyTo).toHaveBeenLastCalledWith({
        center: unassigned,
        zoom: 14,
        duration: 600,
    });

    flyTo.mockClear();
    fitBounds.mockClear();
    chooseEvent("Unassigned", "Location survey, 1 issues");
    expect(
        screen.getByText("No mapped issues for this selection."),
    ).toBeOnTheScreen();
    expect(screen.getByText("1 intake cards · 0 pins")).toBeOnTheScreen();
    expect(screen.queryByTestId("pin-litter")).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
});

it("opens a grouped pin, navigates to the chosen issue, and closes the sheet", async () => {
    render(<MapsScreen />);
    await waitForFilters();
    const groupedPin = screen.getByTestId("pin-vines");
    expect(within(groupedPin).getByText("2")).toBeOnTheScreen();
    expect(screen.queryByTestId("pin-fence")).toBeNull();

    fireEvent.press(groupedPin);
    expect(screen.getByText("2 issues at this location")).toBeOnTheScreen();
    fireEvent.press(
        screen.getByRole("link", { name: "Open issue: Repair fence" }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: "/trail-issue-screen",
        params: { issueId: "fence", issueName: "Repair fence" },
    });
    await waitFor(() =>
        expect(screen.queryByLabelText("Issues at this location")).toBeNull(),
    );

    fireEvent.press(screen.getByTestId("pin-drain"));
    expect(screen.getByLabelText("Issue details")).toBeOnTheScreen();
    fireEvent.press(
        screen.getByRole("button", { name: "Close issue details" }),
    );
    await waitFor(() =>
        expect(screen.queryByLabelText("Issue details")).toBeNull(),
    );
});

it("recovers from an intake load failure and shows cards that need locations", async () => {
    jest.mocked(fetchMapIssues).mockRejectedValueOnce(
        new Error("Intake unavailable"),
    );
    render(<MapsScreen />);
    expect(screen.getByText("Loading trail issues…")).toBeOnTheScreen();
    expect(
        screen.getByRole("button", { name: "Refresh intake cards" }),
    ).toBeDisabled();
    expect(await screen.findByText("Intake unavailable")).toBeOnTheScreen();

    fireEvent.press(
        screen.getByRole("button", { name: "Refresh intake cards" }),
    );
    await waitForFilters();
    expect(fetchMapEvents).toHaveBeenCalledWith("test-key", data.issueAliases);
    expect(screen.getByText("5 intake cards · 4 pins")).toBeOnTheScreen();
    fireEvent.press(
        screen.getByRole("button", { name: "View cards that need a location" }),
    );
    expect(screen.getByText("Inspect fallen branch")).toBeOnTheScreen();
    expect(screen.queryByText("Clear vines")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Inspect fallen branch")).toBeNull();
    fireEvent.press(
        screen.getByRole("button", { name: "Dismiss issue pin notice" }),
    );
    expect(screen.queryByText("5 intake cards · 4 pins")).toBeNull();
});

it("keeps intake pins when event filters fail and drops a removed filter after refreshing", async () => {
    jest.mocked(fetchMapEvents)
        .mockRejectedValueOnce(new Error("Events unavailable"))
        .mockResolvedValueOnce(events)
        .mockResolvedValueOnce([]);
    render(<MapsScreen />);
    expect(
        await screen.findByText(/Event filters unavailable/),
    ).toBeOnTheScreen();
    expect(
        screen.getByRole("button", { name: "Filter by event: All issues" }),
    ).toBeDisabled();
    expect(screen.getByTestId("pin-litter")).toBeOnTheScreen();

    fireEvent.press(
        screen.getByRole("button", { name: "Refresh intake cards" }),
    );
    await waitForFilters();
    chooseEvent("All issues", "Spring cleanup, 4 issues");
    expect(screen.queryByTestId("pin-litter")).toBeNull();

    fireEvent.press(
        screen.getByRole("button", { name: "Refresh intake cards" }),
    );
    await waitForFilters();
    expect(screen.getByTestId("pin-litter")).toBeOnTheScreen();
    fireEvent.press(
        screen.getByRole("button", { name: "Filter by event: All issues" }),
    );
    expect(screen.queryByRole("radio", { name: /Spring cleanup/ })).toBeNull();
});

it("opens landmark details from search and native pins and recenters to the full trail", async () => {
    render(<MapsScreen />);
    await waitForFilters();
    nativeMap("onDidFinishLoadingMap");

    fireEvent.press(
        screen.getByRole("button", { name: "Search trail landmarks" }),
    );
    fireEvent.changeText(
        screen.getByLabelText("Landmark name or abbreviation"),
        "M4",
    );
    fireEvent.press(screen.getByRole("button", { name: "View Mile Marker 4" }));
    expect(
        screen.getByRole("header", { name: "Mile Marker 4" }),
    ).toBeOnTheScreen();
    expect(flyTo).toHaveBeenLastCalledWith({
        center: [-77.045972, 38.730911],
        zoom: 14,
        duration: 700,
    });
    fireEvent.press(screen.getByRole("button", { name: "Back to map" }));

    const source = screen.getByTestId("source-trail-landmark-markers");
    const feature = JSON.parse(source.props.data).features.find(
        (item: { id: string }) =>
            item.id === "riverside-park-little-hunting-creek",
    );
    expect(feature.properties).toEqual({
        markerId: "riverside-park-little-hunting-creek",
        label: "RP",
        kind: "monument",
    });
    fireEvent(source, "press", {
        nativeEvent: { features: [] },
        stopPropagation: jest.fn(),
    });
    expect(screen.queryByRole("header")).toBeNull();
    const stopPropagation = jest.fn();
    fireEvent(source, "press", {
        nativeEvent: { features: [feature] },
        stopPropagation,
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(
        screen.getByRole("header", {
            name: "Riverside Park / Little Hunting Creek",
        }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Amenities shown|Water Fountain/)).toBeNull();
    fireEvent.press(
        screen.getByRole("button", { name: "Close landmark details" }),
    );

    fireEvent.press(screen.getByRole("button", { name: /Recenter map/ }));
    const points = trail.features.flatMap(
        ({ geometry }) => geometry.coordinates,
    );
    const longitude = points.map(([value]) => value);
    const latitude = points.map(([, value]) => value);
    expect(fitBounds).toHaveBeenLastCalledWith(
        [
            Math.min(...longitude),
            Math.min(...latitude),
            Math.max(...longitude),
            Math.max(...latitude),
        ],
        expect.objectContaining({ bearing: 0, pitch: 0 }),
    );
    expect(screen.getByTestId("layer-trail-highlight")).toBeOnTheScreen();
    expect(screen.getByTestId("layer-trail-bridge-beavers")).toBeOnTheScreen();
});

it("shows permission feedback, recenters on the next fix once, and keeps tracking the dot", async () => {
    const view = render(<MapsScreen />);
    await waitForFilters();
    nativeMap("onDidFinishLoadingMap");
    expect(locate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pin-current-user-location")).toBeNull();
    const locationButton = () =>
        screen.getByRole("button", { name: "Show my current location" });
    fireEvent.press(locationButton());
    expect(locate).toHaveBeenCalledTimes(1);

    jest.mocked(useUserLocation).mockReturnValue({
        ...location,
        status: "denied",
        error: "Location access is off.",
    });
    view.rerender(<MapsScreen />);
    expect(screen.getByText("Location access is off.")).toBeOnTheScreen();
    fireEvent.press(locationButton());
    expect(locate).toHaveBeenCalledTimes(2);

    jest.mocked(useUserLocation).mockReturnValue({
        ...location,
        status: "locating",
    });
    view.rerender(<MapsScreen />);
    expect(locationButton()).toBeDisabled();
    expect(screen.getByText("Finding location…")).toBeOnTheScreen();

    const position = (longitude: number, latitude: number) => ({
        ...location,
        status: "ready" as const,
        position: {
            coords: {
                longitude,
                latitude,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
            },
            timestamp: 0,
        },
    });
    jest.mocked(useUserLocation).mockReturnValue(position(-77.05, 38.75));
    view.rerender(<MapsScreen />);
    expect(screen.getByLabelText("Your current location")).toBeOnTheScreen();
    expect(flyTo).toHaveBeenCalledWith({
        center: [-77.05, 38.75],
        zoom: 14,
        duration: 800,
    });
    expect(locationButton()).toBeEnabled();

    jest.mocked(useUserLocation).mockReturnValue(position(-77.06, 38.76));
    view.rerender(<MapsScreen />);
    expect(
        screen.getByTestId("pin-current-user-location").props.lngLat,
    ).toEqual([-77.06, 38.76]);
    expect(flyTo).toHaveBeenCalledTimes(1);
});

it("opens a preview deep link after the map loads and consumes it once", async () => {
    mockIssueId = "fence";
    const view = render(<MapsScreen />);
    await waitForFilters();
    expect(screen.queryByLabelText("Issues at this location")).toBeNull();
    nativeMap("onDidFinishLoadingMap");

    expect(screen.getByText("2 issues at this location")).toBeOnTheScreen();
    expect(mockRouter.setParams).toHaveBeenCalledWith({ issueId: undefined });
    expect(flyTo).toHaveBeenCalledWith({
        center: shared,
        zoom: 15,
        duration: 700,
    });
    mockIssueId = undefined;
    view.rerender(<MapsScreen />);
    expect(mockRouter.setParams).toHaveBeenCalledTimes(1);
    expect(fetchMapIssues).toHaveBeenCalledTimes(1);
});

it("consumes an unavailable preview link and leaves the other pins usable", async () => {
    mockIssueId = "missing";
    render(<MapsScreen />);
    await waitForFilters();
    nativeMap("onDidFinishLoadingMap");
    expect(
        screen.getByText(/This issue is no longer in Intake/),
    ).toBeOnTheScreen();
    expect(mockRouter.setParams).toHaveBeenCalledWith({ issueId: undefined });
    expect(flyTo).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("pin-drain"));
    expect(screen.getByLabelText("Issue details")).toBeOnTheScreen();
});

it("ignores an event response from before a refresh", async () => {
    let resolveOld!: (value: typeof events) => void;
    const oldEvents = new Promise<typeof events>((resolve) => {
        resolveOld = resolve;
    });
    jest.mocked(fetchMapEvents)
        .mockReturnValueOnce(oldEvents)
        .mockResolvedValueOnce([]);
    render(<MapsScreen />);
    await screen.findByText("5 intake cards · 4 pins");
    fireEvent.press(
        screen.getByRole("button", { name: "Refresh intake cards" }),
    );
    await waitForFilters();
    await act(async () => {
        resolveOld(events);
    });

    fireEvent.press(
        screen.getByRole("button", { name: "Filter by event: All issues" }),
    );
    expect(screen.queryByRole("radio", { name: /Spring cleanup/ })).toBeNull();
    expect(
        screen.getByRole("radio", { name: "Unassigned, 5 issues" }),
    ).toBeOnTheScreen();
});
