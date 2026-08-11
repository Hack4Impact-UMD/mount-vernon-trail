import { readFileSync } from "fs";
import { resolve } from "path";
import { albumTitleKey, normalizeAlbumTitle } from "../album-service";

jest.mock("firebase/firestore", () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    runTransaction: jest.fn(),
    writeBatch: jest.fn(),
    Timestamp: { now: () => ({ toMillis: () => 0 }) },
}));

describe("normalizeAlbumTitle", () => {
    it("collapses case, surrounding space, and internal runs", () => {
        expect(normalizeAlbumTitle("  Spring   CLEANUP  ")).toBe("spring cleanup");
    });

    it("treats case variants as the same title", () => {
        // The original bug: albumNameExists queried a lowercased title while
        // createEvent overwrote it with the original case, so any title with a
        // capital letter stopped being detected as a duplicate.
        expect(normalizeAlbumTitle("Spring Cleanup")).toBe(
            normalizeAlbumTitle("spring cleanup"),
        );
    });
});

describe("albumTitleKey", () => {
    it("is stable across case and spacing variants", () => {
        expect(albumTitleKey("Spring  Cleanup")).toBe(albumTitleKey("spring cleanup"));
    });

    it("produces a legal Firestore id for a title containing a slash", () => {
        const key = albumTitleKey("Zone A/B cleanup");
        expect(key).not.toContain("/");
        expect(key.startsWith("t_")).toBe(true);
    });

    it("escapes dots so the id is never '.' or '..'", () => {
        expect(albumTitleKey("..")).not.toContain(".");
    });

    it("avoids the reserved __*__ id pattern", () => {
        expect(albumTitleKey("__proto__").startsWith("t_")).toBe(true);
    });

    it("distinguishes genuinely different titles", () => {
        expect(albumTitleKey("Cleanup A")).not.toBe(albumTitleKey("Cleanup B"));
    });
});

// backend/scripts/backfill-firestore.ts re-implements this function to create
// reservation documents for pre-existing albums. Both sides assert the same
// vectors, so a divergence fails CI rather than silently re-opening the
// duplicate-album-name hole.
describe("shared key vectors (contract with the backfill migration)", () => {
    type Vectors = { vectors: { title: string; key: string }[] };
    const { vectors } = JSON.parse(
        readFileSync(
            resolve(__dirname, "../../../album-title-test-vectors.json"),
            "utf8",
        ),
    ) as Vectors;

    it("has vectors to check", () => {
        expect(vectors.length).toBeGreaterThan(10);
    });

    it.each(vectors)("$title -> $key", ({ title, key }) => {
        expect(albumTitleKey(title)).toBe(key);
    });
});
