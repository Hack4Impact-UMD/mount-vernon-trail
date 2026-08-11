// The subset of the Upstash Redis surface the token store actually uses.
// Narrowing it here lets local development run without a Redis account, and
// lets tests drive the store without mocking a whole client.
export type KeyValueStore = {
    get: <T>(key: string) => Promise<T | null>;
    set: (
        key: string,
        value: string,
        opts?: { ex: number },
    ) => Promise<unknown>;
    ttl: (key: string) => Promise<number>;
    del: (key: string) => Promise<number>;
    exists: (key: string) => Promise<number>;
};

type Entry = { value: string; expiresAt: number | null };

// Process-local, so it does not survive a restart and is not shared between
// replicas — which is exactly why it is refused in production. It exists so
// `npm run dev` works before anyone has provisioned Upstash.
export function createInMemoryStore(now: () => number = Date.now): KeyValueStore {
    const entries = new Map<string, Entry>();

    function live(key: string): Entry | null {
        const entry = entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt !== null && now() >= entry.expiresAt) {
            entries.delete(key);
            return null;
        }
        return entry;
    }

    return {
        async get<T>(key: string): Promise<T | null> {
            const entry = live(key);
            return entry ? (entry.value as T) : null;
        },
        async set(key, value, opts) {
            entries.set(key, {
                value,
                expiresAt: opts?.ex ? now() + opts.ex * 1000 : null,
            });
            return "OK";
        },
        async ttl(key) {
            const entry = live(key);
            if (!entry) return -2; // Redis: key does not exist
            if (entry.expiresAt === null) return -1; // Redis: no expiry
            return Math.ceil((entry.expiresAt - now()) / 1000);
        },
        async del(key) {
            return entries.delete(key) ? 1 : 0;
        },
        async exists(key) {
            return live(key) ? 1 : 0;
        },
    };
}
