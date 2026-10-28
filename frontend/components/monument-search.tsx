import { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Search, X, ChevronRight } from "lucide-react-native";
import { Colors, Palette } from "@/constants/theme";
import {
    MONUMENT_AMENITIES,
    searchMonuments,
    type MonumentAmenity,
    type MonumentMarker,
} from "@/services/monument-service";
import MonumentAmenities, { AMENITY_ICONS } from "./monument-amenities";

export default function MonumentSearch({
    onSelect,
}: {
    onSelect: (marker: MonumentMarker) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [amenities, setAmenities] = useState<MonumentAmenity[]>([]);
    const results = searchMonuments(query, amenities);
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search monuments and amenities"
                onPress={() => setOpen(true)}
                style={styles.trigger}>
                <Search
                    size={17}
                    color={Palette.primaryPurple100}
                />
                <Text style={styles.triggerText}>
                    Find monuments & amenities
                </Text>
                <ChevronRight
                    size={17}
                    color={Palette.primaryPurple100}
                />
            </Pressable>
            <Modal
                visible={open}
                transparent
                animationType="slide"
                onRequestClose={() => setOpen(false)}>
                <View style={styles.backdrop}>
                    <View
                        style={styles.sheet}
                        accessibilityViewIsModal>
                        <View style={styles.header}>
                            <Text style={styles.heading}>
                                Explore monuments
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close monument search"
                                onPress={() => setOpen(false)}
                                style={styles.close}>
                                <X
                                    size={22}
                                    color={Palette.primaryBlack70}
                                />
                            </Pressable>
                        </View>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}>
                            <View style={styles.search}>
                                <Search
                                    size={18}
                                    color={Palette.primaryPurple100}
                                />
                                <TextInput
                                    accessibilityLabel="Search monuments or amenities"
                                    placeholder="Name, abbreviation, or amenity"
                                    placeholderTextColor={
                                        Palette.primaryBlack70
                                    }
                                    value={query}
                                    onChangeText={setQuery}
                                    autoCorrect={false}
                                    style={styles.input}
                                />
                            </View>
                            <View style={styles.filters}>
                                {MONUMENT_AMENITIES.map((item) => {
                                    const selected = amenities.includes(
                                        item.id,
                                    );
                                    const Icon = AMENITY_ICONS[item.id];
                                    return (
                                        <Pressable
                                            key={item.id}
                                            accessibilityRole="checkbox"
                                            accessibilityLabel={`Filter by ${item.label}`}
                                            accessibilityState={{
                                                checked: selected,
                                            }}
                                            onPress={() =>
                                                setAmenities((current) =>
                                                    selected
                                                        ? current.filter(
                                                              (id) =>
                                                                  id !==
                                                                  item.id,
                                                          )
                                                        : [...current, item.id],
                                                )
                                            }
                                            style={[
                                                styles.chip,
                                                selected && styles.chipSelected,
                                            ]}>
                                            <Icon
                                                size={15}
                                                color={
                                                    selected
                                                        ? Colors.light
                                                              .background
                                                        : Palette.primaryPurple100
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    selected &&
                                                        styles.chipTextSelected,
                                                ]}>
                                                {item.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.header}>
                                <Text
                                    accessibilityLiveRegion="polite"
                                    style={styles.caption}>
                                    {results.length} monuments · matches all
                                    selected amenities
                                </Text>
                                {(query || amenities.length > 0) && (
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => {
                                            setQuery("");
                                            setAmenities([]);
                                        }}
                                        style={styles.clear}>
                                        <Text style={styles.clearText}>
                                            Clear
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                            <View style={styles.list}>
                                {results.map((marker) => (
                                    <Pressable
                                        key={marker.id}
                                        accessibilityRole="button"
                                        accessibilityLabel={`View ${marker.location_name}`}
                                        onPress={() => {
                                            setOpen(false);
                                            onSelect(marker);
                                        }}
                                        style={styles.result}>
                                        <View style={styles.resultText}>
                                            <Text style={styles.name}>
                                                {marker.location_name}
                                            </Text>
                                            <MonumentAmenities
                                                amenities={marker.amenities}
                                            />
                                        </View>
                                        <ChevronRight
                                            size={18}
                                            color={Palette.primaryPurple100}
                                        />
                                    </Pressable>
                                ))}
                                {results.length === 0 && (
                                    <Text style={styles.empty}>
                                        No monuments match. Try a different name
                                        or remove an amenity filter.
                                    </Text>
                                )}
                            </View>
                            <Text style={styles.caption}>
                                Amenities recorded from the 1995 MVT
                                map.
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        minHeight: 44,
        backgroundColor: Colors.light.background,
    },
    triggerText: {
        flex: 1,
        fontFamily: "Lato_400Regular",
        fontSize: 13,
        color: Palette.primaryPurple100,
    },
    backdrop: {
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#00000066",
    },
    sheet: {
        maxHeight: "88%",
        borderRadius: 22,
        backgroundColor: Colors.light.background,
        padding: 20,
        gap: 12,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        justifyContent: "space-between",
    },
    heading: {
        flex: 1,
        fontFamily: "Lato_700Bold",
        fontSize: 22,
        color: Palette.primaryPurple100,
    },
    close: { padding: 10 },
    search: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        borderRadius: 10,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        minHeight: 48,
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        color: Palette.primaryBlack100,
    },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
    },
    chipSelected: {
        backgroundColor: Palette.primaryPurple100,
        borderColor: Palette.primaryPurple100,
    },
    chipText: {
        fontFamily: "Lato_400Regular",
        fontSize: 12,
        color: Palette.primaryPurple100,
    },
    chipTextSelected: { color: Colors.light.background },
    caption: {
        flexShrink: 0,
        fontFamily: "Lato_400Regular",
        fontSize: 11,
        lineHeight: 16,
        color: Palette.primaryBlack70,
    },
    clear: { padding: 8 },
    clearText: {
        fontFamily: "Lato_700Bold",
        fontSize: 12,
        color: Palette.primaryPurple100,
    },
    body: { flexShrink: 1, minHeight: 0 },
    bodyContent: { gap: 12, paddingBottom: 16 },
    list: { flexShrink: 0 },
    result: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Palette.primaryPurple30,
    },
    resultText: { flex: 1, gap: 7 },
    name: {
        fontFamily: "Lato_700Bold",
        fontSize: 15,
        lineHeight: 21,
        color: Palette.primaryBlack100,
    },
    empty: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        lineHeight: 21,
        color: Palette.primaryBlack70,
        paddingVertical: 20,
    },
});
