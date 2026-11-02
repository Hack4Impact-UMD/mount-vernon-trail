import {
    eventToImprovementRows,
    eventToSheetRow,
    IMPROVEMENT_HEADERS,
    SHEET_HEADERS,
    type SheetEvent,
} from "./sheet-row";
import { GoogleSheetsDataError, GoogleSheetsError } from "./errors";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function quotedTab(tab: string): string {
    return `'${tab.replace(/'/g, "''")}'`;
}

function valuesUrl(
    spreadsheetId: string,
    range: string,
    suffix = "",
): string {
    return `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
}

async function request(
    accessToken: string,
    url: string,
    init: RequestInit = {},
): Promise<unknown> {
    const response = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
        },
    });
    if (!response.ok) {
        throw new GoogleSheetsError(response.status, await response.text());
    }
    if (response.status === 204) return null;
    return response.json();
}

function rowsFrom(value: unknown): unknown[][] {
    if (
        typeof value !== "object" ||
        value === null ||
        !("values" in value) ||
        !Array.isArray(value.values)
    ) {
        return [];
    }
    return value.values as unknown[][];
}

async function ensureHeaders(
    accessToken: string,
    spreadsheetId: string,
    tab: string,
    headers: string[],
): Promise<void> {
    const range = `${quotedTab(tab)}!1:1`;
    const rows = rowsFrom(
        await request(accessToken, valuesUrl(spreadsheetId, range)),
    );
    const current = rows[0];
    if (!current || current.length === 0) {
        await request(
            accessToken,
            valuesUrl(spreadsheetId, range, "?valueInputOption=RAW"),
            {
                method: "PUT",
                body: JSON.stringify({
                    majorDimension: "ROWS",
                    values: [headers],
                }),
            },
        );
        return;
    }

    if (
        headers.length !== current.length ||
        !headers.every((header, index) => current[index] === header)
    ) {
        throw new GoogleSheetsDataError(
            `The "${tab}" sheet must have this header row in row 1: ${headers.join(" | ")}`,
        );
    }
}

async function readTab(
    accessToken: string,
    spreadsheetId: string,
    tab: string,
    lastColumn: string,
): Promise<unknown[][]> {
    return rowsFrom(
        await request(
            accessToken,
            valuesUrl(spreadsheetId, `${quotedTab(tab)}!A:${lastColumn}`),
        ),
    );
}

async function updateRows(
    accessToken: string,
    spreadsheetId: string,
    updates: { range: string; values: (string | number)[][] }[],
    dateColumn: number,
): Promise<void> {
    if (updates.length === 0) return;
    await request(
        accessToken,
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        {
            method: "POST",
            body: JSON.stringify({
                valueInputOption: "USER_ENTERED",
                data: updates.map((update) => ({
                    ...update,
                    values: update.values.map((row) =>
                        protectText(row, dateColumn),
                    ),
                })),
            }),
        },
    );
}

async function appendRows(
    accessToken: string,
    spreadsheetId: string,
    tab: string,
    lastColumn: string,
    values: (string | number)[][],
    dateColumn: number,
): Promise<void> {
    if (values.length === 0) return;
    await request(
        accessToken,
        valuesUrl(
            spreadsheetId,
            `${quotedTab(tab)}!A:${lastColumn}`,
            ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
        ),
        {
            method: "POST",
            body: JSON.stringify({
                majorDimension: "ROWS",
                values: values.map((row) => protectText(row, dateColumn)),
            }),
        },
    );
}

function protectText(
    row: (string | number)[],
    dateColumn: number,
): (string | number)[] {
    return row.map((value, index) =>
        typeof value === "string" && index !== dateColumn
            ? `'${value}`
            : value,
    );
}

async function clearRanges(
    accessToken: string,
    spreadsheetId: string,
    ranges: string[],
): Promise<void> {
    if (ranges.length === 0) return;
    await request(
        accessToken,
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
        { method: "POST", body: JSON.stringify({ ranges }) },
    );
}

function uniqueRow(
    rows: unknown[][],
    predicate: (row: unknown[]) => boolean,
    eventId: string,
    tab: string,
): number | null {
    const matches: number[] = [];
    for (let index = 1; index < rows.length; index++) {
        if (predicate(rows[index])) matches.push(index + 1);
    }
    if (matches.length > 1) {
        throw new GoogleSheetsDataError(
            `Multiple rows for event ${eventId} already exist in "${tab}"; remove duplicates before retrying.`,
        );
    }
    return matches[0] ?? null;
}

export async function syncEventToGoogleSheets(
    accessToken: string,
    spreadsheetId: string,
    eventsTab: string,
    improvementsTab: string,
    event: SheetEvent,
): Promise<void> {
    await ensureHeaders(accessToken, spreadsheetId, eventsTab, SHEET_HEADERS);
    await ensureHeaders(
        accessToken,
        spreadsheetId,
        improvementsTab,
        IMPROVEMENT_HEADERS,
    );

    const eventRows = await readTab(
        accessToken,
        spreadsheetId,
        eventsTab,
        "T",
    );
    const eventRow = eventToSheetRow(event);
    const existingEventRow = uniqueRow(
        eventRows,
        (row) => row[0] === event.eventId,
        event.eventId,
        eventsTab,
    );
    if (existingEventRow === null) {
        await appendRows(
            accessToken,
            spreadsheetId,
            eventsTab,
            "T",
            [eventRow],
            1,
        );
    } else {
        await updateRows(accessToken, spreadsheetId, [
            {
                range: `${quotedTab(eventsTab)}!A${existingEventRow}:T${existingEventRow}`,
                values: [eventRow],
            },
        ], 1);
    }

    const improvementRows = await readTab(
        accessToken,
        spreadsheetId,
        improvementsTab,
        "G",
    );
    const desiredRows = eventToImprovementRows(event);
    const existingByMetric = new Map<string, number>();
    for (let index = 1; index < improvementRows.length; index++) {
        const row = improvementRows[index];
        if (row[1] !== event.eventId) continue;
        const metric = String(row[4] ?? "");
        if (existingByMetric.has(metric)) {
            throw new GoogleSheetsDataError(
                `Multiple "${metric}" rows for event ${event.eventId} already exist in "${improvementsTab}"; remove duplicates before retrying.`,
            );
        }
        existingByMetric.set(metric, index + 1);
    }

    const updates: { range: string; values: (string | number)[][] }[] = [];
    const additions: (string | number)[][] = [];
    const currentMetrics = new Set<string>();
    for (const row of desiredRows) {
        const metric = String(row[4]);
        currentMetrics.add(metric);
        const rowNumber = existingByMetric.get(metric);
        if (rowNumber === undefined) {
            additions.push(row);
        } else {
            updates.push({
                range: `${quotedTab(improvementsTab)}!A${rowNumber}:G${rowNumber}`,
                values: [row],
            });
        }
    }

    const staleRanges = [...existingByMetric.entries()]
        .filter(([metric]) => !currentMetrics.has(metric))
        .map(
            ([, rowNumber]) =>
                `${quotedTab(improvementsTab)}!A${rowNumber}:G${rowNumber}`,
        );

    await updateRows(accessToken, spreadsheetId, updates, 0);
    await appendRows(
        accessToken,
        spreadsheetId,
        improvementsTab,
        "G",
        additions,
        0,
    );
    await clearRanges(accessToken, spreadsheetId, staleRanges);
}
