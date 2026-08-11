import { mapSettledWithLimit } from "../concurrency";

describe("mapSettledWithLimit", () => {
    it("keeps results aligned with their input index", async () => {
        const results = await mapSettledWithLimit([1, 2, 3], 2, async (n) => n * 10);
        expect(results).toEqual([
            { ok: true, index: 0, value: 10 },
            { ok: true, index: 1, value: 20 },
            { ok: true, index: 2, value: 30 },
        ]);
    });

    it("reports a failure per item instead of rejecting the batch", async () => {
        const results = await mapSettledWithLimit([1, 2, 3], 2, async (n) => {
            if (n === 2) throw new Error("boom");
            return n;
        });
        expect(results[0]).toEqual({ ok: true, index: 0, value: 1 });
        expect(results[1]).toMatchObject({ ok: false, index: 1 });
        expect(results[2]).toEqual({ ok: true, index: 2, value: 3 });
    });

    it("keeps going after a failure rather than stopping there", async () => {
        const seen: number[] = [];
        await mapSettledWithLimit([1, 2, 3, 4], 1, async (n) => {
            seen.push(n);
            if (n === 1) throw new Error("boom");
            return n;
        });
        expect(seen).toEqual([1, 2, 3, 4]);
    });

    it("never exceeds the concurrency limit", async () => {
        let inFlight = 0;
        let peak = 0;
        await mapSettledWithLimit(
            Array.from({ length: 12 }, (_, i) => i),
            3,
            async () => {
                inFlight++;
                peak = Math.max(peak, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 5));
                inFlight--;
                return null;
            },
        );
        expect(peak).toBeLessThanOrEqual(3);
        expect(peak).toBeGreaterThan(1);
    });

    it("handles an empty input", async () => {
        await expect(mapSettledWithLimit([], 4, async () => 1)).resolves.toEqual([]);
    });
});
