import { updateEventNotes } from "@/services/event-service";
import { getErrorMessage } from "@/utils/errors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const SAVE_DEBOUNCE_MS = 1000;

export const pendingNotesKey = (eventId: string) =>
    `event-notes-pending:v1:${eventId}`;

export function useEventNotes(
    eventId: string | undefined,
    serverNotes: string | undefined,
) {
    const [notes, setNotesState] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const notesRef = useRef("");
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
        if (value === syncedRef.current) return;
        try {
            await updateEventNotes(eventId, value);
            syncedRef.current = value;
            if (mountedRef.current) setSaveError(null);
            if (notesRef.current === value) {
                await AsyncStorage.removeItem(pendingNotesKey(eventId));
            }
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
        if (!eventId || serverNotes === undefined) return;
        let cancelled = false;
        AsyncStorage.getItem(pendingNotesKey(eventId))
            .catch((error: unknown) => {
                console.error(
                    "Could not read unsaved notes:",
                    getErrorMessage(error),
                );
                return null;
            })
            .then((pending) => {
                if (cancelled) return;
                const initial = pending ?? serverNotes;
                notesRef.current = initial;
                syncedRef.current = serverNotes;
                setNotesState(initial);
                if (pending !== null) {
                    sync().catch(() => undefined);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [eventId, serverNotes, sync]);

    const setNotes = useCallback(
        (text: string) => {
            notesRef.current = text;
            setNotesState(text);
            if (!eventId) return;
            AsyncStorage.setItem(pendingNotesKey(eventId), text).catch(
                (error: unknown) =>
                    console.error(
                        "Could not keep notes on device:",
                        getErrorMessage(error),
                    ),
            );
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

    return { notes, setNotes, saveError };
}
