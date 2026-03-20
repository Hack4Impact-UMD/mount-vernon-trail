const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function incrementImprovementCount(
    accessToken: string,
    spreadsheetId: string,
    improvementType: string,
): Promise<void> {
    // gets all values in columns A and B (Improvement Type and Count)
    const rangeRes = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/A:B`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!rangeRes.ok) {
        throw new Error(
            `Failed to read: ${rangeRes.status} ${rangeRes.statusText}`,
        );
    }
    const rangeData = await rangeRes.json();
    const rows: string[][] = rangeData.values ?? [];

    // finds index with matching improvement type
    const rowIndex = rows.findIndex(
        (row) => row[0]?.trim().toLowerCase() === improvementType.trim().toLowerCase(),
    );
    if (rowIndex === -1) {
        throw new Error(`${improvementType} not found`);
    }

    const currentCount = parseInt(rows[rowIndex][1] ?? "0", 10);
    const newCount = (isNaN(currentCount) ? 0 : currentCount) + 1;

    const cellAddress = `B${rowIndex + 1}`;

    const updateRes = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${cellAddress}?valueInputOption=USER_ENTERED`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [[newCount]] }),
        },
    );
    if (!updateRes.ok) {
        throw new Error(
            `Failed to update: ${updateRes.status} ${updateRes.statusText}`,
        );
    }
}
