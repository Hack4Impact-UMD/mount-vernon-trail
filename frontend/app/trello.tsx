import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { TrailIssuesCard, type TrailIssueItem } from "@/components/ui/trail-issues-card";
import { UpcomingEventsCard, type UpcomingEventItem } from "@/components/ui/upcoming-events-card";
import { fetchTrailIssues, fetchUpcomingEvents } from "@/services/trello-service";

// hardcoded for testing, need to swap for real auth later
const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN;

export default function TrelloTestScreen() {
    const [issues, setIssues] = useState<TrailIssueItem[]>([]);
    const [issuesLoading, setIssuesLoading] = useState(true);
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [issuesMax, setIssuesMax] = useState(3);
    const [eventsMax, setEventsMax] = useState(3);
    
    const [events, setEvents] = useState<UpcomingEventItem[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);

    useEffect(() => {
        if (!API_KEY || !API_TOKEN) {
            const msg = "Missing Trello API credentials";
            setIssuesError(msg);
            setEventsError(msg);
            setIssuesLoading(false);
            setEventsLoading(false);
            return;
        }
        fetchTrailIssues(API_KEY, API_TOKEN)
            .then(setIssues)
            .catch((e) => setIssuesError(e.message))
            .finally(() => setIssuesLoading(false));
        fetchUpcomingEvents(API_KEY, API_TOKEN)
            .then(setEvents)
            .catch((e) => setEventsError(e.message))
            .finally(() => setEventsLoading(false));
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.heading}>Trello Integration Test</Text>
            <UpcomingEventsCard
                events={events}
                loading={eventsLoading}
                error={eventsError}
                maxItems={eventsMax}
                onShowMore={() => setEventsMax((prev) => prev + 3)}
                onPressItem={(event) => console.log("pressed:", event.name)}
            />
            <TrailIssuesCard
                issues={issues}
                loading={issuesLoading}
                error={issuesError}
                maxItems={issuesMax}
                onShowMore={() => setIssuesMax((prev) => prev + 3)}
                onPressItem={(issue) => console.log("pressed:", issue.name)}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { 
        padding: 16, 
        gap: 24 
    },
    heading: { 
        fontSize: 20, 
        fontWeight: "700", 
    },
});