const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// counts the number of improvement events of each type
export async function getImprovementCounts(
    accessToken: string,
    spreadsheetId: string,
    sheetName = "Sheet1",
): Promise<Record<string, number>> {
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
    if (rows.length === 0) return {};

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const improvementCol = headers.indexOf("improvement");
    if (improvementCol === -1) {
        throw new Error(`"improvement" header not found in row 1`);
    }

    const counts: Record<string, number> = {};
    for (const row of rows.slice(1)) {
        const type = row[improvementCol]?.trim();
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
    // search for column headers "Improvement" & "Date"
    const headerRange = encodeURIComponent(`${sheetName}!1:1`);
    const headerRes = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${headerRange}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!headerRes.ok) {
        throw new Error(
            `Failed to read headers: ${headerRes.status} ${headerRes.statusText}`,
        );
    }
    const headers: string[] = ((await headerRes.json()).values?.[0] ?? []).map(
        (h: string) => h.trim().toLowerCase(),
    );

    const dateCol = headers.indexOf("date");
    const improvementCol = headers.indexOf("improvement");
    if (dateCol === -1 || improvementCol === -1) {
        throw new Error(`"date" and "improvement" headers not found in row 1`);
    }

    // creates new rows
    const numCols = headers.length;
    const row: string[] = new Array(numCols).fill("");
    const d = new Date();
    const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    row[dateCol] = timestamp;
    row[improvementCol] = improvementType;

    const appendRange = encodeURIComponent(`${sheetName}!A:A`);
    const res = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: "POST",
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
