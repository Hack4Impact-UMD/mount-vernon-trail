export type TrailIssue = {
    id: string;
    name: string;
    date: Date;
    imageUrl: string | null;
    beforeImageUri?: string | null;
    afterImageUri?: string | null;
};

export type TrailIssueItem = {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
};

export type TrailDocumentIssueItem = {
    id: string;
    name: string;
    imageUrl: string | null;
    creationDate: Date;
};
