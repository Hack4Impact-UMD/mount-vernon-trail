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
}
