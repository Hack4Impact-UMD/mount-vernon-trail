import type { Timestamp } from "firebase/firestore";

export const ISSUE_LOCATIONS_COLLECTION = "issueLocations";

/** Explicitly named coordinates to avoid swapping latitude/longitude. */
export type IssueLocation = {
    locationName: string;
    latitude: number;
    longitude: number;
    //Keeps track of whether the location was fetched from title, photo metadata, or manually inputted
    source: "title" | "photo" | "manual";
};

/** Links to Firestore issueLocations/{trelloCardId} */
export type IssueLocationRecord = {
    trelloCardId: string;
    /** Null means the issue has not yet been located; never use dummy coordinates. */
    location: IssueLocation | null;
    updatedAt: Timestamp;
};
