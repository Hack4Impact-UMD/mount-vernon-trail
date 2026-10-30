import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import TrailMap from "@/components/ui/map/trail-map";
import MapIssueCard from "@/components/ui/map/map-issue-card";
import type { MapPin } from "@/components/ui/map/map-overlays";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function MapsScreen() {
    const { issueId } = useLocalSearchParams<{ issueId?: string }>();
    const [selectedIssue, setSelectedIssue] = useState<MapPin | null>(null);
    return (
        <View style={styles.screen}>
            <Header />
            <TrailMap
                selectedIssue={selectedIssue}
                onSelectIssue={setSelectedIssue}
                focusIssueId={issueId}
            />
            <BottomNav active="maps" />
            <MapIssueCard
                issue={selectedIssue}
                onClose={() => setSelectedIssue(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#ffffff" },
});
