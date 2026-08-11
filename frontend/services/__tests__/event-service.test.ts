import { auth } from "@/config/firebase";

// jest.mock factories may only close over variables prefixed with "mock".
type WritePayload = Record<string, unknown>;

const mockBatchUpdate = jest.fn<void, [unknown, WritePayload]>();
const mockBatchSet = jest.fn<void, [unknown, WritePayload]>();
const mockBatchCommit = jest.fn(async () => undefined);
const mockUpdateDoc = jest.fn<Promise<void>, [unknown, WritePayload]>(
    async () => undefined,
);
const mockGetDocs = jest.fn<Promise<{ empty: boolean; docs: unknown[] }>, []>(
    async () => ({ empty: true, docs: [] }),
);

jest.mock("firebase/firestore", () => {
    const actual = jest.requireActual("firebase/firestore");
    return {
        ...actual,
        collection: jest.fn((_db: unknown, path: string) => ({ path })),
        doc: jest.fn((_db: unknown, path?: string, id?: string) => ({
            path,
            id: id ?? "generated-id",
        })),
        where: jest.fn((field: string, op: string, value: unknown) => ({
            kind: "where",
            field,
            op,
            value,
        })),
        orderBy: jest.fn((field: string, dir: string) => ({
            kind: "orderBy",
            field,
            dir,
        })),
        limit: jest.fn((n: number) => ({ kind: "limit", n })),
        query: jest.fn((_ref: unknown, ...constraints: unknown[]) => ({
            constraints,
        })),
        // Referenced lazily: a direct reference is evaluated while the consts
        // above are still in their temporal dead zone.
        getDocs: () => mockGetDocs(),
        getDoc: jest.fn(async () => ({ exists: () => false })),
        updateDoc: (ref: unknown, payload: WritePayload) =>
            mockUpdateDoc(ref, payload),
        writeBatch: jest.fn(() => ({
            set: mockBatchSet,
            update: mockBatchUpdate,
            commit: mockBatchCommit,
        })),
        runTransaction: jest.fn(),
        Timestamp: actual.Timestamp,
    };
});

import {
    createDefaultMetrics,
    createEvent,
    getActiveEvent,
    getDraftEvents,
    publishEvent,
    saveDraft,
    updateEventMetrics,
    extractMetricsWithHours,
    type Event,
} from "../event-service";
import { Timestamp } from "firebase/firestore";

const mutableAuth = auth as { currentUser: { uid: string } | null };

function signIn(uid = "user-1") {
    mutableAuth.currentUser = { uid };
}

beforeEach(() => {
    signIn();
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
});

afterEach(() => {
    mutableAuth.currentUser = null;
});

const BASE_INPUT = {
    title: "Cleanup",
    description: "Pick up litter",
    eventDate: new Date("2026-05-01T00:00:00Z"),
    trelloCardId: "card-1",
    albumId: "album-1",
    albumUrl: "https://photos.example/album-1",
    eventLeader: "Ada",
    zoneLeaders: "",
    toolHaulers: "",
    gloverLover: "",
    notes: "",
    isDraft: false,
};

describe("createEvent", () => {
    it("updates the album document instead of overwriting it", async () => {
        await createEvent(BASE_INPUT);

        // A set() here would erase title/titleLower/createdBy/createdAt that
        // album-service wrote, which is what broke duplicate detection.
        expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
        const [, payload] = mockBatchUpdate.mock.calls[0];
        expect(payload).toEqual({
            eventId: "generated-id",
            albumUrl: BASE_INPUT.albumUrl,
        });
        expect(payload).not.toHaveProperty("title");
        expect(payload).not.toHaveProperty("createdBy");
    });

    it("stamps ownership and leaves lifecycle fields unset", async () => {
        await createEvent(BASE_INPUT);
        const [, event] = mockBatchSet.mock.calls[0] as [unknown, Event];

        expect(event.createdBy).toBe("user-1");
        expect(event.startedBy).toBeNull();
        expect(event.startDate).toBeNull();
        expect(event.endDate).toBeNull();
        expect(event.isActive).toBe(false);
        // Written as null rather than omitted so orderBy cannot drop the doc.
        expect(event.savedAsDraftAt).toBeNull();
        expect(Object.keys(event.metrics ?? {})).toHaveLength(15);
    });

    it("refuses to write anything when signed out", async () => {
        mutableAuth.currentUser = null;
        await expect(createEvent(BASE_INPUT)).rejects.toThrow(/signed in/i);
        expect(mockBatchCommit).not.toHaveBeenCalled();
    });
});

