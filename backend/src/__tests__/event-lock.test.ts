import {
    createInMemoryLockStore,
    createRedisLockStore,
    RELEASE_SCRIPT,
    RENEW_SCRIPT,
    type LockStore,
    type RedisScripting,
    withEventLock,
} from "../event-lock";
import { ExportInProgressError, ExportLockLostError } from "../errors";

const OPTIONS = { ttlMs: 1_000, renewEveryMs: 300, waitMs: 0, retryMs: 50 };

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(signal.reason);
            },
            { once: true },
        );
    });
}

function settle<T>(promise: Promise<T>): Promise<T | unknown> {
    return promise.catch((error: unknown) => error);
}

describe("withEventLock", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("keeps ownership while the export runs past the lease", async () => {
        const store = createInMemoryLockStore();
        let inFlight = 0;
        let peak = 0;
        const exportTaking = (ms: number) => async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await sleep(ms);
            inFlight--;
        };

        const first = settle(
            withEventLock(store, "event-1", exportTaking(5_000), OPTIONS),
        );
        // Well past the 1s lease: a fixed TTL would have let this one in.
        await jest.advanceTimersByTimeAsync(2_500);
        await expect(
            withEventLock(store, "event-1", exportTaking(10), OPTIONS),
        ).rejects.toBeInstanceOf(ExportInProgressError);

        await jest.advanceTimersByTimeAsync(2_500);
        await expect(first).resolves.toBeUndefined();

        const next = settle(
            withEventLock(store, "event-1", exportTaking(10), OPTIONS),
        );
        await jest.advanceTimersByTimeAsync(10);
        await expect(next).resolves.toBeUndefined();
        expect(peak).toBe(1);
    });

    it("aborts before the next write once a renewal is refused", async () => {
        const refused: LockStore = {
            ...createInMemoryLockStore(),
            renew: async () => false,
        };
        const writes: number[] = [];

        const result = settle(
            withEventLock(
                refused,
                "event-1",
                async (signal) => {
                    for (let write = 0; write < 10; write++) {
                        await sleep(200);
                        signal.throwIfAborted();
                        writes.push(write);
                    }
                },
                OPTIONS,
            ),
        );
        await jest.advanceTimersByTimeAsync(3_000);

        await expect(result).resolves.toBeInstanceOf(ExportLockLostError);
        // The write at 200ms went out; the renewal at 300ms was refused, so the
        // one due at 400ms never started.
        expect(writes).toEqual([0]);
    });

    it("rides out a renewal that fails transiently", async () => {
        const store = createInMemoryLockStore();
        let failures = 1;
        const flaky: LockStore = {
            ...store,
            renew: async (...args) => {
                if (failures-- > 0) throw new Error("Redis unreachable");
                return store.renew(...args);
            },
        };

        const result = settle(
            withEventLock(
                flaky,
                "event-1",
                (signal) => sleep(2_000, signal),
                OPTIONS,
            ),
        );
        await jest.advanceTimersByTimeAsync(2_000);

        await expect(result).resolves.toBeUndefined();
    });

    it("aborts when no renewal succeeds before the lease would lapse", async () => {
        const unreachable: LockStore = {
            ...createInMemoryLockStore(),
            renew: async () => {
                throw new Error("Redis unreachable");
            },
        };
        let settled = false;

        const result = settle(
            withEventLock(
                unreachable,
                "event-1",
                (signal) => sleep(5_000, signal),
                OPTIONS,
            ),
        ).finally(() => {
            settled = true;
        });

        await jest.advanceTimersByTimeAsync(999);
        expect(settled).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toBeInstanceOf(ExportLockLostError);
    });

    it("leaves a successor's lock in place when its own lease lapsed", async () => {
        const shared = createInMemoryLockStore();
        const unreachable: LockStore = {
            ...shared,
            renew: async () => {
                throw new Error("Redis unreachable");
            },
        };

        // Ignores its signal, so it is still running when the successor starts.
        const stale = settle(
            withEventLock(unreachable, "event-1", () => sleep(3_000), OPTIONS),
        );
        await jest.advanceTimersByTimeAsync(1_500);

        let finishSuccessor = () => undefined as void;
        const successor = withEventLock(
            shared,
            "event-1",
            () => new Promise<void>((resolve) => (finishSuccessor = resolve)),
            OPTIONS,
        );
        await jest.advanceTimersByTimeAsync(1_500);
        await expect(stale).resolves.toBeInstanceOf(ExportLockLostError);

        // The stale holder has released; the successor must still own the event.
        await expect(
            withEventLock(shared, "event-1", async () => undefined, OPTIONS),
        ).rejects.toBeInstanceOf(ExportInProgressError);

        finishSuccessor();
        await expect(successor).resolves.toBeUndefined();
    });
});

// Interprets the two scripts the way Redis would, so these tests check what the
// lock store sends: which script, which key, and the holder and TTL in order.
type FakeRedis = RedisScripting & {
    eval: jest.Mock;
    advance: (ms: number) => void;
};

function fakeRedis(): FakeRedis {
    let now = 0;
    const data = new Map<string, { value: string; expiresAt: number }>();
    const read = (key: string) => {
        const entry = data.get(key);
        return entry && entry.expiresAt > now ? entry.value : null;
    };
    return {
        set: async (key, value, { px }) => {
            if (read(key) !== null) return null;
            data.set(key, { value, expiresAt: now + px });
            return "OK";
        },
        eval: jest.fn(
            async (script: string, [key]: string[], args: unknown[]) => {
                if (read(key) !== args[0]) return 0;
                if (script === RELEASE_SCRIPT) {
                    data.delete(key);
                    return 1;
                }
                if (script === RENEW_SCRIPT) {
                    data.set(key, {
                        value: String(args[0]),
                        expiresAt: now + Number(args[1]),
                    });
                    return 1;
                }
                throw new Error(`Unexpected script: ${script}`);
            },
        ),
        advance: (ms: number) => {
            now += ms;
        },
    } as FakeRedis;
}

describe("createRedisLockStore", () => {
    it("releases with one compare-and-delete script", async () => {
        const redis = fakeRedis();
        const store = createRedisLockStore(redis);

        await expect(store.acquire("k", "a", 1_000)).resolves.toBe(true);
        await expect(store.release("k", "a")).resolves.toBe(true);

        expect(redis.eval).toHaveBeenCalledTimes(1);
        expect(redis.eval).toHaveBeenCalledWith(RELEASE_SCRIPT, ["k"], ["a"]);
    });

    it("will not release or renew a lease that changed hands", async () => {
        const redis = fakeRedis();
        const store = createRedisLockStore(redis);

        await store.acquire("k", "a", 1_000);
        redis.advance(1_000);
        await expect(store.acquire("k", "b", 1_000)).resolves.toBe(true);

        await expect(store.renew("k", "a", 1_000)).resolves.toBe(false);
        await expect(store.release("k", "a")).resolves.toBe(false);
        await expect(store.acquire("k", "c", 1_000)).resolves.toBe(false);
        expect(redis.eval).toHaveBeenCalledWith(
            RENEW_SCRIPT,
            ["k"],
            ["a", 1_000],
        );
    });
});
