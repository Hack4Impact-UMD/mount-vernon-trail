// Turns a trail event into rows for the Google Sheet.
// Events tab: one row per event, for people to read
// Improvements tab: one row per metric, the format MVT's Looker dashboard parses through

// the event data we need for the sheet, not the whole firestore event
export type SheetEvent = {
    eventId: string;
    title: string;
    date: Date;
    startDate: Date | null;
    endDate: Date | null;
    eventLeader: string;
    metrics?: Record<string, number>;
};

// the 15 metrics from the app (from EventMetrics in frontend/services/event-service.ts)
// if a metric gets added in the app it has to be added here too
// category is the bar it shows up under on MVT's dashboard, null means the dashboard doesn't track it
const METRICS = [
    {
        key: "drainageCleaned",
        label: "Drains / culverts cleaned",
        category: "Drainage",
        unit: "drains",
    },
    {
        key: "graffitiTagsRemoved",
        label: "Graffiti tags removed",
        category: "Graffiti/Stickers",
        unit: "tags",
    },
    {
        key: "stickersRemoved",
        label: "Stickers removed",
        category: "Graffiti/Stickers",
        unit: "stickers",
    },
    {
        key: "otherImprovements",
        label: "Other improvements",
        category: "Other",
        unit: "items",
    },
    {
        key: "itemsPainted",
        label: "Items painted",
        category: "Painting",
        unit: "items",
    },
    {
        key: "pressureWashed",
        label: "Bridges / tunnels pressure washed",
        category: null,
        unit: "structures",
    },
    {
        key: "itemsRepaired",
        label: "Items repaired",
        category: "Repair",
        unit: "items",
    },
    {
        key: "safetyImprovements",
        label: "Safety improvements",
        category: "Safety",
        unit: "improvements",
    },
    {
        key: "snowRemovalEvents",
        label: "Snow removal events",
        category: "Safety",
        unit: "events",
    },
    {
        key: "potholesFilled",
        label: "Potholes / asphalt gaps filled",
        category: "Pothole",
        unit: "potholes",
    },
    {
        key: "trailEdgedFeet",
        label: "Trail edged",
        category: "Trail Edging",
        unit: "feet",
    },
    {
        key: "trashBagsCollected",
        label: "Trash bags collected",
        category: "Trash Cleanup",
        unit: "bags",
    },
    {
        key: "trashPoundsCollected",
        label: "Trash collected",
        category: "Trash Cleanup",
        unit: "lbs",
    },
    {
        key: "treesTrimmed",
        label: "Trees trimmed",
        category: "Tree Trimming",
        unit: "trees",
    },
    {
        key: "vegetationVolunteers",
        label: "Vegetation volunteers",
        category: "Vegetation",
        unit: "volunteers",
    },
];

// header row for the Events tab
export const SHEET_HEADERS = [
    "Event ID",
    "Date",
    "Event",
    "Event Leader",
    "Hours of Service",
    ...METRICS.map((metric) => `${metric.label} (${metric.unit})`),
];

// one row per event, in the same order as SHEET_HEADERS
export function eventToSheetRow(event: SheetEvent): (string | number)[] {
    return [
        event.eventId,
        formatDate(event.date),
        event.title,
        event.eventLeader,
        getHours(event.startDate, event.endDate),
        // missing metrics show up as 0 instead of blank so adding up a column still works
        ...METRICS.map((metric) => event.metrics?.[metric.key] ?? 0),
    ];
}

// header row for the Improvements tab
export const IMPROVEMENT_HEADERS = [
    "Date",
    "Event ID",
    "Event",
    "Category",
    "Improvement",
    "Count",
    "Unit",
];

// one row for each metric the event actually has
// skips metrics that are 0 so the sheet doesn't fill up with empty rows,
// and skips metrics the dashboard doesn't track
export function eventToImprovementRows(
    event: SheetEvent,
): (string | number)[][] {
    const rows: (string | number)[][] = [];
    for (const metric of METRICS) {
        const count = event.metrics?.[metric.key] ?? 0;
        if (count === 0 || metric.category === null) continue;
        rows.push([
            formatDate(event.date),
            event.eventId,
            event.title,
            metric.category,
            metric.label,
            count,
            metric.unit,
        ]);
    }
    return rows;
}

// uses virginia time because the server runs in UTC, so an event at night
// would end up with the next day's date
// en-CA formats the date as YYYY-MM-DD
function formatDate(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// hours of service = end time - start time, rounded to 1 decimal (same as the app)
// if the event never started or ended there are no hours to count
function getHours(startDate: Date | null, endDate: Date | null): number {
    if (!startDate || !endDate) return 0;
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
}
