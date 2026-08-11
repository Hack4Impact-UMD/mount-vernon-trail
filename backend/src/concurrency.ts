export type Settled<T> =
    | { ok: true; index: number; value: T }
    | { ok: false; index: number; error: unknown };

// Runs `worker` over every item with at most `limit` in flight, and never
// rejects — each item's outcome is reported individually so one bad photo
// cannot abort an upload batch partway and strand the rest.
export async function mapSettledWithLimit<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<Settled<R>[]> {
    const results: Settled<R>[] = new Array(items.length);
    let cursor = 0;

    async function run(): Promise<void> {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results[index] = {
                    ok: true,
                    index,
                    value: await worker(items[index], index),
                };
            } catch (error) {
                results[index] = { ok: false, index, error };
            }
        }
    }

    const workers = Array.from(
        { length: Math.min(Math.max(1, limit), items.length) },
        run,
    );
    await Promise.all(workers);
    return results;
}
