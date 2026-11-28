import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import type { Env } from "./env";
import { ExportInProgressError, ExportLockLostError } from "./errors";
import { usesInMemoryStore } from "./google-tokens";

const LOCK_PREFIX = "sheets_export_lock:";

// Ownership is checked and acted on inside one script, never as a GET followed
// by a DEL or PEXPIRE. Between two separate round-trips the lease can expire and
// be taken by another instance, whose lock the second call would then delete or
// extend.
export const RENEW_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
export const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

// Every operation takes the holder and succeeds only for the instance that owns
// the lease, so no caller can extend or remove a lease it does not hold.
export type LockStore = {
    acquire: (key: string, holder: string, ttlMs: number) => Promise<boolean>;
    renew: (key: string, holder: string, ttlMs: number) => Promise<boolean>;
    release: (key: string, holder: string) => Promise<boolean>;
};

// The two Upstash commands the lock needs. It deliberately has no `get` or
// `del`, so the Redis lock store cannot drift back to a non-atomic release.
export type RedisScripting = {
    set: (
        key: string,
        value: string,
        opts: { px: number; nx: true },
    ) => Promise<unknown>;
    eval: <TArgs extends unknown[], TData = unknown>(
        script: string,
        keys: string[],
        args: TArgs,
    ) => Promise<TData>;
};

export function createRedisLockStore(redis: RedisScripting): LockStore {
    return {
        async acquire(key, holder, ttlMs) {
            const reply = await redis.set(key, holder, { px: ttlMs, nx: true });
            return reply !== null;
        },
        async renew(key, holder, ttlMs) {
            const reply = await redis.eval<[string, number], number>(
                RENEW_SCRIPT,
                [key],
                [holder, ttlMs],
            );
            return Number(reply) === 1;
        },
        async release(key, holder) {
            const reply = await redis.eval<[string], number>(
                RELEASE_SCRIPT,
                [key],
                [holder],
            );
            return Number(reply) === 1;
        },
    };
}

// Each operation checks and writes with no await in between, so on one event
// loop it is as atomic as the Redis scripts. Like the in-memory token store it
// is process-local, which is why env.ts refuses it in production.
export function createInMemoryLockStore(
    now: () => number = () => Date.now(),
): LockStore {
    const leases = new Map<string, { holder: string; expiresAt: number }>();

    function current(key: string) {
        const lease = leases.get(key);
        if (lease && now() >= lease.expiresAt) {
            leases.delete(key);
            return undefined;
        }
        return lease;
    }

    return {
        async acquire(key, holder, ttlMs) {
            if (current(key)) return false;
            leases.set(key, { holder, expiresAt: now() + ttlMs });
            return true;
        },
        async renew(key, holder, ttlMs) {
            const lease = current(key);
            if (lease?.holder !== holder) return false;
            lease.expiresAt = now() + ttlMs;
            return true;
        },
        async release(key, holder) {
            if (current(key)?.holder !== holder) return false;
            leases.delete(key);
            return true;
        },
    };
}

export function createEventLockStore(env: Env): LockStore {
    if (usesInMemoryStore(env)) return createInMemoryLockStore();
    return createRedisLockStore(
        new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken }),
    );
}

export type EventLockOptions = {
    ttlMs: number;
    renewEveryMs: number;
    waitMs: number;
    retryMs: number;
};

const DEFAULTS: EventLockOptions = {
    ttlMs: 60_000,
    // A third of the lease, so two renewals in a row can fail on a Redis blip
    // before the lease is at risk.
    renewEveryMs: 20_000,
    waitMs: 30_000,
    retryMs: 250,
};

// Runs `run` while this instance holds the event's lease. A fixed TTL alone let
// a slow export outlive its lock and run alongside the next one, because nothing
// bounds how long Google takes to answer, so the lease is renewed for as long as
// `run` is working.
//
// If a renewal is refused, or none has succeeded by the time the lease would
// lapse, `signal` aborts with ExportLockLostError. `run` must pass it to every
// request it makes so that no write starts after ownership is in doubt.
//
// Expiry is enforced by its own timer, never by awaiting a renewal: a renewal
// that hung past the lease used to stop the expiry check with it, leaving
// `signal` live while another instance acquired the lock.
export async function withEventLock<T>(
    store: LockStore,
    eventId: string,
    run: (signal: AbortSignal) => Promise<T>,
    options: Partial<EventLockOptions> = {},
): Promise<T> {
    const { ttlMs, renewEveryMs, waitMs, retryMs } = {
        ...DEFAULTS,
        ...options,
    };
    const key = `${LOCK_PREFIX}${eventId}`;
    const holder = randomUUID();
    const deadline = Date.now() + waitMs;

    let sentAt = Date.now();
    while (!(await store.acquire(key, holder, ttlMs))) {
        if (Date.now() >= deadline) throw new ExportInProgressError(eventId);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        sentAt = Date.now();
    }
    // Counted from when the request was sent, not when it returned, so a slow
    // round-trip can only make this estimate early, never late.
    let heldUntil = sentAt + ttlMs;

    // A SET that answered after its own TTL won a lease that may already be
    // someone else's. Starting `run` and aborting on the next tick would let
    // its first request out first.
    if (Date.now() >= heldUntil) {
        await store.release(key, holder);
        throw new ExportLockLostError(eventId);
    }

    const controller = new AbortController();
    let stopped = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    const lose = () => {
        clearTimeout(expiry);
        clearInterval(renewals);
        if (!controller.signal.aborted) {
            controller.abort(new ExportLockLostError(eventId));
        }
    };

    const armExpiry = () => {
        clearTimeout(expiry);
        expiry = setTimeout(lose, Math.max(0, heldUntil - Date.now()));
    };

    const renew = async () => {
        const renewSentAt = Date.now();
        try {
            const renewed = await store.renew(key, holder, ttlMs);
            // A reply that arrives after the export finished or the lease was
            // already given up must not re-arm the expiry timer.
            if (stopped || controller.signal.aborted) return;
            if (!renewed) return lose();
            // The script only extends a lease it still holds, so success means
            // the lease runs to at least renewSentAt + ttlMs. Replies can arrive
            // out of order when an earlier renewal stalled, so never shorten.
            if (renewSentAt + ttlMs > heldUntil) {
                heldUntil = renewSentAt + ttlMs;
                armExpiry();
            }
        } catch (error: unknown) {
            // An unreachable Redis does not mean the lease is gone; it is still
            // ours until heldUntil, and the expiry timer aborts at that point
            // if no renewal has succeeded.
            console.warn(
                `Could not renew the export lock for event ${eventId}:`,
                error,
            );
        }
    };

    armExpiry();
    // Renewals are not chained: a stalled one does not hold back the next, so
    // a single hung request cannot cost the lease while Redis is reachable.
    const renewals = setInterval(() => void renew(), renewEveryMs);
    try {
        const result = await run(controller.signal);
        // `run` finished, but if the lease lapsed partway through, another
        // export may have run alongside it. Report that rather than success.
        controller.signal.throwIfAborted();
        return result;
    } finally {
        stopped = true;
        clearTimeout(expiry);
        clearInterval(renewals);
        // In-flight renewals are not awaited: one may never return. Each is an
        // atomic compare-and-extend, so one landing after the release below
        // finds the key gone or someone else's and changes nothing.
        //
        // Compare-and-delete: if the lease was lost, this leaves the
        // successor's lock alone.
        await store.release(key, holder);
    }
}
