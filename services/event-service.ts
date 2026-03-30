import { auth } from "@/config/firebase";
import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
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

// creates a new event and adds album doc to albums collection
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
        associatedUsers: [currentUser.uid],
        associatedEmails: associatedEmails.map((e) => e.toLowerCase()),
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
    };

    await setDoc(eventRef, eventData);

    await setDoc(doc(db, ALBUMS_COLLECTION, albumId), {
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

    const q = query(
        collection(db, EVENTS_COLLECTION),
        where("isActive", "==", true),
        where("associatedUsers", "array-contains", currentUser.uid),
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
    });
}
