import { listAlbums, type GooglePhotosAlbum } from "@/api/googlePhotosClient";
import { getValidAccessToken } from "@/auth/google-auth";
import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// Google Photos API return mediaItemsCount as string instead of number
// Created a new type that has mediaItemsCount as number
type NormalizedAlbum = Omit<GooglePhotosAlbum, "mediaItemsCount"> & {
    mediaItemsCount: number | null;
    appCreatedAt?: number;
};
async function getAlbumMeta() {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, "albums"));
    const map: Record<string, number> = {};
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.albumId && data.createdAt) {
            map[data.albumId] = data.createdAt.toMillis();
        }
    });
    return map;
}

async function fetchAllAlbums(
    accessToken: string,
): Promise<NormalizedAlbum[]> {
    const all: NormalizedAlbum[] = [];
    let pageToken: string | undefined;
    const metaMap = await getAlbumMeta();
    do {
        const { albums, nextPageToken } = await listAlbums(
            accessToken,
            pageToken,
        );
        const normalized = await Promise.all(
            albums.map(async (a) => {
                return {
                    ...a,
                    mediaItemsCount: a.mediaItemsCount ? Number(a.mediaItemsCount) : null,
                    appCreatedAt: metaMap[a.id],
                };
            })
        );
        all.push(...normalized);
        pageToken = nextPageToken;
    } while (pageToken);
    return all;
}

function formatDate(value?: string | number): string {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function AlbumCard({ album }: { album: NormalizedAlbum }) {
    const [favorited, setFavorited] = useState(false);
    const photoCount = album.mediaItemsCount ?? null;
    const coverUrl = album.coverPhotoBaseUrl
        ? `${album.coverPhotoBaseUrl}=w600-h300-c`
        : null;

    useEffect(() => {
        AsyncStorage.getItem(`favorite:${album.id}`).then((val) => {
            if (val !== null) setFavorited(val === "true");
        });
    }, [album.id]);

    const toggleFavorite = async () => {
        const next = !favorited;
        setFavorited(next);
        await AsyncStorage.setItem(`favorite:${album.id}`, String(next));
    };

    return (
        <View style={styles.cardShadow}>
            <View style={styles.card}>
                <View style={styles.coverWrap}>
                    {coverUrl ? (
                        <Image
                            source={{ uri: coverUrl }}
                            style={styles.coverImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.coverImage, styles.coverPlaceholder]}>
                            <Text style={styles.coverPlaceholderCount}>
                                {photoCount ?? ""}
                            </Text>
                        </View>
                    )}
                    <Pressable
                    style={[
                        styles.starBadge,
                        favorited
                            ? styles.starBadgeFavorited
                            : styles.starBadgeUnfavorited,
                    ]}
                    onPress={toggleFavorite}
                    hitSlop={8}>
                        <MaterialIcons
                            name="star"
                            size={favorited ? 22 : 18}
                            color="#fff"
                        />
                    </Pressable>
                </View>
                <View style={styles.cardFooter}>
                    <View style={styles.cardFooterLeft}>
                        <Text
                            style={styles.albumTitle}
                            numberOfLines={1}>
                            {album.title}
                        </Text>
                        <View style={styles.dateRow}>
                            <MaterialIcons
                                name="calendar-today"
                                size={14}
                                color="#6D6E71"
                            />
                            <Text style={styles.albumDate}>
                                {album.appCreatedAt ? formatDate(album.appCreatedAt) : ""}
                            </Text>
                        </View>
                    </View>
                    {photoCount && (
                        <View style={styles.photoBadge}>
                            <Text style={styles.photoBadgeText}>
                                {photoCount} photo{photoCount !== 1 ? "s" : ""}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function AlbumsScreen() {
    const isAdmin = useIsAdmin();
    const [albums, setAlbums] = useState<NormalizedAlbum[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAlbums = useCallback(async () => {
        setError(null);
        try {
            const token = await getValidAccessToken();
            if (!token) {
                setError(
                    "Not signed in or session expired. Please sign in again.",
                );
                return;
            }
            const data = await fetchAllAlbums(token);
            setAlbums(data);
        } catch (e) {
            setError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        loadAlbums().finally(() => setLoading(false));
    }, [loadAlbums, isAdmin]);

    const handleRefresh = useCallback(async () => {
        if (!isAdmin) return;
        setRefreshing(true);
        await loadAlbums();
        setRefreshing(false);
    }, [loadAlbums, isAdmin]);

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.centered}>
                    <ActivityIndicator
                        size="large"
                        color={Palette.primaryPurple100}
                    />
                </View>
            );
        }
        if (!isAdmin) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="lock-outline"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.emptyText}>
                        Albums are only accessible to the admin account.
                    </Text>
                </View>
            );
        }
        if (error) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="error-outline"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable
                        style={styles.retryButton}
                        onPress={handleRefresh}>
                        <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                </View>
            );
        }
        if (albums.length === 0) {
            return (
                <View style={styles.centered}>
                    <MaterialIcons
                        name="photo-library"
                        size={48}
                        color="#ccc"
                    />
                    <Text style={styles.emptyText}>No albums yet.</Text>
                </View>
            );
        }
        return (
            <>
                {albums.map((album) => (
                    <AlbumCard
                        key={album.id}
                        album={album}
                    />
                ))}
            </>
        );
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <Header />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={Palette.primaryPurple100}
                        />
                    }>
                    <View style={styles.headingRow}>
                        <Text style={styles.heading}>Albums</Text>
                        {isAdmin && !loading && !error && albums.length > 0 && (
                            <Text style={styles.albumCount}>
                                {albums.length} album
                                {albums.length !== 1 ? "s" : ""}
                            </Text>
                        )}
                    </View>
                    {renderContent()}
                </ScrollView>
                <BottomNav />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
        gap: 16,
    },
    headingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 4,
    },
    heading: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    albumCount: {
        fontSize: 14,
        color: "#888",
        fontFamily: "Lato_400Regular",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingBottom: 15,
        overflow: "hidden",
    },
    cardShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
        borderRadius: 16,
    },
    coverWrap: {
        position: "relative",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
    },
    coverImage: {
        width: "100%",
        height: 160,
        backgroundColor: Palette.teal,
        elevation: 2,
    },
    coverPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },
    coverPlaceholderCount: {
        fontSize: 52,
        fontWeight: "700",
        color: "rgba(255,255,255,0.4)",
        fontFamily: "Lato_700Bold",
    },
    starBadge: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    starBadgeFavorited: {
        backgroundColor: "#FFD700",
    },
    starBadgeUnfavorited: {
        backgroundColor: "#AAAAAA",
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
    },
    cardFooterLeft: {
        flex: 1,
        gap: 4,
    },
    albumTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
        fontFamily: "Lato_700Bold",
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 5,
    },
    albumDate: {
        fontSize: 12,
        color: "#6D6E71",
        fontFamily: "Lato_400Regular",
    },
    photoBadge: {
        backgroundColor: "#F5F5F5",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    photoBadgeText: {
        fontSize: 12,
        color: "#939598",
        fontWeight: "600",
        fontFamily: "Lato_700Bold",
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: "#888",
        textAlign: "center",
        maxWidth: 240,
        fontFamily: "Lato_400Regular",
    },
    errorText: {
        fontSize: 13,
        color: "#c0392b",
        textAlign: "center",
        maxWidth: 260,
        fontFamily: "Lato_400Regular",
    },
    retryButton: {
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: Palette.primaryPurple100,
        borderRadius: 8,
    },
    retryText: {
        color: "#fff",
        fontWeight: "600",
        fontFamily: "Lato_700Bold",
    },
});
