import { auth } from "@/config/firebase";
import type { User } from "firebase/auth";

// Converts a would-be Firestore permission-denied into a readable message and
// saves a round-trip. This is a UX guard, not a security boundary — the real
// enforcement lives in firestore.rules.
export function requireUser(action: string): User {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error(`You must be signed in to ${action}.`);
    }
    return currentUser;
}
