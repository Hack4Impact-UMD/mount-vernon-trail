import React from "react";
import { Feather } from "@expo/vector-icons";

export type MetricField = {
    id: string;
    label: string;
    unit: string;
};

export type MetricCategoryConfig = {
    id: string;
    label: string;
    subtitle?: string;
    color: string;
    icon: React.ReactNode;
    fields: MetricField[];
};

export const METRICS_CONFIG = [
    {
        id: "drainage",
        label: "Drainage",
        subtitle: "Drains / culverts cleaned",
        color: "#0EA5E915",
        icon: <Feather name="droplet" size={18} color="#0EA5E9" />,
        fields: [
            { id: "drainsClean", label: "Drains/culverts cleaned", unit: "drains" }
        ]
    },
    {
        id: "graffiti",
        label: "Graffiti & Stickers",
        color: "#F59E0B15",
        icon: <Feather name="tag" size={18} color="#F59E0B" />,
        fields: [
            { id: "graffitiTags", label: "Graffiti tags removed", unit: "tags" },
            { id: "stickersRemoved", label: "Stickers removed", unit: "stickers" }
        ]
    },
    {
        id: "other",
        label: "Other Improvements",
        color: "#6B728015",
        icon: <Feather name="star" size={18} color="#6B7280" />,
        fields: [
            { id: "otherImprovements", label: "Other trail improvements", unit: "improvements" }
        ]
    },
    {
        id: "painting",
        label: "Painting",
        color: "#2D868215",
        icon: <Feather name="edit-2" size={18} color="#2D8682" />,
        fields: [
            { id: "itemsPainted", label: "Signs / stencils / lines / crosswalks painted", unit: "items" }
        ]
    },
    {
        id: "pressureWashing",
        label: "Pressure Washing",
        color: "#3B82F615",
        icon: <Feather name="wind" size={18} color="#3B82F6" />,
        fields: [
            { id: "structuresWashed", label: "Bridges / tunnels pressure washed", unit: "structures" }
        ]
    },
    {
        id: "repair",
        label: "Repair",
        color: "#69389415",
        icon: <Feather name="tool" size={18} color="#693894" />,
        fields: [
            { id: "itemsRepaired", label: "Items repaired", unit: "items" }
        ]
    },
    {
        id: "safety",
        label: "Safety",
        color: "#EF444415",
        icon: <Feather name="shield" size={18} color="#EF4444" />,
        fields: [
            { id: "safetyImprovements", label: "Safety improvements", unit: "improvements" },
            { id: "snowRemovals", label: "Snow removal volunteer events", unit: "events" }
        ]
    },
    {
        id: "pothole",
        label: "Pothole / Asphalt",
        color: "#D9770615",
        icon: <Feather name="alert-circle" size={18} color="#D97706" />,
        fields: [
            { id: "potholesFilled", label: "Potholes / asphalt gaps filled", unit: "potholes" }
        ]
    },
    {
        id: "trailEdging",
        label: "Trail Edging",
        color: "#05966915",
        icon: <Feather name="scissors" size={18} color="#059669" />,
        fields: [
            { id: "lengthEdged", label: "Length of trail edged (approx.)", unit: "ft" } // is it ft?
        ]
    },
    {
        id: "trash",
        label: "Trash Cleanup",
        color: "#3BA34C15",
        icon: <Feather name="trash-2" size={18} color="#3BA34C" />,
        fields: [
            { id: "trashBags", label: "Trash bags collected", unit: "bags" },
            { id: "trashPounds", label: "Pounds of trash collected", unit: "lbs" }
        ]
    },
    {
        id: "vegetation",
        label: "Vegetation",
        color: "#65A30D15",
        icon: <Feather name="feather" size={18} color="#65A30D" />,
        fields: [
            { id: "treesTrimmed", label: "Trees trimmed", unit: "trees" },
            { id: "vegImprovements", label: "Vegetation improvements (approx. volunteers)", unit: "volunteers" }
        ]
    }
];