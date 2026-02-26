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
export async function storeTokens(
    accessToken: string,
    refreshToken?: string | null,
    tokenExpiry?: number | null,
): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
        await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
    }
    if (tokenExpiry) {
        const expiresAt = Date.now() + tokenExpiry * 1000;
        await SecureStore.setItemAsync(KEYS.TOKEN_EXPIRY, expiresAt.toString());
    }
}

// get
export async function getStoredTokens(): Promise<StoredTokens> {
    const accessToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    const tokenExpiryStr = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY);

    return {
        accessToken: accessToken || "",
        refreshToken: refreshToken || "",
        tokenExpiry: tokenExpiryStr ? parseInt(tokenExpiryStr, 10) : 0,
    };
}

export async function getAccessToken(): Promise<string | null> {
    const { accessToken, tokenExpiry } = await getStoredTokens();
    if (!accessToken) {
        return null;
    }
    if (tokenExpiry && Date.now() >= tokenExpiry) {
        return null;
    }
    return accessToken;
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
