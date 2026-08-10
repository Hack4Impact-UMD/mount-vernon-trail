// Mirror of normalizeAlbumTitle/albumTitleKey in
// frontend/services/album-service.ts. The backfill migration uses these to
// create reservation documents for pre-existing albums; if the two
// implementations diverge, the migration writes them at keys the app never
// reads and duplicate album names silently become possible again.
//
// Both sides are pinned to album-title-test-vectors.json at the repo root.

export function normalizeAlbumTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Deterministic and always a legal Firestore document id: encodeURIComponent
// escapes "/", the "." replacement avoids the reserved "." and ".." ids, and
// the "t_" prefix avoids the reserved __*__ pattern.
export function albumTitleKey(title: string): string {
    return `t_${encodeURIComponent(normalizeAlbumTitle(title)).replace(/\./g, "%2E")}`;
}
