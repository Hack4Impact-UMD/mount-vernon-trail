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
} from "firebase/firestore";

export interface Event {
    eventId: string;
    title: string;
    description: string;
    date: Timestamp;
    trelloCardId: string;
    albumId: string;
    albumUrl: string;
    isActive: boolean; // deprecated: use startDate && !endDate
    startDate: Timestamp | null;
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

    const eventRef = doc(collection(db, EVENTS_COLLECTION));
    const eventData: Event = {
        eventId: eventRef.id,
        title,
        description,
        date: Timestamp.fromDate(eventDate),
        trelloCardId,
        albumId,
        albumUrl,
        isActive: false,
        startDate: null,
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

// start event by setting startDate to current timestamp
export async function startEvent(trelloCardId: string): Promise<void> {
    const db = getFirestore();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error(
            "User is not authenticated. Please sign in to start an event.",
        );
    }

    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("trelloCardId", "==", trelloCardId),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error(`No event found for trello card: ${trelloCardId}`);
    }

    const eventDoc = snapshot.docs[0];
    const eventData = eventDoc.data() as Event;

    if (eventData.startDate) {
        throw new Error("This event has already been started.");
    }

    await updateDoc(eventDoc.ref, {
        startDate: Timestamp.now(),
    });
}

// get the currently active event (startDate && !endDate)
export async function getActiveEvent(): Promise<Event | null> {
    const db = getFirestore();
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("startDate", "!=", null),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const activeDoc = snapshot.docs.find((doc) => {
        const data = doc.data();
        return data.endDate === null || data.endDate === undefined;
    });

    if (!activeDoc) return null;
    return activeDoc.data() as Event;
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