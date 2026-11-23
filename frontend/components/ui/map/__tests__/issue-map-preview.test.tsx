import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useUserLocation } from "@/hooks/use-user-location";
import type { Card } from "@/services/trello-types";
import { fitBounds } from "@/test-utils/maplibre-mock";
import IssueMapPreview from "../issue-map-preview";

const mockNavigate = jest.fn();
const mockGetCardByID = jest.fn<Promise<Card>, [string, boolean]>();
const mockLoadTrelloImage = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => ({ navigate: mockNavigate }),
    useFocusEffect: (callback: () => void | (() => void)) =>
        require("react").useEffect(callback, [callback]),
}));
jest.mock("@maplibre/maplibre-react-native", () =>
    require("@/test-utils/maplibre-mock"),
);
jest.mock("@/hooks/use-user-location", () => ({ useUserLocation: jest.fn() }));
jest.mock("@/services/trello-config", () => ({
    getTrelloClient: () => ({
        getCardByID: mockGetCardByID,
        loadTrelloImage: mockLoadTrelloImage,
    }),
}));

const originalKey = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const locate = jest.fn(async () => undefined);
const idle = { position: null, status: "idle", error: null, locate } as const;
const card: Card = {
    id: "bridge-issue",
    name: "B15 Clear branches",
    desc: "",
    idList: "intake",
    idBoard: "trail-board",
    creationDate: new Date(0),
};

beforeEach(() => {
    process.env.EXPO_PUBLIC_TRELLO_API_KEY = "test-key";
    mockGetCardByID.mockReset().mockResolvedValue(card);
    jest.mocked(useUserLocation).mockReturnValue(idle);
});

afterEach(() => {
    if (originalKey === undefined)
        delete process.env.EXPO_PUBLIC_TRELLO_API_KEY;
    else process.env.EXPO_PUBLIC_TRELLO_API_KEY = originalKey;
});

it("resolves the location from a Trello card and links to the focused map", async () => {
    const request = Promise.withResolvers<Card>();
    mockGetCardByID.mockReturnValueOnce(request.promise);
    await render(<IssueMapPreview issueId={card.id} />);
    expect(screen.getByText("Loading issue location…")).toBeOnTheScreen();
    expect(locate).not.toHaveBeenCalled();

    await act(() => request.resolve(card));
    const link = screen.getByRole("link", {
        name: "Show Bridge 15 on the map",
    });
    expect(mockGetCardByID).toHaveBeenCalledWith(card.id, true);
    expect(screen.getByTestId("native-camera").props.initialViewState).toEqual({
        center: [-77.042314, 38.72585],
        zoom: 14,
    });
    expect(screen.getByTestId("pin-bridge-issue").props.lngLat).toEqual([
        -77.042314, 38.72585,
    ]);
    expect(locate).toHaveBeenCalledTimes(1);
    await fireEvent.press(link);
    expect(mockNavigate).toHaveBeenCalledWith({
        pathname: "/maps",
        params: { issueId: card.id },
    });
});

it("fits the preview to both positions once the native map is ready", async () => {
    jest.mocked(useUserLocation).mockReturnValue({
        ...idle,
        status: "ready",
        position: {
            coords: {
                longitude: -77.06,
                latitude: 38.8,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
            },
            timestamp: 0,
        },
    });
    await render(<IssueMapPreview issueId={card.id} />);
    await screen.findByRole("link");
    expect(screen.getByLabelText("Your current location")).toBeOnTheScreen();
    expect(fitBounds).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId("native-map"), "onDidFinishLoadingMap");
    expect(fitBounds).toHaveBeenCalledWith(
        [-77.06, 38.72585, -77.042314, 38.8],
        expect.objectContaining({ duration: 400 }),
    );
});

it("keeps the map link usable when location permission is denied", async () => {
    jest.mocked(useUserLocation).mockReturnValue({
        ...idle,
        status: "denied",
        error: "Location access is off.",
    });
    await render(<IssueMapPreview issueId={card.id} />);
    expect(
        await screen.findByText("Location access is off."),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("Your current location")).toBeNull();
    await fireEvent.press(screen.getByRole("link", { name: /Show Bridge 15/ }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it("explains an unmapped issue without showing a link or requesting GPS", async () => {
    mockGetCardByID.mockResolvedValueOnce({ ...card, name: "Clear branches" });
    await render(<IssueMapPreview issueId={card.id} />);
    expect(
        await screen.findByText("This issue does not have a map location yet."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("link")).toBeNull();
    expect(locate).not.toHaveBeenCalled();
});

it("shows a distinct error when the card request fails", async () => {
    mockGetCardByID.mockRejectedValueOnce(new Error("Request failed"));
    await render(<IssueMapPreview issueId={card.id} />);
    expect(
        await screen.findByText("Could not load this issue’s map location."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("link")).toBeNull();
    expect(locate).not.toHaveBeenCalled();
});

it("ignores a stale card request after opening a different issue", async () => {
    let resolveOld!: (value: Card) => void;
    const oldCard = new Promise<Card>((resolve) => {
        resolveOld = resolve;
    });
    mockGetCardByID.mockReturnValueOnce(oldCard).mockResolvedValueOnce({
        ...card,
        id: "mile-issue",
        name: "M4 Clear branches",
    });
    const view = await render(<IssueMapPreview issueId={card.id} />);
    await view.rerender(<IssueMapPreview issueId="mile-issue" />);
    await screen.findByRole("link", { name: "Show Mile Marker 4 on the map" });
    await act(async () => {
        resolveOld(card);
    });
    expect(
        screen.queryByRole("link", { name: "Show Bridge 15 on the map" }),
    ).toBeNull();
    await fireEvent.press(
        screen.getByRole("link", { name: "Show Mile Marker 4 on the map" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({
        pathname: "/maps",
        params: { issueId: "mile-issue" },
    });
});
