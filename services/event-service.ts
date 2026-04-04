import { auth } from "@/config/firebase";
import {
    collection,
    doc,
    getDocs,
    getFirestore,
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
    startDate?: Timestamp;
    endDate: Timestamp | null;
    createdAt: Timestamp;
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
        startDate: Timestamp.now(),
        endDate: null,
        createdAt: Timestamp.now(),
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

export async function setEventInactive(eventId: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isActive: false,
        endDate: Timestamp.now(),
    });
}
