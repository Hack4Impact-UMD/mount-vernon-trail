import { readFileSync } from "fs";
import { resolve } from "path";
import { albumTitleKey, normalizeAlbumTitle } from "../album-title-key";

// The backfill re-implements the frontend's album-title key derivation. If the
// two ever diverge, the migration writes reservation documents at keys the app
// never reads, and duplicate album names silently become possible again.
// frontend/services/__tests__/album-service.test.ts asserts the same file.

type Vectors = { vectors: { title: string; key: string }[] };

const { vectors } = JSON.parse(
    readFileSync(
        resolve(__dirname, "../../../album-title-test-vectors.json"),
        "utf8",
    ),
) as Vectors;

describe("album title key parity with the frontend", () => {
    it("has vectors to check", () => {
        expect(vectors.length).toBeGreaterThan(10);
    });

    it.each(vectors)("$title -> $key", ({ title, key }) => {
        expect(albumTitleKey(title)).toBe(key);
    });

    it("normalizes case and whitespace the same way", () => {
        expect(normalizeAlbumTitle("  Spring   CLEANUP  ")).toBe("spring cleanup");
    });
});

describe("generated keys are always legal Firestore document ids", () => {
    it.each(vectors)("$title", ({ title }) => {
        const id = albumTitleKey(title);
        expect(id.length).toBeGreaterThan(0);
        expect(Buffer.byteLength(id, "utf8")).toBeLessThanOrEqual(1500);
        expect(id).not.toBe(".");
        expect(id).not.toBe("..");
        expect(id).not.toMatch(/^__.*__$/);
        expect(id).not.toContain("/");
    });
});
