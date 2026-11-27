import { updateEventNotes } from "@/services/event-service";
import { getErrorMessage } from "@/utils/errors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const SAVE_DEBOUNCE_MS = 1000;

export const pendingNotesKey = (eventId: string) =>
    `event-notes-pending:v1:${eventId}`;

type Draft = { text: string; rev: number };

let nextRev = 0;
const latestDraftRev = new Map<string, number>();
const storageQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(eventId: string, op: () => Promise<T>): Promise<T> {
    const previous = storageQueues.get(eventId) ?? Promise.resolve();
    const next = previous.then(op, op);
    storageQueues.set(
        eventId,
        next.catch(() => undefined),
    );
    return next;
}

function writeDraft(eventId: string, text: string): number {
    const rev = ++nextRev;
    enqueue(eventId, async () => {
        latestDraftRev.set(eventId, rev);
        await AsyncStorage.setItem(pendingNotesKey(eventId), text);
    }).catch((error: unknown) =>
        console.error(
            "Could not keep notes on device:",
            getErrorMessage(error),
        ),
    );
    return rev;
}

function clearDraftIfCurrent(eventId: string, rev: number): Promise<void> {
    return enqueue(eventId, async () => {
        if (latestDraftRev.get(eventId) !== rev) return;
        latestDraftRev.delete(eventId);
        await AsyncStorage.removeItem(pendingNotesKey(eventId));
    });
}

function readDraft(eventId: string): Promise<Draft | null> {
    return enqueue(eventId, async () => {
        const text = await AsyncStorage.getItem(pendingNotesKey(eventId));
        if (text === null) {
            latestDraftRev.delete(eventId);
            return null;
        }
        const rev = ++nextRev;
        latestDraftRev.set(eventId, rev);
        return { text, rev };
    });
}

export function useEventNotes(
    eventId: string | undefined,
    serverNotes: string | undefined,
) {
    const [notes, setNotesState] = useState("");
    const loadKey =
        eventId && serverNotes !== undefined
            ? JSON.stringify([eventId, serverNotes])
            : null;
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const ready = loadKey !== null && loadedKey === loadKey;
    const [saveError, setSaveError] = useState<string | null>(null);
    const notesRef = useRef("");
    const revRef = useRef<number | null>(null);
    const syncedRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const sync = useCallback(async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!eventId || syncedRef.current === null) return;
        const value = notesRef.current;
        const rev = revRef.current;
        if (value === syncedRef.current) return;
        try {
            await updateEventNotes(eventId, value);
            syncedRef.current = value;
            if (mountedRef.current) setSaveError(null);
            if (rev !== null) await clearDraftIfCurrent(eventId, rev);
        } catch (error: unknown) {
            console.error("Failed to save notes:", getErrorMessage(error));
            if (mountedRef.current) {
                setSaveError(
                    "Couldn't save notes — they're kept on this device and will retry.",
                );
            }
        }
    }, [eventId]);

    useEffect(() => {
        if (!eventId || serverNotes === undefined || loadKey === null) return;
        let cancelled = false;
        syncedRef.current = null;
        readDraft(eventId)
            .catch((error: unknown) => {
                console.error(
                    "Could not read unsaved notes:",
                    getErrorMessage(error),
                );
                return null;
            })
            .then((draft) => {
                if (cancelled) return;
                const initial = draft?.text ?? serverNotes;
                notesRef.current = initial;
                revRef.current = draft?.rev ?? null;
                syncedRef.current = serverNotes;
                setNotesState(initial);
                setLoadedKey(loadKey);
                if (draft) sync().catch(() => undefined);
            });
        return () => {
            cancelled = true;
        };
    }, [eventId, serverNotes, loadKey, sync]);

    const setNotes = useCallback(
        (text: string) => {
            if (!eventId || syncedRef.current === null) return;
            notesRef.current = text;
            setNotesState(text);
            revRef.current = writeDraft(eventId, text);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                sync().catch(() => undefined);
            }, SAVE_DEBOUNCE_MS);
        },
        [eventId, sync],
    );

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") sync().catch(() => undefined);
        });
        return () => subscription.remove();
    }, [sync]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            sync().catch(() => undefined);
        };
    }, [sync]);

    return { notes, setNotes, saveError, ready };
}
