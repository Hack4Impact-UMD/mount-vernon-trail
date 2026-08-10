import { createInMemoryStore } from "../kv-store";

// The in-memory store stands in for Upstash during local development, so it
// must match Redis's contract closely enough that the token store behaves
// identically — including the sentinel TTL values it branches on.
describe("createInMemoryStore", () => {
    it("round-trips a value", async () => {
        const kv = createInMemoryStore();
        await kv.set("k", "v");
        await expect(kv.get<string>("k")).resolves.toBe("v");
    });

    it("returns null for a key that was never set", async () => {
        await expect(createInMemoryStore().get("nope")).resolves.toBeNull();
    });

    it("expires a key once its ex window passes", async () => {
        let now = 1_000_000;
        const kv = createInMemoryStore(() => now);
        await kv.set("k", "v", { ex: 60 });

        await expect(kv.get<string>("k")).resolves.toBe("v");
        now += 59_000;
        await expect(kv.get<string>("k")).resolves.toBe("v");
        now += 2_000;
        await expect(kv.get<string>("k")).resolves.toBeNull();
    });

    it("reports TTL the way Redis does", async () => {
        let now = 0;
        const kv = createInMemoryStore(() => now);

        // -2 = no such key, -1 = exists with no expiry. The token store
        // branches on `ttl > 60`, so these must not be positive.
        await expect(kv.ttl("missing")).resolves.toBe(-2);
        await kv.set("forever", "v");
        await expect(kv.ttl("forever")).resolves.toBe(-1);

        await kv.set("temp", "v", { ex: 120 });
        await expect(kv.ttl("temp")).resolves.toBe(120);
        now += 60_000;
        await expect(kv.ttl("temp")).resolves.toBe(60);
        now += 61_000;
        await expect(kv.ttl("temp")).resolves.toBe(-2);
    });

    it("del reports whether it removed anything", async () => {
        const kv = createInMemoryStore();
        await kv.set("k", "v");
        await expect(kv.del("k")).resolves.toBe(1);
        await expect(kv.del("k")).resolves.toBe(0);
    });

    it("exists respects expiry", async () => {
        let now = 0;
        const kv = createInMemoryStore(() => now);
        await kv.set("k", "v", { ex: 10 });
        await expect(kv.exists("k")).resolves.toBe(1);
        now += 11_000;
        await expect(kv.exists("k")).resolves.toBe(0);
    });

    it("overwrites an expiry when the key is set again without one", async () => {
        let now = 0;
        const kv = createInMemoryStore(() => now);
        await kv.set("k", "v", { ex: 10 });
        await kv.set("k", "v2");
        now += 60_000;
        await expect(kv.get<string>("k")).resolves.toBe("v2");
    });
});
