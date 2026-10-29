import { View, StyleSheet } from "react-native";
import {
    CircleParking,
    Phone,
    Toilet,
    GlassWater,
    Sailboat,
    Fish,
    Sandwich,
    Utensils,
} from "lucide-react-native";
import { Palette } from "@/constants/theme";
import {
    MONUMENT_AMENITIES,
    type MonumentMarker,
} from "@/services/monument-service";

export const AMENITY_ICONS = {
    parking: CircleParking,
    phone: Phone,
    restrooms: Toilet,
    water: GlassWater,
    boatLaunch: Sailboat,
    fishing: Fish,
    picnicking: Sandwich,
    restaurants: Utensils,
};

export default function MonumentAmenities({
    amenities,
}: {
    amenities: MonumentMarker["amenities"];
}) {
    return (
        <View style={styles.row}>
            {MONUMENT_AMENITIES.filter((item) => amenities[item.id]).map(
                (item) => {
                    const Icon = AMENITY_ICONS[item.id];
                    return (
                        <View
                            key={item.id}
                            accessible
                            accessibilityRole="image"
                            accessibilityLabel={`${item.label}, shown on reference map`}
                            style={styles.badge}>
                            <Icon
                                size={16}
                                color={Palette.primaryPurple100}
                            />
                        </View>
                    );
                },
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 5, flexShrink: 1 },
    badge: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: "#F3EEF9",
        alignItems: "center",
        justifyContent: "center",
    },
});