describe("getActiveEvent", () => {
    it("scopes to the signed-in user and reads a single document", async () => {
        await getActiveEvent();
        const { constraints } = (
            jest.requireMock("firebase/firestore") as {
                query: jest.Mock;
            }
        ).query.mock.results[0].value;

        expect(constraints).toEqual([
            { kind: "where", field: "startedBy", op: "==", value: "user-1" },
            { kind: "where", field: "endDate", op: "==", value: null },
            { kind: "orderBy", field: "startDate", dir: "desc" },
            { kind: "limit", n: 1 },
        ]);
    });

    it("returns null when the user has no live event", async () => {
        await expect(getActiveEvent()).resolves.toBeNull();
    });
});

describe("getDraftEvents", () => {
    it("only returns drafts belonging to the signed-in user", async () => {
        await getDraftEvents();
        const { constraints } = (
            jest.requireMock("firebase/firestore") as { query: jest.Mock }
        ).query.mock.results[0].value;

        expect(constraints).toContainEqual({
            kind: "where",
            field: "startedBy",
            op: "==",
            value: "user-1",
        });
        expect(constraints).toContainEqual({
            kind: "where",
            field: "isDraft",
            op: "==",
            value: true,
        });
    });
});

describe("endDate is written exactly once", () => {
    it("saveDraft never touches endDate", async () => {
        await saveDraft("event-1", "some notes");
        const [, payload] = mockUpdateDoc.mock.calls[0];
        // Re-saving a draft used to push endDate to now, inflating
        // hoursOfService by however long the draft sat untouched.
        expect(payload).not.toHaveProperty("endDate");
        // main merged the old `notepad` field into `notes` (7260e85).
        expect(payload).toHaveProperty("notes", "some notes");
    });

    it("publishEvent never touches endDate", async () => {
        await publishEvent("event-1");
        const [, payload] = mockUpdateDoc.mock.calls[0];
        expect(payload).not.toHaveProperty("endDate");
        expect(payload).toHaveProperty("isDraft", false);
    });
});

describe("updateEventMetrics", () => {
    it("writes dotted metric paths", async () => {
        await updateEventMetrics("event-1", { trashBagsCollected: 4 });
        const [, payload] = mockUpdateDoc.mock.calls[0];
        expect(payload).toEqual({ "metrics.trashBagsCollected": 4 });
    });

    it("drops NaN and skips the write when nothing valid remains", async () => {
        await updateEventMetrics("event-1", { treesTrimmed: Number.NaN });
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
});

describe("extractMetricsWithHours", () => {
    const base = {
        startDate: Timestamp.fromMillis(0),
        endDate: Timestamp.fromMillis(3_600_000 * 2),
        metrics: createDefaultMetrics(),
    } as unknown as Event;

    it("derives hours from the event span", () => {
        expect(extractMetricsWithHours(base).hoursOfService).toBe(2);
    });

    it("is zero for an event that never started", () => {
        expect(
            extractMetricsWithHours({ ...base, startDate: null } as Event)
                .hoursOfService,
        ).toBe(0);
    });

    it("fills defaults for an event with no metrics recorded", () => {
        const result = extractMetricsWithHours({
            ...base,
            metrics: undefined,
        } as Event);
        expect(result.trashBagsCollected).toBe(0);
    });
});
