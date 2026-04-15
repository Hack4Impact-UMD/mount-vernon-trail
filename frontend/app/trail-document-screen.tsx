import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import { TrailDocStatsCard } from "@/components/ui/trail-doc-stats-card";
import { TrelloClient } from "@/services/trello-funcs";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// TODO remove this after trello auth is done
const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN;

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

            if (!API_KEY || !API_TOKEN) {
                setIssuesError("Missing Trello API Credentials");
                return;
            }
            const trello = new TrelloClient(API_KEY, API_TOKEN);
            const eventCard = await trello.getEventCardByID(eventCardID, true);
            const issues = await fetchDocumentTrailIssues(
                API_KEY,
                API_TOKEN,
                eventCard,
            );
            // TODO fetch stats once that flow is figured out
            const stats = {
                trashCollection: 12,
                restorationEffort: 250,
            };
            setIssuesData([
                {
                    id: "mock-issue-1",
                    name: "Fallen Tree on Main Trail",
                    creationDate: new Date(),
                    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Usamljeni_jasen_-_panoramio_%28cropped%29.jpg", // Placeholder image
                },
                {
                    id: "mock-issue-2",
                    name: "Washed out bridge",
                    creationDate: new Date(),
                    imageUrl: "https://www.nps.gov/neri/planyourvisit/images/web_NRG-Bridge_Louise_McLaughlin-_longer.jpg?maxwidth=1300&maxheight=1300&autorotate=false&format=webp", // Placeholder image
                },
            ]);
            setStatsData(stats);
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
