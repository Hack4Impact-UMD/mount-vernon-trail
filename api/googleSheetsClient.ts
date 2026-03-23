const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function createEvent(
    accessToken: string,
    spreadsheetId: string,
    improvementType: string,
    sheetName = "Sheet1",
): Promise<void> {
    const timestamp = new Date().toISOString();
    const range = encodeURIComponent(`${sheetName}!A:B`);

    const res = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [[timestamp, improvementType]] }),
        },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to append row: ${res.status} ${res.statusText}`,
        );
    }
}
