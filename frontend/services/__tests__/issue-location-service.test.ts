import { doc, getDoc } from "firebase/firestore";
import { requireUser } from "../require-user";
import { resolveFirestoreIssueLocation } from "../issue-location-service";
import type { Card } from "../trello-types";

jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("../require-user", () => ({ requireUser: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), getDoc: jest.fn() }));

const card = { id: "intake-card", name: "Issue" } as Card;
beforeEach(() => jest.resetAllMocks());

it("looks up the issue ID and converts separate numbers to longitude-first coordinates", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
        data: () => ({
            location: {
                latitude: 38.865,
                longitude: -77.051,
                locationName: "Test site",
            },
        }),
    });
    expect(await resolveFirestoreIssueLocation(card)).toEqual({
        coordinates: [-77.051, 38.865],
        locationName: "Test site",
        eventNames: [],
    });
    expect(doc).toHaveBeenCalledWith({}, "issueLocations", "intake-card");
});

it.each([
    undefined,
    { location: null },
    { location: { latitude: "38", longitude: -77, locationName: "Site" } },
    { location: { latitude: 91, longitude: -77, locationName: "Site" } },
    { location: { latitude: 38, longitude: Infinity, locationName: "Site" } },
])("does not invent a pin for missing or invalid data: %j", async (data) => {
    (getDoc as jest.Mock).mockResolvedValue({ data: () => data });
    expect(await resolveFirestoreIssueLocation(card)).toBeNull();
});

it("requires sign-in before reading Firestore", async () => {
    (requireUser as jest.Mock).mockImplementation(() => {
        throw new Error("Sign in required");
    });
    await expect(resolveFirestoreIssueLocation(card)).rejects.toThrow(
        "Sign in required",
    );
    expect(getDoc).not.toHaveBeenCalled();
});
