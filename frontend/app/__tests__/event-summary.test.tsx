import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";
import { Timestamp } from "firebase/firestore";
import type { Event } from "@/services/event-service";
import {
    clearActiveEventLocally,
    getEventById,
    saveDraft,
    updateEventNotes,
} from "@/services/event-service";
import EventSummaryScreen from "../event-summary";

const mockRouter = {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: jest.fn(),
    replace: jest.fn(),
};

jest.mock("expo-router", () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ eventId: "event-123" }),
}));

jest.mock("@/services/event-service", () => ({
    clearActiveEventLocally: jest.fn(),
    extractMetricsWithHours: jest.fn(() => undefined),
    getEventById: jest.fn(),
    saveDraft: jest.fn(),
    updateEventNotes: jest.fn(),
}));

jest.mock("@/components/ui/header", () => () => null);
jest.mock("@/components/ui/trail-event-header", () => () => null);

const timestamp = Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));
const event: Event = {
    eventId: "event-123",
    title: "Trail cleanup",
    description: "",
    date: timestamp,
    trelloCardId: "",
    albumId: "",
    albumUrl: "",
    createdBy: "admin",
    startedBy: "volunteer",
    startDate: timestamp,
    isActive: false,
    isDraft: false,
    savedAsDraftAt: null,
    endDate: timestamp,
    createdAt: timestamp,
    eventLeader: "",
    zoneLeaders: "",
    toolHaulers: "",
    gloverLover: "",
    notes: "",
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEventById).mockResolvedValue(event);
    jest.mocked(saveDraft).mockResolvedValue(undefined);
    jest.mocked(clearActiveEventLocally).mockResolvedValue(undefined);
    jest.mocked(updateEventNotes).mockResolvedValue(undefined);
});

it("opens a saved draft from the event summary", async () => {
    render(<EventSummaryScreen />);

    fireEvent.press(await screen.findByText("Save as draft"));
    await screen.findByText("Saved as draft!");
    fireEvent.press(screen.getByText("Edit event now"));

    await waitFor(() => {
        expect(updateEventNotes).toHaveBeenCalledWith("event-123", "");
        expect(mockRouter.replace).toHaveBeenCalledWith({
            pathname: "/edit-draft",
            params: { eventId: "event-123" },
        });
    });
});
