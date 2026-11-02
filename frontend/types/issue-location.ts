/** Explicitly named coordinates to avoid swapping latitude/longitude. */
export type IssueLocation = {
    locationName: string;
    latitude: number;
    longitude: number;
    //Keeps track of whether the location was fetched from title, photo metadata, or manually inputted
    source: "title" | "photo" | "manual";
};
