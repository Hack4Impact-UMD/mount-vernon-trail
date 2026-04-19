import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import { TrailDocStatsCard } from "@/components/ui/trail-doc-stats-card";
import { TrelloAuthError } from "@/services/trello-auth-error";
import { TrelloClient } from "@/services/trello-funcs";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;

export default function TrailDocumentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        eventCardID?: string;
        beforeImageUri?: string;
        afterImageUri?: string;
    }>();
    const eventCardID = params.eventCardID ?? "IpiGZLH0";
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [issuesData, setIssuesData] = useState(
        [] as TrailDocumentIssueItem[],
    );
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [statsData, setStatsData] = useState({
        trashCollection: 0,
        restorationEffort: 0,
    });
    useEffect(() => {
        async function loadTrailDocument() {
            if (!eventCardID) {
                console.error("event card id not found");
                setLoadError("event card ID required");
                return;
            }

            if (!API_KEY) {
                setIssuesError("Missing Trello API Credentials");
                return;
            }
            try {
                const trello = new TrelloClient(API_KEY);
                const eventCard = await trello.getEventCardByID(eventCardID, true);
                const issues = await fetchDocumentTrailIssues(
                    API_KEY,
                    eventCard,
                );
                // TODO fetch stats once that flow is figured out
                const stats = {
                    trashCollection: 12,
                    restorationEffort: 250,
                };
                setIssuesData(issues);
                setStatsData(stats);
            } catch (error) {
                if (error instanceof TrelloAuthError) {
                    setLoadError(error.message);
                    return;
                }
                setLoadError((error as Error).message || "Failed to load trail document");
            }
        }
        loadTrailDocument();
    }, [eventCardID]);

    const beforeImageUri =
        typeof params.beforeImageUri === "string"
            ? params.beforeImageUri
            : null;
    const afterImageUri =
        typeof params.afterImageUri === "string" ? params.afterImageUri : null;

    return (
        // temporary buttons to test navigation to camera view
        /*
        <View>
            <Button title="before" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { mode: 'before' }, 
                })}
            />
            <Button title="after" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { 
                        mode: 'after',
                        beforeImageUri: beforeImageUri ?? "",
                    }, 
                })}
            />
            {beforeImageUri ? (
                <Image
                    source={{ uri: beforeImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No before image yet</Text>
            )}
            {afterImageUri ? (
                <Image
                    source={{ uri: afterImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No after image yet</Text>
            )}
        </View>
        */
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <ScrollView
                    style={styles.container}
                    showsVerticalScrollIndicator={false}>
                    {/* App Header */}
                    <Header userName={""} />
                    <View style={styles.contentContainer}>
                        {/* Page Header*/}
                        {/* TODO replace with actual page header after it is implemented */}
                        <View style={styles.headerSpacer}></View>
                        {/* Trail Issues Section */}
                        <Text style={styles.sectionTitle}>Trail Issues</Text>
                        {loadError && (
                            <Text style={{ color: "red", marginBottom: 12 }}>
                                {loadError}
                            </Text>
                        )}
                        <View style={styles.listContainer}>
                            {issuesData.map((issue) => (
                                <TrailDocIssuesCard
                                    key={issue.id}
                                    id={issue.id}
                                    name={issue.name}
                                    date={issue.creationDate}
                                    imageUrl={issue.imageUrl}
                                />
                            ))}
                        </View>
                        {/* Statistics Section */}
                        <Text style={styles.sectionTitle}>Statistics</Text>
                        <TrailDocStatsCard {...statsData} />
                    </View>
                </ScrollView>
                <BottomNav
                    active={active}
                    onTabPress={(tab) => setActive(tab)}></BottomNav>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    previewImage: {
        width: 180,
        height: 180,
        borderRadius: 12,
        marginTop: 20,
    },
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
    },
    listContainer: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 12,
    },
    headerSpacer: {
        height: 120,
    },
});
