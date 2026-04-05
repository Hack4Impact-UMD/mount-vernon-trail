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
        activeIssueId?: string;
    }>();
    const eventCardID = params.eventCardID;
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");
    const [issuesData, setIssuesData] = useState([] as TrailDocumentIssueItem[]);
    const [statsData, setStatsData] = useState({
        trashCollection: 0,
        restorationEffort: 0,
    });
    useEffect(() => {
        async function loadTrailDocument() {
            if (!eventCardID) {
                console.error("event card id not found");
                return;
            }

            if(!API_KEY || !API_TOKEN){
                console.error("Missing Trello API Credentials");
                return;
            }
            try {
                const trello = new TrelloClient(API_KEY, API_TOKEN);
                const eventCard = await trello.getEventCardByID(eventCardID, true);
                const issues = await fetchDocumentTrailIssues(API_KEY, API_TOKEN, eventCard);
                // TODO fetch stats once that flow is figured out
                const stats = {
                    trashCollection: 12,
                    restorationEffort: 250,
                }
                setIssuesData(issues);
                setStatsData(stats);
            } catch (error) {
                console.error("Error loading trail document:", error);
            }
        }
        loadTrailDocument();
    }, [eventCardID]);

    const activeIssueId = params.activeIssueId ?? null;
    const beforeImageUri = typeof params.beforeImageUri === "string" ? params.beforeImageUri : null;
    const afterImageUri = typeof params.afterImageUri === "string" ? params.afterImageUri : null;
    const [issueImages, setIssueImages] = useState<Record<string, { before?: string; after?: string }>>({});
    // when the user returns from camera-view, store the captured image under the correct issue
    useEffect(() => {
        if (activeIssueId && (beforeImageUri || afterImageUri)) {
            setIssueImages(prev => ({
                ...prev,
                [activeIssueId]: {
                    before: beforeImageUri ?? prev[activeIssueId]?.before,
                    after: afterImageUri ?? prev[activeIssueId]?.after,
                }
            }));
        }
    }, [activeIssueId, beforeImageUri, afterImageUri]);
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    {/* App Header */}
                    <Header userName={null} />
                    <View style={styles.contentContainer}>
                        {/* Page Header*/ } 
                        {/* TODO replace with actual page header after it is implemented */}
                        <View style={styles.headerSpacer}></View>
                        {/* Trail Issues Section */}
                        <Text style={styles.sectionTitle}>Trail Issues</Text>
                        <View style={styles.listContainer}>
                            {issuesData.map((issue) => (
                                <TrailDocIssuesCard
                                    key={issue.id}
                                    id={issue.id}
                                    name={issue.name}
                                    date={issue.creationDate}
                                    imageUrl={issue.imageUrl}
                                    beforeImageUri={issueImages[issue.id]?.before ?? null}
                                    afterImageUri={issueImages[issue.id]?.after ?? null}
                                    onCameraPress={(mode) =>
                                        router.push({
                                            pathname: '/camera-view',
                                            params: {
                                                mode,
                                                activeIssueId: issue.id,
                                                beforeImageUri: issueImages[issue.id]?.before ?? '',
                                            },
                                        })
                                    }
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
                    onTabPress={(tab) => setActive(tab)}
                ></BottomNav>
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
        fontWeight: '700',
        marginBottom: 12,
    },
    headerSpacer: {
        height: 120
    }
});