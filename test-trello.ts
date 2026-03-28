// test-trello.ts

import "dotenv/config";

import {
    fetchTrailIssues,
    fetchUpcomingEvents,
} from "./services/trello-service";

async function runIntegrationTests() {
    console.log("Starting Trello Integration Tests...\n");

    const TRELLO_KEY = process.env.TRELLO_API_KEY;
    const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

    if (!TRELLO_KEY || !TRELLO_TOKEN) {
        console.error(
            "❌ Missing TRELLO_KEY or TRELLO_TOKEN in your .env file",
        );
        return;
    }

    try {
        // Test 1: Fetch Issues
        console.log("Testing: fetchTrailIssues()...");
        const issues = await fetchTrailIssues(TRELLO_KEY);
        console.log(`✅ Success! Found ${issues.length} issues.`);
        issues
            .slice(0, 3)
            .forEach((issue) => console.log(`   - ${issue.name}`));
        console.log("   ...");

        // Test 2: Fetch Events
        console.log("\nTesting: fetchUpcomingEvents()...");
        const events = await fetchUpcomingEvents(TRELLO_KEY);
        console.log(`✅ Success! Found ${events.length} upcoming events.`);
        events
            .slice(0, 3)
            .forEach((event) =>
                console.log(
                    `   - [${event.date?.toLocaleDateString()}] ${event.name}`,
                ),
            );
        console.log("   ...");

        console.log("\nAll integration tests passed successfully");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error(`Error Type: ${error.name || "Unknown"}`);
        console.error(`Message: ${error.message}`);
    }
}

runIntegrationTests();
