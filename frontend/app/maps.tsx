import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import TrailMap from "@/components/trail-map";
import { StyleSheet, View } from "react-native";

export default function MapsScreen() {
    return (
        <View style={styles.screen}>
            <Header />
            <TrailMap />
            <BottomNav active="maps" />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#ffffff" },
});
