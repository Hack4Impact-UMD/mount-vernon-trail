export const METRICS_CONFIG = [
    {
        id: "drainage",
        label: "Drainage",
        subtitle: "Drains / culverts cleaned",
        fields: [
            { id: "drainsClean", label: "Drains/culverts cleaned", unit: "drains" }
        ]
    },
    {
        id: "graffiti",
        label: "Graffiti & Stickers",
        fields: [
            { id: "graffitiTags", label: "Graffiti tags removed", unit: "tags" },
            { id: "stickersRemoved", label: "Stickers removed", unit: "stickers" }
        ]
    },
    {
        id: "other",
        label: "Other Improvements",
        fields: [
            { id: "otherImprovements", label: "Other trail improvements", unit: "improvements" }
        ]
    },
    {
        id: "painting",
        label: "Painting",
        fields: [
            { id: "itemsPainted", label: "Signs / stencils / lines / crosswalks painted", unit: "items" }
        ]
    },
    {
        id: "pressureWashing",
        label: "Pressure Washing",
        fields: [
            { id: "structuresWashed", label: "Bridges / tunnels pressure washed", unit: "structures" }
        ]
    },
    {
        id: "repair",
        label: "Repair",
        fields: [
            { id: "itemsRepaired", label: "Items repaired", unit: "items" }
        ]
    },
    {
        id: "safety",
        label: "Safety",
        fields: [
            { id: "safetyImprovements", label: "Safety improvements", unit: "improvements" },
            { id: "snowRemovals", label: "Snow removal volunteer events", unit: "events" }
        ]
    },
    {
        id: "pothole",
        label: "Pothole / Asphalt",
        fields: [
            { id: "potholesFilled", label: "Potholes / asphalt gaps filled", unit: "potholes" }
        ]
    },
    {
        id: "trailEdging",
        label: "Trail Edging",
        fields: [
            { id: "lengthEdged", label: "Length of trail edged (approx.)", unit: "ft" } // is it ft?
        ]
    },
    {
        id: "trash",
        label: "Trash Cleanup",
        fields: [
            { id: "trashBags", label: "Trash bags collected", unit: "bags" },
            { id: "trashPounds", label: "Pounds of trash collected", unit: "lbs" }
        ]
    },
    {
        id: "vegetation",
        label: "Vegetation",
        fields: [
            { id: "treesTrimmed", label: "Trees trimmed", unit: "trees" },
            { id: "vegImprovements", label: "Vegetation improvements (approx. volunteers)", unit: "volunteers" }
        ]
    }
];