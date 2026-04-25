export type TrailIssue = {
    id: string;
    name: string;
    date: Date;
    imageUrl: string | null;
    beforeImageUri?: string | null;
    afterImageUri?: string | null;
};

export type StatsData = {
    trailImprovements: number;
    drainage: number;
    graffiti: number;
    stickers: number;
    otherImprovements: number;
    painting: number;
    pressureWashing: number;
    repairs: number;
    safetyImprovements: number;
    potholes: number;
    trash: number;
    trees: number;
    vegetationImprovements: number;
    hoursOfService: number;
};

export type TrailDocumentScreenProps = {
    eventCardID: string;
};

export interface TrailDocumentIssueItem {
    id: string;
    name: string;
    imageUrl: string | null;
    creationDate: Date;
}
