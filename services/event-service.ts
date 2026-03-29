import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, Timestamp, arrayUnion } from "firebase/firestore";
import { auth } from "@/config/firebase";

export interface Event {
    eventId: string;
    title: string;
    description: string;
    date: Timestamp;
    trelloCardId: string;
    albumId: string;
    albumUrl: string;
    isActive: boolean;
    associatedUsers: string[];
    associatedEmails: string[];
    createdBy: string;
    createdAt: Timestamp;
}

export interface FirebaseUser {
    uid: string;
    email: string;
    displayName: string;
    createdAt: Timestamp;
}

const EVENTS_COLLECTION = "events";
const USERS_COLLECTION = "users";
const ALBUMS_COLLECTION = "albums";

// create or update user document in Firebase when they sign up/sign in
export async function createOrUpdateUser(
    uid: string,
    email: string,
    displayName: string,
): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        await setDoc(userRef, {
            uid,
            email,
            displayName,
            createdAt: Timestamp.now(),
        } as FirebaseUser);
    } else {
        await updateDoc(userRef, {
            email,
            displayName,
        });
    }
}

// when a user signs in, link their UID to any events that have their email in associatedEmails
export async function linkUserToEventsByEmail(
    uid: string,
    email: string,
): Promise<void> {
    const db = getFirestore();
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("associatedEmails", "array-contains", email.toLowerCase()),
    );
    const snapshot = await getDocs(q);
    for (const docSnapshot of snapshot.docs) {
        await updateDoc(docSnapshot.ref, {
            associatedUsers: arrayUnion(uid),
        });
    }
}

// creates a new event with album and add to albums collection
export async function createEvent(
    title: string,
    description: string,
    eventDate: Date,
    trelloCardId: string,
    albumId: string,
    albumUrl: string,
    associatedEmails: string[],
): Promise<string> {
    const db = getFirestore();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("User is not authenticated. Please sign in to create an event.");
    }

    // create the actual event document
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
        associatedUsers: [],
        associatedEmails: associatedEmails.map((e) => e.toLowerCase()),
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
    };

    await setDoc(eventRef, eventData);

    const albumRef = doc(db, ALBUMS_COLLECTION, albumId);
    await setDoc(albumRef, {
        albumId,
        title,
        albumUrl,
        eventId: eventRef.id,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
    });

    return eventRef.id;
}


// get active event for the current user
export async function getActiveEvent(): Promise<Event | null> {
    const db = getFirestore();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        return null;
    }

    // query for active events where user is in associatedUsers
    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("isActive", "==", true),
        where("associatedUsers", "array-contains", currentUser.uid),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }

    // should ideally be only one active event but takes the first one in case there are multiple
    const doc = snapshot.docs[0];
    return doc.data() as Event;
}

// gets all the events, active and inactive
export async function getAllEvents(): Promise<Event[]> {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, EVENTS_COLLECTION));
    return snapshot.docs.map((doc) => doc.data() as Event);
}

export async function getEventById(eventId: string): Promise<Event | null> {
    const db = getFirestore();
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
        return null;
    }

    return eventDoc.data() as Event;
}

export async function setEventInactive(eventId: string): Promise<void> {
    const db = getFirestore();
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(eventRef, {
        isActive: false,
    });
}

export async function setEventActive(eventId: string): Promise<void> {
    const db = getFirestore();
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(eventRef, {
        isActive: true,
    });
}

// adds a user to the events user list like rsvping to an event
// **note this does not check if the user is already in the list, but Firestore does handle duplicates from testing
export async function addUserToEvent(
    eventId: string,
    userId: string,
): Promise<void> {
    const db = getFirestore();
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
        throw new Error(`Event ${eventId} not found`);
    }

    const event = eventDoc.data() as Event;
    const updatedUsers = [...new Set([...event.associatedUsers, userId])]; // Remove duplicates

    await updateDoc(eventRef, {
        associatedUsers: updatedUsers,
    });
}

export async function getAllUsers(): Promise<FirebaseUser[]> {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, USERS_COLLECTION));
    return snapshot.docs.map((doc) => doc.data() as FirebaseUser);
}

export async function removeUserFromEvent(
    eventId: string,
    userId: string,
): Promise<void> {
    const db = getFirestore();
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
        throw new Error(`Event ${eventId} not found`);
    }

    const event = eventDoc.data() as Event;
    const updatedUsers = event.associatedUsers.filter((uid) => uid !== userId);

    await updateDoc(eventRef, {
        associatedUsers: updatedUsers,
    });
}