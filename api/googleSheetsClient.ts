const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

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
    const timestamp = new Date().toISOString();
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
