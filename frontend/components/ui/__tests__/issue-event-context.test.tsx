import type { IssuePhotos } from "@/services/photo-queue";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import TrailIssueDetailScreen from "@/app/trail-issue-screen";
import { getEventById } from "@/services/event-service";

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockFlush = jest.fn(async () => ({ uploaded: 0, failed: 0 }));
let mockIssuePhotos: IssuePhotos = {};
jest.mock("expo-router", () => ({
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: jest.fn(),
    }),
    Stack: { Screen: () => null },
}));
jest.mock("@/components/ui/header", () => () => null);
jest.mock("@/components/ui/map/issue-map-preview", () => () => null);
jest.mock("@/services/event-service", () => ({ getEventById: jest.fn() }));
jest.mock("@/services/trello-config", () => ({ getTrelloClient: jest.fn() }));
jest.mock("@/services/trello-service", () => ({
    createIssueCard: jest.fn(),
    updateIssueCard: jest.fn(),
}));
jest.mock("@/hooks/use-photo-queue", () => ({
    usePhotoQueue: () => ({ issuePhotos: mockIssuePhotos, flush: mockFlush }),
}));

beforeEach(() => {
    mockIssuePhotos = {};
    mockParams = {
        issueId: "issue-1",
        issueName: "Test issue",
        description: "Notes:\nTest",
    };
    delete process.env.EXPO_PUBLIC_BACKEND_URL;
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("explains missing event context and offers navigation home", async () => {
    const view = await render(<TrailIssueDetailScreen />);
    expect(await view.findByText("Open an event to add photos")).toBeTruthy();
    expect(view.getByText("PHOTOS")).toBeTruthy();
    expect(view.getByTestId("issue-photo-cards")).toBeTruthy();
    expect(getEventById).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText("Go to Home"));
    expect(mockReplace).toHaveBeenCalledWith("/home-screen");
    expect(mockPush).not.toHaveBeenCalled();
});

it("can retry a failed event lookup and then open the correct album's camera", async () => {
    mockParams.eventId = "event-1";
    jest.mocked(getEventById).mockRejectedValueOnce(
        new Error("Permission denied"),
    );
    const view = await render(<TrailIssueDetailScreen />);
    expect(
        await view.findByText("Could not load this event: Permission denied"),
    ).toBeTruthy();
    jest.mocked(getEventById).mockResolvedValueOnce({
        eventId: "event-1",
        albumId: "album-1",
    } as never);
    await fireEvent.press(view.getByText("Retry loading event"));
    await waitFor(() =>
        expect(view.queryByText("Photos unavailable")).toBeNull(),
    );
    await fireEvent.press(view.getByLabelText("Before photo"));
    expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
            pathname: "/camera-view",
            params: expect.objectContaining({
                eventId: "event-1",
                albumId: "album-1",
            }),
        }),
    );
});

function addUnconfirmedPhoto() {
    mockIssuePhotos = {
        "issue-1": {
            before: {
                id: "photo-1",
                eventId: "event-1",
                albumId: "album-1",
                issueId: "issue-1",
                issueName: "Test issue",
                slot: "before",
                uri: "file:///a.jpg",
                createdAt: 1,
                status: "unconfirmed",
                error: "Check the album before retrying.",
            },
        },
    };
}

it("uses the new popup to cancel or explicitly confirm an uncertain retry", async () => {
    addUnconfirmedPhoto();
    const view = await render(<TrailIssueDetailScreen />);
    await fireEvent.press(await view.findByText("Retry 1 upload"));
    expect(view.getByText("Check the album first")).toBeTruthy();
    expect(mockFlush).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText("Cancel"));
    expect(view.queryByText("Check the album first")).toBeNull();
    expect(mockFlush).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText("Retry 1 upload"));
    await fireEvent.press(view.getByText("Retry anyway"));
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledWith(["photo-1"]);
    expect(view.queryByText("Check the album first")).toBeNull();
});

it.each([false, true])(
    "hides the entire Photos section for a map issue (saved photo: %s)",
    async (hasPhoto) => {
        mockParams.source = "map";
        if (hasPhoto) addUnconfirmedPhoto();
        const view = await render(<TrailIssueDetailScreen />);
        await view.findByDisplayValue("Test issue");
        expect(view.queryByText("PHOTOS")).toBeNull();
        expect(view.queryByTestId("issue-photo-cards")).toBeNull();
        expect(view.queryByText("Before")).toBeNull();
        expect(view.queryByText("After")).toBeNull();
        expect(view.queryByText("Upload not confirmed")).toBeNull();
        expect(view.getByText("NOTES")).toBeTruthy();
        expect(view.queryByText("Open an event to add photos")).toBeNull();
        expect(view.queryByText("Check your photo album")).toBeNull();
        expect(view.queryByText("Retry 1 upload")).toBeNull();
        expect(view.queryByText("Photo capture unavailable")).toBeNull();
        expect(view.queryByLabelText("Before photo")).toBeNull();
        expect(view.queryByLabelText("After photo")).toBeNull();
        expect(mockFlush).not.toHaveBeenCalled();
    },
);
