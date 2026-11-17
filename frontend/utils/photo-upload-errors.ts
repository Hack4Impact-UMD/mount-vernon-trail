// Older proxies put Google's success message in failed[]. This is not proof
// of either failure or success: require confirmation instead of resending.
export const UNCONFIRMED_UPLOAD =
    "The server returned conflicting upload results. Your photo may already be in the album.";

export function isConflictingUploadMessage(message?: string): boolean {
    return /^(success|ok)[.!]?$/i.test(message?.trim() ?? "");
}
