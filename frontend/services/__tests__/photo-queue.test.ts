import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadPhotos } from "@/api/backend-client";

jest.mock("@/api/backend-client", () => ({
    uploadPhotos: jest.fn(),
}));

const mockUpload = uploadPhotos as jest.MockedFunction<typeof uploadPhotos>;

const BASE = {
    eventId: "event-1",
    albumId: "album-1",
    issueId: "issue-1",
    issueName: "Fallen tree",
};

type PhotoQueueModule = typeof import("../photo-queue");

// The module caches the queue in memory, so each test needs a fresh copy.
function loadModule(): PhotoQueueModule {
    let mod!: PhotoQueueModule;
    jest.isolateModules(() => {
        mod = require("../photo-queue") as PhotoQueueModule;
    });
    return mod;
}

async function freshModule(): Promise<PhotoQueueModule> {
    (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
    return loadModule();
}

beforeEach(() => {
    mockUpload.mockResolvedValue({ created: 1, failed: [] });
});

describe("enqueuePhoto", () => {
    it("persists a captured photo as pending", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });

        const photos = await queue.getPhotosForEvent("event-1");
        expect(photos).toHaveLength(1);
        expect(photos[0]).toMatchObject({ slot: "before", status: "pending" });
    });

    it("replaces rather than accumulates when a photo is retaken", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///1.jpg" });
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///2.jpg" });

        const photos = await queue.getPhotosForEvent("event-1");
        expect(photos).toHaveLength(1);
        expect(photos[0].uri).toBe("file:///2.jpg");
    });

    it("keeps before and after as separate slots", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        await queue.enqueuePhoto({ ...BASE, slot: "after", uri: "file:///a.jpg" });

        const byIssue = await queue.getIssuePhotos("event-1");
        expect(byIssue["issue-1"].before?.uri).toBe("file:///b.jpg");
        expect(byIssue["issue-1"].after?.uri).toBe("file:///a.jpg");
    });

    it("survives a reload, which component state never did", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });

        const reloaded = loadModule();
        expect(await reloaded.getPhotosForEvent("event-1")).toHaveLength(1);
    });

    it("keeps events separate", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        await queue.enqueuePhoto({
            ...BASE,
            eventId: "event-2",
            slot: "before",
            uri: "file:///c.jpg",
        });
        expect(await queue.getPhotosForEvent("event-1")).toHaveLength(1);
        expect(await queue.getPhotosForEvent("event-2")).toHaveLength(1);
    });
});

describe("flushEventPhotos", () => {
    it("uploads pending photos and marks them uploaded", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });

        await expect(queue.flushEventPhotos("event-1")).resolves.toEqual({
            uploaded: 1,
            failed: 0,
        });
        expect((await queue.getPhotosForEvent("event-1"))[0].status).toBe(
            "uploaded",
        );
    });

    it("groups an album's photos into a single request", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        await queue.enqueuePhoto({ ...BASE, slot: "after", uri: "file:///a.jpg" });

        await queue.flushEventPhotos("event-1");
        expect(mockUpload).toHaveBeenCalledTimes(1);
        expect(mockUpload.mock.calls[0][1]).toHaveLength(2);
    });

    it("leaves a photo queued when the upload throws", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        mockUpload.mockRejectedValue(new Error("offline"));

        await expect(queue.flushEventPhotos("event-1")).resolves.toEqual({
            uploaded: 0,
            failed: 1,
        });
        const photo = (await queue.getPhotosForEvent("event-1"))[0];
        expect(photo.status).toBe("failed");
        expect(photo.error).toBe("offline");
    });

    it("a failed photo can be retried and succeed", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        mockUpload.mockRejectedValueOnce(new Error("offline"));
        await queue.flushEventPhotos("event-1");

        mockUpload.mockResolvedValue({ created: 1, failed: [] });
        await expect(queue.flushEventPhotos("event-1")).resolves.toEqual({
            uploaded: 1,
            failed: 0,
        });
    });

    it("skips photos that already uploaded", async () => {
        const queue = await freshModule();
        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        await queue.flushEventPhotos("event-1");
        mockUpload.mockClear();

        await queue.flushEventPhotos("event-1");
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("does nothing when there is nothing pending", async () => {
        const queue = await freshModule();
        await expect(queue.flushEventPhotos("event-1")).resolves.toEqual({
            uploaded: 0,
            failed: 0,
        });
        expect(mockUpload).not.toHaveBeenCalled();
    });
});

describe("subscribers", () => {
    it("are notified when a photo is queued", async () => {
        const queue = await freshModule();
        const listener = jest.fn();
        const unsubscribe = queue.subscribeToPhotoQueue(listener);

        await queue.enqueuePhoto({ ...BASE, slot: "before", uri: "file:///b.jpg" });
        expect(listener).toHaveBeenCalled();

        unsubscribe();
        listener.mockClear();
        await queue.enqueuePhoto({ ...BASE, slot: "after", uri: "file:///a.jpg" });
        expect(listener).not.toHaveBeenCalled();
    });
});
