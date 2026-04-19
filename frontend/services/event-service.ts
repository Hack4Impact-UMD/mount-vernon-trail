import { auth } from "@/config/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
    orderBy,
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
    savedAsDraftAt?: Timestamp;
    endDate: Timestamp | null;
    createdAt: Timestamp;
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

// Save a completed event as a draft instead of immediately publishing
export async function saveDraft(eventId: string, notepad?: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isDraft: true,
        isActive: false,
        endDate: Timestamp.now(),
        savedAsDraftAt: Timestamp.now(),
        ...(notepad !== undefined ? { notepad } : {}),
    });
}

// Mark a draft as published (call this after the Trello publish succeeds)
export async function publishEvent(eventId: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isDraft: false,
        isActive: false,
        endDate: Timestamp.now(),
        publishedAt: Timestamp.now(),
    });
}

// Fetch all drafts, newest first
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
