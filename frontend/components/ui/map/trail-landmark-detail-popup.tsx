import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { MapPin, X } from "lucide-react-native";
import { Colors, Palette } from "@/constants/theme";
import {
    LANDMARK_LABELS,
    type TrailLandmark,
} from "@/services/trail-landmark-service";
import MonumentAmenities from "./monument-amenities";

export default function TrailLandmarkDetailPopup({
    marker,
    onClose,
}: {
    marker: TrailLandmark | null;
    onClose: () => void;
}) {
    return (
        <Modal
            visible={marker !== null}
            transparent
            animationType="fade"
            onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss landmark details"
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />
                <View
                    style={styles.card}
                    accessibilityViewIsModal>
                    <View style={styles.header}>
                        <View style={styles.icon}>
                            <MapPin
                                size={24}
                                color={Palette.primaryPurple100}
                            />
                        </View>
                        <Text style={styles.eyebrow}>
                            {marker
                                ? LANDMARK_LABELS[marker.kind].toUpperCase()
                                : ""}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Close landmark details"
                            onPress={onClose}
                            style={styles.close}>
                            <X
                                size={22}
                                color={Palette.primaryBlack70}
                            />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.content}>
                        <View style={styles.titleRow}>
                            <Text
                                accessibilityRole="header"
                                style={styles.title}>
                                {marker?.location_name}
                            </Text>
                            {marker?.amenities && (
                                <MonumentAmenities
                                    amenities={marker.amenities}
                                />
                            )}
                        </View>
                        <Text style={styles.description}>
                            {marker?.description ??
                                "Location on the Mount Vernon Trail."}
                        </Text>
                        {marker && (
                            <Text style={styles.reference}>
                                {marker.coordinates.latitude},{" "}
                                {marker.coordinates.longitude}
                            </Text>
                        )}
                        {marker?.amenities && (
                            <Text style={styles.reference}>
                                Amenities shown according to the 1995 MVT map;
                                availability may have changed.
                            </Text>
                        )}
                    </ScrollView>
                    <Pressable
                        accessibilityRole="button"
                        onPress={onClose}
                        style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                        ]}>
                        <Text style={styles.buttonText}>Back to map</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#00000066",
    },
    card: {
        backgroundColor: Colors.light.background,
        borderRadius: 24,
        padding: 24,
        gap: 20,
        maxHeight: "80%",
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        shadowColor: Palette.primaryPurple100,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: "#F3EEF9",
        alignItems: "center",
        justifyContent: "center",
    },
    eyebrow: {
        flex: 1,
        fontFamily: "Lato_700Bold",
        fontSize: 11,
        letterSpacing: 1.6,
        color: Palette.primaryPurple100,
    },
    close: { padding: 12, marginRight: -12, minWidth: 44, minHeight: 44 },
    content: { flexGrow: 0 },
    titleRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    reference: {
        fontFamily: "Lato_400Regular",
        fontSize: 11,
        lineHeight: 16,
        color: Palette.primaryBlack70,
        marginTop: 16,
    },
    title: {
        fontFamily: "Lato_700Bold",
        fontSize: 23,
        lineHeight: 30,
        color: Palette.primaryPurple100,
        flexShrink: 1,
        flexGrow: 1,
        flexBasis: 170,
    },
    description: {
        fontFamily: "Lato_400Regular",
        fontSize: 16,
        lineHeight: 24,
        color: Palette.primaryBlack70,
    },
    button: {
        minHeight: 50,
        borderRadius: 12,
        padding: 14,
        backgroundColor: Palette.primaryPurple100,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonPressed: { opacity: 0.8 },
    buttonText: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: Colors.light.background,
    },
});
