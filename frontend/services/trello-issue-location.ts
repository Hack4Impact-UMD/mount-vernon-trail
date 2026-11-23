import { TRAIL_LANDMARKS } from "./trail-landmark-service";
import type { Card } from "./trello-types";
import type { MapLocation } from "./map-service";

const NUMBER = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
const PAIR = new RegExp(`^(${NUMBER})\\s*,\\s*(${NUMBER})$`);

function point(latitude: string, longitude: string): [number, number] | null {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
        ? [lng, lat]
        : null;
}

function coordinatesFromUrl(value: string): [number, number] | null {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        const host = url.hostname.toLowerCase();
        const google =
            /^(?:www\.)?google\.com$/.test(host) || host === "maps.google.com";
        const apple = host === "maps.apple.com";
        const osm =
            host === "www.openstreetmap.org" || host === "openstreetmap.org";
        if (!google && !apple && !osm) return null;
        if (osm) {
            const lat = url.searchParams.get("mlat");
            const lng = url.searchParams.get("mlon");
            return lat !== null && lng !== null && lat.trim() && lng.trim()
                ? point(lat, lng)
                : null;
        }
        // Only explicit destination coordinates count; a map's viewport is not a pin.
        for (const field of google ? ["query", "q", "destination"] : ["ll"]) {
            const match = PAIR.exec((url.searchParams.get(field) ?? "").trim());
            if (match) return point(match[1], match[2]);
        }
        return null;
    } catch {
        return null;
    }
}

/** Read explicit source coordinates; never geocode an issue title or guess a site. */
export function resolveTrelloIssueLocation(card: Card): MapLocation | null {
    const text = `${card.name}\n${card.desc ?? ""}`;
    const lat = new RegExp(
        `^\\s*(?:#+\\s*)?(?:latitude|lat)\\s*:\\s*(${NUMBER})\\s*$`,
        "im",
    ).exec(text);
    const lng = new RegExp(
        `^\\s*(?:#+\\s*)?(?:longitude|lng|lon)\\s*:\\s*(${NUMBER})\\s*$`,
        "im",
    ).exec(text);
    const pair = new RegExp(
        `^\\s*(?:#+\\s*)?(?:coordinates|gps)\\s*:\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*$`,
        "im",
    ).exec(text);
    let coordinates =
        lat && lng
            ? point(lat[1], lng[1])
            : pair
              ? point(pair[1], pair[2])
              : null;
    const candidates = [
        ...(text.match(/https?:\/\/[^\s<>\[\]()]+/g) ?? []),
        ...(card.attachments ?? []).map((attachment) => attachment.url),
    ];
    if (!coordinates) {
        for (const candidate of candidates) {
            coordinates = coordinatesFromUrl(candidate);
            if (coordinates) break;
        }
    }
    if (!coordinates) return null;
    const name = /^\s*(?:#+\s*)?location\s*:\s*(.+)$/im.exec(card.desc ?? "");
    return {
        coordinates,
        locationName: name?.[1].trim() || card.name,
        eventNames: [],
    };
}

/** Match only a known prefix, with a boundary so B1 never matches B10. */
export function resolveTitleIssueLocation(card: Card): MapLocation | null {
    const normalize = (value: string) =>
        value.toLowerCase().replace(/\s+/g, " ").trim();
    const title = normalize(card.name).replace(/^\[\s*/, "");
    const matches = TRAIL_LANDMARKS.flatMap((landmark) => {
        const number = landmark.location_name.match(/\d+(?:\.\d+)?$/)?.[0];
        const aliases = [
            landmark.location_name,
            landmark.abbreviation,
            ...(landmark.aliases ?? []),
        ];
        if (landmark.kind === "bridge" && number)
            aliases.push(`Bridge #${number}`, `Bridge#${number}`);
        if (landmark.kind === "mile-marker" && number)
            aliases.push(`MM${number}`, `MM ${number}`, `Mile ${number}`);
        return aliases
            .map(normalize)
            .filter((alias) => {
                if (!title.startsWith(alias)) return false;
                const rest = title.slice(alias.length);
                // A decimal suffix is not a separator (M4.5 must not resolve to M4).
                return !rest || /^(?:[\s\]:,;–—-]|\.(?!\d))/.test(rest);
            })
            .map((alias) => ({ landmark, length: alias.length }));
    }).sort((a, b) => b.length - a.length);
    if (!matches.length) return null;
    const best = matches.filter((match) => match.length === matches[0].length);
    if (new Set(best.map(({ landmark }) => landmark.id)).size !== 1)
        return null;
    const landmark = best[0].landmark;
    return {
        coordinates: [
            landmark.coordinates.longitude,
            landmark.coordinates.latitude,
        ],
        locationName: landmark.location_name,
        eventNames: [],
    };
}
