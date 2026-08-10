import { readFileSync } from "fs";
import { resolve } from "path";

export type ServiceAccount = {
    project_id: string;
    client_email: string;
    private_key: string;
};

function isServiceAccount(value: unknown): value is ServiceAccount {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.project_id === "string" &&
        typeof candidate.client_email === "string" &&
        typeof candidate.private_key === "string"
    );
}

// Accepts either the key file's contents as JSON, or a path to the file.
//
// Inlining is what Render needs (no filesystem to put a key on), but it is
// awkward locally: the private_key field contains literal \n escapes, and
// dotenv expands those into real newlines if the value is double-quoted, which
// silently produces invalid JSON. Pointing at the downloaded file avoids the
// whole class of problem.
export function loadServiceAccount(raw: string, label: string): ServiceAccount {
    const trimmed = raw.trim();
    const looksInline = trimmed.startsWith("{");

    let text = trimmed;
    if (!looksInline) {
        try {
            text = readFileSync(resolve(trimmed), "utf8");
        } catch {
            throw new Error(
                `${label} does not start with "{", so it was treated as a path to a ` +
                    `service-account key file, but "${trimmed}" could not be read.`,
            );
        }
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(
            looksInline
                ? `${label} is not valid JSON. If you inlined the key, make sure the ` +
                  `value is NOT wrapped in quotes — dotenv turns \\n inside a quoted ` +
                  `value into real newlines, which breaks the JSON. Easier: set it to ` +
                  `the path of the downloaded key file instead.`
                : `${label} points at "${trimmed}", but that file is not valid JSON.`,
        );
    }

    if (!isServiceAccount(parsed)) {
        throw new Error(
            `${label} parsed, but is missing project_id, client_email or private_key. ` +
                `Use the full key file from Firebase console -> Project settings -> ` +
                `Service accounts -> Generate new private key.`,
        );
    }
    return parsed;
}
