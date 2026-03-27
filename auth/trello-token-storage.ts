import * as SecureStore from "expo-secure-store";

const TRELLO_TOKEN_KEY = "trello_user_token";
const TRELLO_TOKEN_EXPIRY_KEY = "trello_token_expiry";



// Save the Trello oauth token
//  expiresInDays defaults to 30 (matching our Trello OAuth config). 
export async function saveTrelloToken(
    token: string,
    expiresInDays: number | null = 30,
): Promise<void> {
    await SecureStore.setItemAsync(TRELLO_TOKEN_KEY, token);

    if (expiresInDays !== null) {
        const expiryMs = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
        await SecureStore.setItemAsync(
            TRELLO_TOKEN_EXPIRY_KEY,
            expiryMs.toString(),
        );
    } else {
        await SecureStore.deleteItemAsync(TRELLO_TOKEN_EXPIRY_KEY);
    }
}

// retrieval of the stored trello token
// rejects expired tokens
export async function getTrelloToken(): Promise<string | null> {
    const token = await SecureStore.getItemAsync(TRELLO_TOKEN_KEY);
    if (!token) return null;

    const expiryStr = await SecureStore.getItemAsync(TRELLO_TOKEN_EXPIRY_KEY);
    if (expiryStr) {
        const expiryMs = parseInt(expiryStr, 10);
        if (Date.now() > expiryMs) {
            await clearTrelloToken();
            return null;
        }
    }

    return token;
}

/**
 * Remove the stored Trello token and expiry.
 * Call on logout, revocation, or when re-auth is needed.
 */
export async function clearTrelloToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TRELLO_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TRELLO_TOKEN_EXPIRY_KEY);
}

/**
 * Check whether a Trello token exists and hasn't expired locally.
 * Does NOT validate the token against the Trello API.
 */
export async function hasTrelloToken(): Promise<boolean> {
    const token = await getTrelloToken();
    return token !== null;
}