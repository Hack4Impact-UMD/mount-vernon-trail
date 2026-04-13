import BottomNav from "@/components/ui/bottom-nav";
import HomeHeader from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import { TrailDocStatsCard } from "@/components/ui/trail-doc-stats-card";
import TrailEventHeader from "@/components/ui/trail-event-header";
import type { Event } from "@/services/event-service";
import { getEventById } from "@/services/event-service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

export default function TrailDocumentScreen() {
    const router = useRouter();
    // Event loading state
    const [event, setEvent] = useState<Event>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    // Trail issue, state, and camera state
    const { beforeImageUri, afterImageUri, activeIssueId, eventId } = useLocalSearchParams<{
        beforeImageUri?: string;
        afterImageUri?: string;
        activeIssueId?: string;
        eventId: string;
    }>();
    const [issuesData, setIssuesData] = useState([] as TrailDocumentIssueItem[]);
    const [issueImages, setIssueImages] = useState<Record<string, { before?: string; after?: string }>>({});
    const [statsData, setStatsData] = useState({
        trashCollection: 0,
        restorationEffort: 0,
    });
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");
    
    useEffect(() => {
        if (!eventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }
        getEventById(eventId)
            .then((e) => {
                if (e) setEvent(e);
                else setError("Event not found.");
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [eventId]);
  
    // TODO fetch stats once that flow is figured out
    useEffect(() => {
      if (!event) return;
      setStatsData({ trashCollection: 12, restorationEffort: 250 });
      setIssuesData([]);  // placeholder until real fetch is implemented
    }, [event]);
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
    if (loading) return <ActivityIndicator style={styles.loader} />;
    if (error || !event) return (
        <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error ?? "Event not found."}</Text>
        </View>
    );
    return (
        <>
            <View style={styles.screen}>
              <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <HomeHeader userName="Sarah" />
                <TrailEventHeader
                    event={event}
                    variant="document"
                    onStop={() =>
                        router.replace({
                            pathname: "/event-summary",
                            params: { eventId: event.eventId },
                        })
                    }
                />
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
            <BottomNav active={active} onTabPress={(tab) => setActive(tab)} />
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
    loader: {
        flex: 1,
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
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    errorText: {
        fontSize: 15,
        color: "#888",
        textAlign: "center",
    },
});