import { setupEvent } from "../event-setup";
import { createAlbum, getAlbum } from "@/api/backend-client";
import {
    releaseAlbumTitle,
    reserveAlbumTitle,
    stageAlbum,
} from "../album-service";
import { createEvent } from "../event-service";
import {
    addAlbumLinkToCard,
    archiveCard,
    createEventCard,
} from "../trello-service";

jest.mock("@/api/backend-client", () => ({
    createAlbum: jest.fn(),
    getAlbum: jest.fn(),
}));
jest.mock("../album-service", () => ({
    releaseAlbumTitle: jest.fn(),
    reserveAlbumTitle: jest.fn(),
    stageAlbum: jest.fn(),
}));
jest.mock("../event-service", () => ({ createEvent: jest.fn() }));
jest.mock("../trello-service", () => ({
    addAlbumLinkToCard: jest.fn(),
    archiveCard: jest.fn(),
    createEventCard: jest.fn(),
}));

const mockCreateAlbum = createAlbum as jest.MockedFunction<typeof createAlbum>;
const mockGetAlbum = getAlbum as jest.MockedFunction<typeof getAlbum>;
const mockReleaseAlbumTitle = releaseAlbumTitle as jest.MockedFunction<
    typeof releaseAlbumTitle
>;
const mockReserveAlbumTitle = reserveAlbumTitle as jest.MockedFunction<
    typeof reserveAlbumTitle
>;
const mockStageAlbum = stageAlbum as jest.MockedFunction<typeof stageAlbum>;
const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;
const mockAddAlbumLink = addAlbumLinkToCard as jest.MockedFunction<
    typeof addAlbumLinkToCard
>;
const mockArchiveCard = archiveCard as jest.MockedFunction<typeof archiveCard>;
const mockCreateEventCard = createEventCard as jest.MockedFunction<
    typeof createEventCard
>;

const INPUT = {
    title: "Cleanup",
    description: "Pick up litter",
    eventDate: new Date("2026-05-01T00:00:00Z"),
    eventLeader: "Ada",
    zoneLeaders: "",
    toolHaulers: "",
    gloverLover: "",
    notes: "",
};

beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAlbum.mockResolvedValue({
        id: "album-1",
        title: "Cleanup",
        productUrl: "https://photos.example/album-1",
    });
    mockGetAlbum.mockResolvedValue({
        id: "album-1",
        title: "Cleanup",
        productUrl: "https://photos.example/album-1",
    });
    mockStageAlbum.mockResolvedValue();
    mockReleaseAlbumTitle.mockResolvedValue();
    mockCreateEventCard.mockResolvedValue({
        cardId: "card-1",
        cardUrl: "https://trello.example/card-1",
    });
    mockAddAlbumLink.mockResolvedValue();
    mockArchiveCard.mockResolvedValue();
});

it("reuses a staged remote album after a downstream failure", async () => {
    mockReserveAlbumTitle
        .mockResolvedValueOnce({
            titleKey: "t_cleanup",
            existingAlbumId: null,
        })
        .mockResolvedValueOnce({
            titleKey: "t_cleanup",
            existingAlbumId: "album-1",
        });
    mockCreateEvent
        .mockRejectedValueOnce(new Error("Firestore unavailable"))
        .mockResolvedValueOnce("event-1");

    await expect(setupEvent(INPUT, "trello-key")).rejects.toThrow(
        "Firestore unavailable",
    );
    await expect(setupEvent(INPUT, "trello-key")).resolves.toMatchObject({
        eventId: "event-1",
        albumId: "album-1",
    });

    expect(mockCreateAlbum).toHaveBeenCalledTimes(1);
    expect(mockGetAlbum).toHaveBeenCalledTimes(1);
    expect(mockReleaseAlbumTitle).toHaveBeenCalledWith("t_cleanup");
    expect(mockArchiveCard).toHaveBeenCalledWith("card-1", "trello-key");
});

it("passes the reservation key into the atomic event commit", async () => {
    mockReserveAlbumTitle.mockResolvedValue({
        titleKey: "t_cleanup",
        existingAlbumId: null,
    });
    mockCreateEvent.mockResolvedValue("event-1");

    await setupEvent(INPUT, "trello-key");

    expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
            titleKey: "t_cleanup",
            albumId: "album-1",
        }),
    );
});
