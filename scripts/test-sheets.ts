import { createEvent, getImprovementCounts } from "@/api/googleSheetsClient";
import * as dotenv from "dotenv";
dotenv.config();

const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function getAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    const data = await response.json();
    return data.access_token;
}

async function main() {
    if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !SPREADSHEET_ID) {
        console.error(
            "Missing GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_SPREADSHEET_ID in .env",
        );
        return;
    }

    const accessToken = await getAccessToken(
        REFRESH_TOKEN,
        CLIENT_ID,
        CLIENT_SECRET,
    );

    const improvementType = process.argv[2] ?? "Pothole";
    const sheetName = process.argv[3] ?? "Sheet1";

    console.log(`Logging event for: "${improvementType}" on sheet: "${sheetName}"`);
    await createEvent(accessToken, SPREADSHEET_ID, improvementType, sheetName);
    console.log("Done.");

    console.log("Fetching counts...");
    const counts = await getImprovementCounts(accessToken, SPREADSHEET_ID, sheetName);
    console.log("Improvement counts:", counts);
}

(async () => {
    await main();
})();
