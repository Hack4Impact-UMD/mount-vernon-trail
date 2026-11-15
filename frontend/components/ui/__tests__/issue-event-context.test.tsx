import { fireEvent, render, waitFor } from "@testing-library/react-native";
import TrailIssueDetailScreen from "@/app/trail-issue-screen";
import { getEventById } from "@/services/event-service";

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
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
    usePhotoQueue: () => ({ issuePhotos: {}, flush: jest.fn() }),
}));

beforeEach(() => {
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
