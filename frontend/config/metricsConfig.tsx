import React from "react";
import { Feather } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";
import { Subtitles } from "lucide-react-native";
export type MetricField = {
    id: string;
    label: string;
    unit: string;
};

export type MetricCategoryConfig = {
    id: string;
    label: string;
    subtitle: string;
    color: string;
    icon: React.ReactNode;
    fields: MetricField[];
};

export const METRICS_CONFIG = [
    {
        id: "drainage",
        label: "Drainage",
        subtitle: "Drains / culverts cleaned",
        color: "#0EA5E9",
        icon: <Feather name="droplet" size={20} color="#0EA5E9" />,
        fields: [
            { id: "drainsClean", label: "Drains/culverts cleaned", unit: "drains" }
        ]
    },
    {
        id: "graffiti",
        label: "Graffiti & Stickers",
        subtitle: "2 metrics",
        color: "#F59E0B",
        icon: <Feather name="tag" size={20} color="#F59E0B" />,
        fields: [
            { id: "graffitiTags", label: "Graffiti tags removed", unit: "tags" },
            { id: "stickersRemoved", label: "Stickers removed", unit: "stickers" }
        ]
    },
    {
        id: "other",
        label: "Other Improvements",
        subtitle: "Other trail improvements",
        color: "#6B7280",
        icon: <Feather name="star" size={20} color="#6B7280" />,
        fields: [
            { id: "otherImprovements", label: "Other trail improvements", unit: "improvements" }
        ]
    },
    {
        id: "painting",
        label: "Painting",
        subtitle: "Signs / stencils / lines / crosswalks painted",
        color: "#2D8682",
        icon: <Feather name="edit-3" size={20} color="#2D8682" />,
        fields: [
            { id: "itemsPainted", label: "Signs / stencils / lines / crosswalks painted", unit: "items" }
        ]
    },
    {
        id: "pressureWashing",
        label: "Pressure Washing",
        subtitle: "Bridges / tunnels pressure washed",
        color: "#3B82F6",
        icon: <Feather name="wind" size={20} color="#3B82F6" />,
        fields: [
            { id: "structuresWashed", label: "Bridges / tunnels pressure washed", unit: "structures" }
        ]
    },
    {
        id: "repair",
        label: "Repair",
        subtitle: "Items repaired",
        color: "#693894",
        icon: <Feather name="tool" size={20} color="#693894" />,
        fields: [
            { id: "itemsRepaired", label: "Items repaired", unit: "items" }
        ]
    },
    {
        id: "safety",
        label: "Safety",
        subtitle: "2 metrics",
        color: "#EF4444",
        icon: <Feather name="shield" size={20} color="#EF4444" />,
        fields: [
            { id: "safetyImprovements", label: "Safety improvements", unit: "improvements" },
            { id: "snowRemovals", label: "Snow removal volunteer events", unit: "events" }
        ]
    },
    {
        id: "pothole",
        label: "Pothole / Asphalt",
        subtitle: "Potholes / asphalt gaps filled",
        color: "#D97706",
        icon: <Feather name="alert-circle" size={20} color="#D97706" />,
        fields: [
            { id: "potholesFilled", label: "Potholes / asphalt gaps filled", unit: "potholes" }
        ]
    },
    {
        id: "trailEdging",
        label: "Trail Edging",
        subtitle: "Length of trail edged (approx.)",
        color: "#059669",
        icon: <Feather name="scissors" size={20} color="#059669" />,
        fields: [
            { id: "lengthEdged", label: "Length of trail edged (approx.)", unit: "ft" } // is it ft?
        ]
    },
    {
        id: "trash",
        label: "Trash Cleanup",
        subtitle: "2 metrics",
        color: "#3BA34C",
        icon: <Feather name="trash-2" size={20} color="#3BA34C" />,
        fields: [
            { id: "trashBags", label: "Trash bags collected", unit: "bags" },
            { id: "trashPounds", label: "Pounds of trash collected", unit: "lbs" }
        ]
    },
    {
        id: "vegetation",
        label: "Vegetation",
        subtitle: "2 metrics",
        color: "#65A30D",
        icon: <FontAwesome name="leaf" size={20} color="#65A30D" />,
        fields: [
            { id: "treesTrimmed", label: "Trees trimmed", unit: "trees" },
            { id: "vegImprovements", label: "Vegetation improvements (approx. volunteers)", unit: "volunteers" }
        ]
    }
];