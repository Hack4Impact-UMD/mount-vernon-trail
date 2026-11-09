import { randomUUID } from "crypto";
import { ExportInProgressError } from "./errors";
import type { KeyValueStore } from "./kv-store";

const LOCK_PREFIX = "sheets_export_lock:";

export type EventLockOptions = {
    ttlSeconds: number;
    waitMs: number;
    retryMs: number;
};

const DEFAULTS: EventLockOptions = {
    ttlSeconds: 60,
    waitMs: 30_000,
    retryMs: 250,
};

export async function withEventLock<T>(
    store: KeyValueStore,
    eventId: string,
    run: () => Promise<T>,
    options: Partial<EventLockOptions> = {},
): Promise<T> {
    const { ttlSeconds, waitMs, retryMs } = { ...DEFAULTS, ...options };
    const key = `${LOCK_PREFIX}${eventId}`;
    const holder = randomUUID();
    const deadline = Date.now() + waitMs;

    while (
        (await store.set(key, holder, { ex: ttlSeconds, nx: true })) === null
    ) {
        if (Date.now() >= deadline) throw new ExportInProgressError(eventId);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
    }

    try {
        return await run();
    } finally {
        if ((await store.get<string>(key)) === holder) {
            await store.del(key);
        }
    }
}
