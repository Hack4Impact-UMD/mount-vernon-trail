import { StyleSheet, Text, View } from "react-native";
import type { MapPin } from "@/components/map-overlays";

export default function TrailMap(_props: {
    selectedIssue: MapPin | null;
    onSelectIssue: (issue: MapPin) => void;
}) {
    return (
        <View style={styles.container}>
            <Text>Open the iOS or Android development build to view the map.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
