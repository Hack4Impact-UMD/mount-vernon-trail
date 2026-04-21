// Error codes for Trello auth failures
export type TrelloAuthErrorCode =
    | "TOKEN_EXPIRED"
    | "PERMISSION_DENIED"
    | "NETWORK_ERROR"
    | "AUTH_CANCELLED"
    | "AUTH_FAILED";

export const TRELLO_ERROR_MESSAGES: Record<TrelloAuthErrorCode, string> = {
    TOKEN_EXPIRED: "Your Trello session has expired. Please sign in again.",
    PERMISSION_DENIED:"Trello access was denied. Please grant permission to continue.",
    NETWORK_ERROR: "Unable to reach Trello. Check your connection and try again.",
    AUTH_CANCELLED: "Trello sign-in was cancelled.",
    AUTH_FAILED: "Something went wrong connecting to Trello. Please try again.",
};

export class TrelloAuthError extends Error {
    public readonly code: TrelloAuthErrorCode;

    constructor(code: TrelloAuthErrorCode, message?: string) {
        super(message ?? TRELLO_ERROR_MESSAGES[code]);
        this.code = code;
        this.name = "TrelloAuthError";
    }
}