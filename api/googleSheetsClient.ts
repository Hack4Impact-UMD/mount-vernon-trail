const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const HEADER_SEARCH_LIMIT = 50; // the search limit for headers to prevent an empty sheet

// searches the first 50 rows for a row containing all required headers
// returns { headerRowIndex, columns }
// maps column name to  index
async function findHeaderRow(
    accessToken: string,
    spreadsheetId: string,
    sheetName: string,
    required: string[],
): Promise<{
    headerRowIndex: number;
    columns: Record<string, number>;
    rows: string[][];
}> {
    const range = encodeURIComponent(`${sheetName}!1:1000`);
    const res = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to read sheet: ${res.status} ${res.statusText}`,
        );
    }
    const rows: string[][] = (await res.json()).values ?? [];

    for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_LIMIT); i++) {
        const normalized = rows[i].map((h) => h.trim().toLowerCase());
        const columns: Record<string, number> = {};
        let allFound = true;
        for (const header of required) {
            const idx = normalized.indexOf(header);
            if (idx === -1) {
                allFound = false;
                break;
            }
            columns[header] = idx;
        }
        if (allFound) return { headerRowIndex: i, columns, rows };
    }

    throw new Error(
        `Headers [${required.join(", ")}] not found in first ${HEADER_SEARCH_LIMIT} rows of "${sheetName}"`,
    );
}

// counts the number of improvement events of each type
export async function getImprovementCounts(
    accessToken: string,
    spreadsheetId: string,
    sheetName = "Sheet1",
): Promise<Record<string, number>> {
    const { headerRowIndex, columns, rows } = await findHeaderRow(
        accessToken,
        spreadsheetId,
        sheetName,
        ["improvement"],
    );

    const counts: Record<string, number> = {};
    for (const row of rows.slice(headerRowIndex + 1)) {
        const type = row[columns["improvement"]]?.trim();
        if (type) counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
}

// creates an improvement event within sheets
export async function createEvent(
    accessToken: string,
    spreadsheetId: string,
    improvementType: string,
    sheetName = "Sheet1",
): Promise<void> {
    const { columns, rows } = await findHeaderRow(
        accessToken,
        spreadsheetId,
        sheetName,
        ["date", "improvement"],
    );

    const numCols = rows[0].length;
    const row: string[] = new Array(numCols).fill("");
    const d = new Date();
    const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    row[columns["date"]] = timestamp;
    row[columns["improvement"]] = improvementType;

    const nextRow = rows.length + 1;
    const writeRange = encodeURIComponent(`${sheetName}!A${nextRow}`);
    const res = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [row] }),
        },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to append row: ${res.status} ${res.statusText}`,
        );
    }
}
