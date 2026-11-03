import { getIssueSheetTarget } from "../issue-sheet";

it.each([
    [40, 0, "expanded"],
    [280, 0, "compact"],
    [420, 0, "dismissed"],
    [290, 1.2, "dismissed"],
    [20, 1.2, "expanded"],
    [180, -0.7, "expanded"],
    [180, 0.7, "compact"],
])("snaps offset %s at velocity %s to %s", (offset, velocity, expected) => {
    expect(getIssueSheetTarget(offset as number, velocity as number, 300)).toBe(
        expected,
    );
});
