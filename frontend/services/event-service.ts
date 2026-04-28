import { auth } from "@/config/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";

export interface Event {
    eventId: string;
    title: string;
    description: string;
    date: Timestamp;
    trelloCardId: string;
    albumId: string;
    albumUrl: string;
    isActive: boolean;
    isDraft: boolean;
    startDate?: Timestamp;
    endDate: Timestamp | null;
    createdAt: Timestamp;
    savedAsDraftAt?: Timestamp;
    publishedAt?: Timestamp;
    notepad?: string;
    metrics?: Record<string, number>;
    trailImprovements: number;
    trashBags: number;
}

const EVENTS_COLLECTION = "events";
const ALBUMS_COLLECTION = "albums";

// creates a new event and adds album doc to albums collection
export async function createEvent(
    title: string,
    description: string,
    eventDate: Date,
    trelloCardId: string,
    albumId: string,
    albumUrl: string,
): Promise<string> {
    const db = getFirestore();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error(
            "User is not authenticated. Please sign in to create an event.",
        );
    }

    const existing = await getDocs(
        query(collection(db, EVENTS_COLLECTION), where("isActive", "==", true)),
    );
    if (!existing.empty) {
        throw new Error(
            "An event is already active. End it before creating a new one.",
        );
    }

    const eventRef = doc(collection(db, EVENTS_COLLECTION));
    const eventData: Event = {
        eventId: eventRef.id,
        title,
        description,
        date: Timestamp.fromDate(eventDate),
        trelloCardId,
        albumId,
        albumUrl,
        isActive: true,
        isDraft: false,
        startDate: Timestamp.now(),
        endDate: null,
        createdAt: Timestamp.now(),
        notepad: "",
        metrics: {},
        trailImprovements: 0,
        trashBags: 0,
    };

    const batch = writeBatch(db);
    batch.set(eventRef, eventData);
    batch.set(doc(db, ALBUMS_COLLECTION, albumId), {
        albumId,
        title,
        albumUrl,
        eventId: eventRef.id,
        createdAt: Timestamp.now(),
    });
    await batch.commit();

    return eventRef.id;
}

// get the currently active event
export async function getActiveEvent(): Promise<Event | null> {
    const db = getFirestore();

    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("isActive", "==", true),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0].data() as Event;
}

export async function getEventById(eventId: string): Promise<Event | null> {
    const db = getFirestore();
    const snapshot = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
    if (!snapshot.exists()) return null;
    return snapshot.data() as Event;
}

export async function setEventInactive(eventId: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isActive: false,
        endDate: Timestamp.now(),
    });
}

type DraftPayload = {
    metrics?: Record<string, number>;
    notepad?: string;
};

// Mark an ended event as a draft and (optionally) persist its metrics/notepad.
export async function saveDraft(
    eventId: string,
    payload: DraftPayload = {},
): Promise<void> {
    const db = getFirestore();
    const update: Record<string, unknown> = {
        isDraft: true,
        isActive: false,
        savedAsDraftAt: Timestamp.now(),
    };
    if (payload.metrics !== undefined) update.metrics = payload.metrics;
    if (payload.notepad !== undefined) update.notepad = payload.notepad;
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), update);
}

// Persist the final state of an event and mark it published (call after Trello publish succeeds).
export async function publishEvent(
    eventId: string,
    payload: DraftPayload = {},
): Promise<void> {
    const db = getFirestore();
    const update: Record<string, unknown> = {
        isDraft: false,
        isActive: false,
        publishedAt: Timestamp.now(),
    };
    if (payload.metrics !== undefined) update.metrics = payload.metrics;
    if (payload.notepad !== undefined) update.notepad = payload.notepad;
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), update);
}

// Fetch all drafts, newest first.
export async function getDraftEvents(): Promise<Event[]> {
    const db = getFirestore();
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("isDraft", "==", true),
        orderBy("savedAsDraftAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Event);
}
