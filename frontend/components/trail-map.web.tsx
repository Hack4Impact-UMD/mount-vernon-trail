import { StyleSheet, Text, View } from "react-native";

export default function TrailMap() {
    return (
        <View style={styles.container}>
            <Text>Open the iOS or Android development build to view the map.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
