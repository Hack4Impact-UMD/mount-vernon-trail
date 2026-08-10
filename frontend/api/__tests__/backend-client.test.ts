import { auth } from "@/config/firebase";
import {
    BackendError,
    createAlbum,
    listAlbumsPage,
    listAllAlbums,
    uploadPhotos,
} from "../backend-client";

const mutableAuth = auth as {
    currentUser: { getIdToken: jest.Mock } | null;
};

const getIdToken = jest.fn();
const fetchMock = jest.fn();

function json(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

beforeEach(() => {
    process.env.EXPO_PUBLIC_BACKEND_URL = "https://api.example";
    getIdToken.mockResolvedValue("id-token");
    mutableAuth.currentUser = { getIdToken };
    global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
    mutableAuth.currentUser = null;
});

describe("configuration and sign-in guards", () => {
    it("fails with an actionable message when the backend URL is unset", async () => {
        process.env.EXPO_PUBLIC_BACKEND_URL = "";
        await expect(createAlbum("Cleanup")).rejects.toMatchObject({
            code: "NOT_CONFIGURED",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fails when nobody is signed in", async () => {
        mutableAuth.currentUser = null;
        await expect(createAlbum("Cleanup")).rejects.toMatchObject({
            code: "NOT_SIGNED_IN",
        });
    });

    it("trims a trailing slash off the backend URL", async () => {
        process.env.EXPO_PUBLIC_BACKEND_URL = "https://api.example/";
        fetchMock.mockResolvedValue(json({ id: "a1", title: "Cleanup" }, 201));
        await createAlbum("Cleanup");
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.example/api/albums");
    });
});

describe("authorization", () => {
    it("attaches the Firebase ID token", async () => {
        fetchMock.mockResolvedValue(json({ id: "a1", title: "Cleanup" }, 201));
        await createAlbum("Cleanup");

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(
            (init.headers as Record<string, string>).Authorization,
        ).toBe("Bearer id-token");
    });

    it("retries once with a force-refreshed token on 401", async () => {
        getIdToken
            .mockResolvedValueOnce("stale-token")
            .mockResolvedValueOnce("fresh-token");
        fetchMock
            .mockResolvedValueOnce(json({ error: "expired" }, 401))
            .mockResolvedValueOnce(json({ id: "a1", title: "Cleanup" }, 201));

        await expect(createAlbum("Cleanup")).resolves.toEqual({
            id: "a1",
            title: "Cleanup",
        });

        expect(getIdToken).toHaveBeenNthCalledWith(1, false);
        expect(getIdToken).toHaveBeenNthCalledWith(2, true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("gives up after exactly one retry", async () => {
        fetchMock.mockResolvedValue(json({ error: "nope" }, 401));
        await expect(createAlbum("Cleanup")).rejects.toMatchObject({
            code: "UNAUTHORIZED",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe("error mapping", () => {
    it.each([
        [403, "FORBIDDEN"],
        [404, "NOT_FOUND"],
        [502, "UPSTREAM"],
        [500, "UNKNOWN"],
    ])("maps HTTP %i to %s", async (status, code) => {
        fetchMock.mockResolvedValue(json({ error: "bad" }, status));
        await expect(createAlbum("Cleanup")).rejects.toMatchObject({ code });
    });

    it("reports a network failure rather than leaking the raw error", async () => {
        fetchMock.mockRejectedValue(new TypeError("Network request failed"));
        const error = await createAlbum("Cleanup").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(BackendError);
        expect((error as BackendError).code).toBe("NETWORK");
    });
});

describe("pagination", () => {
    it("defaults albums to an empty array when the payload omits it", async () => {
        fetchMock.mockResolvedValue(json({}));
        await expect(listAlbumsPage()).resolves.toEqual({
            albums: [],
            nextPageToken: undefined,
        });
    });

    it("follows nextPageToken until exhausted", async () => {
        fetchMock
            .mockResolvedValueOnce(
                json({ albums: [{ id: "a1", title: "One" }], nextPageToken: "t2" }),
            )
            .mockResolvedValueOnce(json({ albums: [{ id: "a2", title: "Two" }] }));

        await expect(listAllAlbums()).resolves.toHaveLength(2);
        expect(fetchMock.mock.calls[1][0]).toContain("pageToken=t2");
    });
});

describe("uploadPhotos", () => {
    it("short-circuits with no photos", async () => {
        await expect(uploadPhotos("album-1", [])).resolves.toEqual({
            created: 0,
            failed: [],
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("treats a 207 partial success as a result, not an error", async () => {
        fetchMock.mockResolvedValue(
            json(
                {
                    newMediaItemResults: [{}],
                    failed: [{ fileName: "after.jpg", error: "boom" }],
                },
                207,
            ),
        );

        await expect(
            uploadPhotos("album-1", [
                { uri: "file:///a.jpg", fileName: "a.jpg", mimeType: "image/jpeg" },
            ]),
        ).resolves.toEqual({
            created: 1,
            failed: [{ fileName: "after.jpg", error: "boom" }],
        });
    });

    it("rebuilds the body on the 401 retry so it is not a consumed stream", async () => {
        fetchMock
            .mockResolvedValueOnce(json({ error: "expired" }, 401))
            .mockResolvedValueOnce(json({ newMediaItemResults: [{}] }, 201));

        await uploadPhotos("album-1", [
            { uri: "file:///a.jpg", fileName: "a.jpg", mimeType: "image/jpeg" },
        ]);

        const firstBody = (fetchMock.mock.calls[0][1] as RequestInit).body;
        const secondBody = (fetchMock.mock.calls[1][1] as RequestInit).body;
        expect(firstBody).toBeDefined();
        expect(secondBody).toBeDefined();
        expect(firstBody).not.toBe(secondBody);
    });
});
