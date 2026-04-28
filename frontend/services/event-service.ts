import { auth } from "@/config/firebase";
import type { StatsData } from "@/types/trail-types";
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
    startDate: Timestamp | null;
    isActive: boolean;
    isDraft: boolean;
    savedAsDraftAt?: Timestamp;
    endDate: Timestamp | null;
    createdAt: Timestamp;
    eventLeader: string;
    zoneLeaders: string;
    toolHaulers: string;
    gloverLover: string;
    notes: string;
    trailImprovements: number;
    drainage?: number;
	graffiti?: number;
	stickers?: number;
	otherImprovements?: number;
	painting?: number;
	pressureWashing?: number;
	repairs?: number;
	safetyImprovements?: number;
	potholes?: number;
	trash?: number;
	trees?: number;
	vegetationImprovements?: number;

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
    eventLeader: string,
    zoneLeaders: string,
    toolHaulers: string,
    gloverLover: string,
    notes: string,
    isDraft: boolean,
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
        isDraft,
        startDate: null,
        endDate: null,
        createdAt: Timestamp.now(),
        trailImprovements: 0,
        eventLeader,
        zoneLeaders,
        toolHaulers,
        gloverLover,
        notes,
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

export async function getEventByTrelloCardId(
    trelloCardId: string,
): Promise<Event | null> {
    const db = getFirestore();
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("trelloCardId", "==", trelloCardId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Event;
}

export async function setEventInactive(eventId: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isActive: false,
        endDate: Timestamp.now(),
    });
}

// Save a completed event as a draft instead of immediately publishing
export async function saveDraft(
    eventId: string,
    notepad?: string,
): Promise<void> {
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

export async function updateEventStats(
    eventId: string,
    stats: Partial<StatsData>,
): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        ...stats,
    });
}

export function extractStats(event: Event): StatsData {;
    return {
        trailImprovements: event.trailImprovements,
        drainage: event.drainage ?? 0,
        graffiti: event.graffiti ?? 0,
        stickers: event.stickers ?? 0,
        otherImprovements: event.otherImprovements ?? 0,
        painting: event.painting ?? 0,
        pressureWashing: event.pressureWashing ?? 0,
        repairs: event.repairs ?? 0,
        safetyImprovements: event.safetyImprovements ?? 0,
        potholes: event.potholes ?? 0,
        trash: event.trash ?? 0,
        trees: event.trees ?? 0,
        vegetationImprovements: event.vegetationImprovements ?? 0,
        hoursOfService: (() => {
            if (!event.startDate) return 0;
            const end = event.endDate ? event.endDate.toMillis() : Date.now();
            return parseFloat(
                (
                    Math.max(0, end - event.startDate.toMillis()) / 3_600_000
                ).toFixed(1),
            );
        })(),
    };
}
