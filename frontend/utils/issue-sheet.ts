/** The sheet has two resting positions; dragging below compact can dismiss it. */
export function getIssueSheetTarget(
    offset: number,
    velocity: number,
    compactOffset: number,
): "expanded" | "compact" | "dismissed" {
    if (
        offset > compactOffset + 80 ||
        (offset >= compactOffset - 12 && velocity > 1)
    ) {
        return "dismissed";
    }
    return offset + velocity * 100 < compactOffset / 2 ? "expanded" : "compact";
}
