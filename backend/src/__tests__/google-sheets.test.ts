import { syncEventToGoogleSheets } from "../google-sheets";
import type { SheetEvent } from "../sheet-row";

type SheetState = Map<string, (string | number)[][]>;

function tabFromRange(range: string): string {
    const match = /^'((?:''|[^'])*)'!/.exec(range);
    if (!match) throw new Error(`Unexpected range: ${range}`);
    return match[1].replace(/''/g, "'");
}

function response(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as Response;
}

function renderedRow(row: (string | number)[]): (string | number)[] {
    return row.map((value) =>
        typeof value === "string" && value.startsWith("'")
            ? value.slice(1)
            : value,
    );
}

function fakeSheetsApi(state: SheetState): jest.SpyInstance {
    return jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
            const url = new URL(String(input));
            const path = decodeURIComponent(url.pathname);
            const body = init?.body
                ? (JSON.parse(String(init.body)) as {
                      values?: (string | number)[][];
                      data?: {
                          range: string;
                          values: (string | number)[][];
                      }[];
                      ranges?: string[];
                  })
                : {};

            if (path.endsWith("/values:batchUpdate")) {
                for (const update of body.data ?? []) {
                    const tab = tabFromRange(update.range);
                    const rowNumber = Number(/!A(\d+):/.exec(update.range)?.[1]);
                    const rows = state.get(tab) ?? [];
                    rows[rowNumber - 1] = renderedRow(update.values[0]);
                    state.set(tab, rows);
                }
                return response({});
            }

            if (path.endsWith("/values:batchClear")) {
                for (const range of body.ranges ?? []) {
                    const tab = tabFromRange(range);
                    const rowNumber = Number(/!A(\d+):/.exec(range)?.[1]);
                    const rows = state.get(tab) ?? [];
                    rows[rowNumber - 1] = [];
                    state.set(tab, rows);
                }
                return response({});
            }

            const valuesMarker = "/values/";
            const rawRange = path.slice(path.indexOf(valuesMarker) + valuesMarker.length);
            const isAppend = rawRange.includes(":append");
            const range = rawRange.replace(":append", "");
            const tab = tabFromRange(range);
            const rows = state.get(tab) ?? [];
            if (init?.method === "GET" || !init?.method) {
                return response({ values: rows });
            }
            const values = body.values ?? [];
            const renderedValues = values.map(renderedRow);
            if (isAppend) {
                rows.push(...renderedValues);
            } else if (init.method === "PUT") {
                rows[0] = renderedValues[0] ?? [];
            }
            state.set(tab, rows);
            return response({});
        });
}

const EVENT: SheetEvent = {
    eventId: "event-1",
    title: "Fall cleanup",
    date: new Date("2026-10-25T14:00:00.000Z"),
    startDate: new Date("2026-10-25T14:00:00.000Z"),
    endDate: new Date("2026-10-25T16:00:00.000Z"),
    eventLeader: "Volunteer",
    metrics: {
        drainageCleaned: 0,
        graffitiTagsRemoved: 0,
        stickersRemoved: 1,
        otherImprovements: 0,
        itemsPainted: 0,
        pressureWashed: 0,
        itemsRepaired: 0,
        safetyImprovements: 0,
        snowRemovalEvents: 0,
        potholesFilled: 0,
        trailEdgedFeet: 0,
        trashBagsCollected: 2,
        trashPoundsCollected: 0,
        treesTrimmed: 0,
        vegetationVolunteers: 0,
    },
};

describe("syncEventToGoogleSheets", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("retries without duplicating event or metric rows and reconciles changes", async () => {
        const state: SheetState = new Map();
        fakeSheetsApi(state);
        await syncEventToGoogleSheets(
            "token",
            "spreadsheet-id",
            "Events",
            "Improvements",
            EVENT,
        );

        await syncEventToGoogleSheets(
            "token",
            "spreadsheet-id",
            "Events",
            "Improvements",
            {
                ...EVENT,
                metrics: {
                    ...EVENT.metrics,
                    stickersRemoved: 0,
                    drainageCleaned: 4,
                    trashBagsCollected: 3,
                },
            },
        );

        const eventRows = (state.get("Events") ?? []).filter(
            (row) => row.length > 0,
        );
        expect(eventRows).toHaveLength(2);
        expect(eventRows[1][0]).toBe("event-1");
        expect(eventRows[1][5]).toBe(4);
        expect(eventRows[1][16]).toBe(3);

        const improvementRows = (state.get("Improvements") ?? []).filter(
            (row) => row.length > 0,
        );
        expect(improvementRows).toHaveLength(3);
        expect(
            Object.fromEntries(
                improvementRows
                    .slice(1)
                    .map((row) => [row[4], row[5]]),
            ),
        ).toEqual({
            "Trash bags collected": 3,
            "Drains / culverts cleaned": 4,
        });
    });

    it("fails explicitly when the existing header row does not match", async () => {
        const state: SheetState = new Map([
            ["Events", [["Wrong header"]]],
        ]);
        fakeSheetsApi(state);

        await expect(
            syncEventToGoogleSheets(
                "token",
                "spreadsheet-id",
                "Events",
                "Improvements",
                EVENT,
            ),
        ).rejects.toThrow(/must have this header row/);
    });
});
