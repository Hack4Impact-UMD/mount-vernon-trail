const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const HEADER_SEARCH_LIMIT = 50;

// changecolumn index to letter
function colLetter(index: number): string {
    let letter = "";
    let n = index;
    while (n >= 0) {
        letter = String.fromCharCode((n % 26) + 65) + letter;
        n = Math.floor(n / 26) - 1;
    }
    return letter;
}

export async function incrementImprovementCount(
    accessToken: string,
    spreadsheetId: string,
    improvementType: string,
): Promise<void> {
    const rangeRes = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/A1:Z1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!rangeRes.ok) {
        throw new Error(
            `Failed to read: ${rangeRes.status} ${rangeRes.statusText}`,
        );
    }
    const rows: string[][] = (await rangeRes.json()).values ?? [];

    if (rows.length === 0) {
        throw new Error("Sheet is empty");
    }

    // finds header row
    let headerRowIndex = -1;
    let typeCol = -1;
    let countCol = -1;
    for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_LIMIT); i++) {
        const cols = rows[i].map((h) => h.trim().toLowerCase());
        const t = cols.indexOf("improvement type");
        const c = cols.indexOf("count");
        if (t !== -1 && c !== -1) {
            headerRowIndex = i;
            typeCol = t;
            countCol = c;
            break;
        }
    }
    if (headerRowIndex === -1) {
        throw new Error(
            `"Improvement Type" and "Count" headers not found in first ${HEADER_SEARCH_LIMIT} rows`,
        );
    }

    // finds which row matches improvement type
    const rowIndex = rows.findIndex(
        (row, i) =>
            i > headerRowIndex &&
            row[typeCol]?.trim().toLowerCase() === improvementType.trim().toLowerCase(),
    );
    if (rowIndex === -1) {
        throw new Error(`"${improvementType}" not found in sheet`);
    }

    const currentCount = parseInt(rows[rowIndex][countCol] ?? "0", 10);
    const newCount = (isNaN(currentCount) ? 0 : currentCount) + 1;

    const cellAddress = `${colLetter(countCol)}${rowIndex + 1}`;

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
