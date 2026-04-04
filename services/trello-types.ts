export interface Board {
    id: string;
    name: string;
    desc: string;
}

export interface List {
    id: string;
    name: string;
    idBoard: string;
}

export interface Card {
    id: string;
    name: string;
    desc: string;
    idList: string;
    idBoard: string;
    shortUrl: string;
    creationDate: Date;
    attachments?: TrelloAttachment[];
}

export interface TrelloAttachment {
    url: string;
}

export interface EventCard extends Card {
    eventDate: Date;
}
