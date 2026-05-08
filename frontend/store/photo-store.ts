type PhotoSlot = "before" | "after";

// Pending photo from camera → trail-issue-screen
let pendingPhoto: { slot: PhotoSlot; uri: string } | null = null;

export function setPendingPhoto(slot: PhotoSlot, uri: string) {
    pendingPhoto = { slot, uri };
}

export function consumePendingPhoto(): { slot: PhotoSlot; uri: string } | null {
    const p = pendingPhoto;
    pendingPhoto = null;
    return p;
}

// Accumulated photo URI updates keyed by issue ID → trail-document-screen
type IssueImageUpdate = { issueId: string; slot: PhotoSlot; uri: string };
const issueImageUpdates: IssueImageUpdate[] = [];

export function setIssueImage(issueId: string, slot: PhotoSlot, uri: string) {
    const idx = issueImageUpdates.findIndex(
        (u) => u.issueId === issueId && u.slot === slot,
    );
    if (idx >= 0) issueImageUpdates.splice(idx, 1);
    issueImageUpdates.push({ issueId, slot, uri });
}

export function consumeIssueImageUpdates(): IssueImageUpdate[] {
    return issueImageUpdates.splice(0);
}
