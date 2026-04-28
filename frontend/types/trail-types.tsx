export type TrailIssue = {
    id: string;
    name: string;
    date: Date;
    imageUrl: string | null;
    beforeImageUri?: string | null;
    afterImageUri?: string | null;
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
