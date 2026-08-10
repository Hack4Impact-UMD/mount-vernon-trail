import { db } from "@/config/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { ALBUMS_COLLECTION } from "./album-service";
import { requireUser } from "./require-user";

// Per-event metrics collected during a trail event. Every key here must have a
// matching input in components/ui/trail-metrics-section.tsx — a test asserts it.
export type EventMetrics = {
    drainageCleaned: number;
    graffitiTagsRemoved: number;
    stickersRemoved: number;
    otherImprovements: number;
    itemsPainted: number;
    pressureWashed: number;
    itemsRepaired: number;
    safetyImprovements: number;
    snowRemovalEvents: number;
    potholesFilled: number;
    trailEdgedFeet: number;
    trashBagsCollected: number;
    trashPoundsCollected: number;
    treesTrimmed: number;
    vegetationVolunteers: number;
};

export type EventMetricsWithHours = EventMetrics & { hoursOfService: number };

export function createDefaultMetrics(): EventMetrics {
    return {
        drainageCleaned: 0,
        graffitiTagsRemoved: 0,
        stickersRemoved: 0,
        otherImprovements: 0,
        itemsPainted: 0,
        pressureWashed: 0,
        itemsRepaired: 0,
        safetyImprovements: 0,
        snowRemovalEvents: 0,
        potholesFilled: 0,
        trailEdgedFeet: 0,
        trashBagsCollected: 0,
        trashPoundsCollected: 0,
        treesTrimmed: 0,
        vegetationVolunteers: 0,
    };
}

export type Event = {
    eventId: string;
    title: string;
    description: string;
    date: Timestamp;
    trelloCardId: string;
    albumId: string;
    albumUrl: string;
    // Who set the event up (an admin) vs who is running it (any volunteer).
    // Separate people, so ownership needs two fields.
    createdBy: string;
    startedBy: string | null;
    startDate: Timestamp | null;
    isActive: boolean;
    isDraft: boolean;
    savedAsDraftAt: Timestamp | null;
    endDate: Timestamp | null;
    createdAt: Timestamp;
    eventLeader: string;
    zoneLeaders: string;
    toolHaulers: string;
    gloverLover: string;
    notes: string;
    notepad?: string;
    publishedAt?: Timestamp;
    metrics?: EventMetrics;
};

export type CreateEventInput = {
    title: string;
    description: string;
    eventDate: Date;
    trelloCardId: string;
    albumId: string;
    albumUrl: string;
    eventLeader: string;
    zoneLeaders: string;
    toolHaulers: string;
    gloverLover: string;
    notes: string;
    isDraft: boolean;
};

const EVENTS_COLLECTION = "events";

export async function createEvent(input: CreateEventInput): Promise<string> {
    const currentUser = requireUser("create an event");

    const eventRef = doc(collection(db, EVENTS_COLLECTION));
    const eventData: Event = {
        eventId: eventRef.id,
        title: input.title,
        description: input.description,
        date: Timestamp.fromDate(input.eventDate),
        trelloCardId: input.trelloCardId,
        albumId: input.albumId,
        albumUrl: input.albumUrl,
        createdBy: currentUser.uid,
        startedBy: null,
        isActive: false,
        isDraft: input.isDraft,
        startDate: null,
        endDate: null,
        // Written as null rather than omitted so orderBy("savedAsDraftAt")
        // cannot silently drop the document.
        savedAsDraftAt: null,
        createdAt: Timestamp.now(),
        eventLeader: input.eventLeader,
        zoneLeaders: input.zoneLeaders,
        toolHaulers: input.toolHaulers,
        gloverLover: input.gloverLover,
        notes: input.notes,
        metrics: createDefaultMetrics(),
    };

    const batch = writeBatch(db);
    batch.set(eventRef, eventData);
    // update, not set: the album document already carries title/titleLower/
    // createdBy/createdAt from album-service, and a set would erase them.
    batch.update(doc(db, ALBUMS_COLLECTION, input.albumId), {
        eventId: eventRef.id,
        albumUrl: input.albumUrl,
    });
    await batch.commit();

    return eventRef.id;
}

export async function startEvent(trelloCardId: string): Promise<void> {
    const currentUser = requireUser("start an event");

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
        startedBy: currentUser.uid,
        isActive: true,
    });
}

// The event this user is currently running. Scoped to startedBy so one
// volunteer's live event never redirects — or gets ended by — anyone else.
export async function getActiveEvent(): Promise<Event | null> {
    const currentUser = requireUser("view the active event");
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("startedBy", "==", currentUser.uid),
        where("endDate", "==", null),
        orderBy("startDate", "desc"),
        limit(1),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Event;
}

export async function getEventById(eventId: string): Promise<Event | null> {
    requireUser("view an event");
    const snapshot = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
    if (!snapshot.exists()) return null;
    return snapshot.data() as Event;
}

export async function getEventByTrelloCardId(
    trelloCardId: string,
): Promise<Event | null> {
    requireUser("view an event");
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("trelloCardId", "==", trelloCardId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Event;
}

// Only changed numeric fields are written, via dotted metrics.* paths.
export async function updateEventMetrics(
    eventId: string,
    updates: Partial<EventMetrics>,
): Promise<void> {
    requireUser("update metrics");
    const dottedUpdates: Record<string, number> = {};
    for (const [key, value] of Object.entries(updates)) {
        if (typeof value === "number" && !Number.isNaN(value)) {
            dottedUpdates[`metrics.${key}`] = value;
        }
    }
    if (Object.keys(dottedUpdates).length === 0) return;
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), dottedUpdates);
}

// The one and only writer of endDate, and idempotent. saveDraft and
// publishEvent must never touch it: hoursOfService is derived from
// endDate - startDate, so re-saving a draft used to inflate it by however long
// the draft sat untouched.
export async function setEventInactive(eventId: string): Promise<void> {
    requireUser("end an event");
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(eventRef);
        if (!snapshot.exists()) {
            throw new Error(`No event found with id: ${eventId}`);
        }
        const data = snapshot.data() as Event;
        if (data.endDate) {
            if (data.isActive) transaction.update(eventRef, { isActive: false });
            return;
        }
        transaction.update(eventRef, {
            isActive: false,
            endDate: Timestamp.now(),
        });
    });
}

export async function saveDraft(
    eventId: string,
    notepad?: string,
): Promise<void> {
    requireUser("save a draft");
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isDraft: true,
        isActive: false,
        savedAsDraftAt: Timestamp.now(),
        ...(notepad !== undefined ? { notepad } : {}),
    });
}

export async function publishEvent(eventId: string): Promise<void> {
    requireUser("publish an event");
    await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
        isDraft: false,
        isActive: false,
        publishedAt: Timestamp.now(),
    });
}

export async function getDraftEvents(): Promise<Event[]> {
    const currentUser = requireUser("view drafts");
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("isDraft", "==", true),
        where("startedBy", "==", currentUser.uid),
        orderBy("savedAsDraftAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Event);
}

export async function getPublishedEvents(max = 20): Promise<Event[]> {
    requireUser("view past events");
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("publishedAt", "!=", null),
        orderBy("publishedAt", "desc"),
        limit(max),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Event);
}

export function extractMetricsWithHours(event: Event): EventMetricsWithHours {
    const start = event.startDate;
    const end = event.endDate ? event.endDate.toMillis() : Date.now();
    return {
        ...createDefaultMetrics(),
        ...(event.metrics ?? {}),
        hoursOfService: start
            ? parseFloat(
                  (Math.max(0, end - start.toMillis()) / 3_600_000).toFixed(1),
              )
            : 0,
    };
}
