import * as SecureStore from "expo-secure-store";

const KEYS = {
    ACCESS_TOKEN: "google_access_token",
    REFRESH_TOKEN: "google_refresh_token",
    TOKEN_EXPIRY: "google_token_expiry",
} as const;

export interface StoredTokens {
    accessToken: string;
    refreshToken: string;
    tokenExpiry: number;
}

// set
export async function storeTokens(tokens: StoredTokens): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.refreshToken) {
        await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
    if (tokens.tokenExpiry) {
        const expiresAt = Date.now() + tokens.tokenExpiry * 1000;
        await SecureStore.setItemAsync(KEYS.TOKEN_EXPIRY, expiresAt.toString());
    }
}

// get
export async function getTokens(): Promise<StoredTokens> {
    const accessToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    const tokenExpiryStr = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY);

    return {
        accessToken: accessToken || "",
        refreshToken: refreshToken || "",
        tokenExpiry: tokenExpiryStr ? parseInt(tokenExpiryStr, 10) : 0,
    };
}

export async function isAccessTokenValid(): Promise<boolean> {
    const accessToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
    return accessToken !== null;
}

// delete
export async function deleteTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.TOKEN_EXPIRY);
}
