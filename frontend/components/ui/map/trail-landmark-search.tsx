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
    searchLandmarks,
    LANDMARK_CATEGORIES,
    type LandmarkKind,
    type TrailLandmark,
} from "@/services/trail-landmark-service";

export default function TrailLandmarkSearch({
    onSelect,
}: {
    onSelect: (marker: TrailLandmark) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<"all" | LandmarkKind>("all");
    const results = searchLandmarks(query, category);
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search trail landmarks"
                onPress={() => setOpen(true)}
                style={styles.trigger}>
                <Search
                    size={17}
                    color={Palette.primaryPurple100}
                />
                <Text style={styles.triggerText}>
                    Find monuments, bridges & mile markers
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
                                Explore the trail
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close landmark search"
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
                                    accessibilityLabel="Landmark name or abbreviation"
                                    placeholder="Name, B15, or M4"
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
                                {LANDMARK_CATEGORIES.map((item) => (
                                    <Pressable
                                        key={item.id}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Show ${item.label}`}
                                        accessibilityState={{
                                            selected: category === item.id,
                                        }}
                                        onPress={() => setCategory(item.id)}
                                        style={[
                                            styles.chip,
                                            category === item.id &&
                                                styles.chipSelected,
                                        ]}>
                                        <Text
                                            style={[
                                                styles.chipText,
                                                category === item.id &&
                                                    styles.chipTextSelected,
                                            ]}>
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            <View style={styles.header}>
                                <Text
                                    accessibilityLiveRegion="polite"
                                    style={styles.caption}>
                                    {results.length} locations
                                </Text>
                                {(query || category !== "all") && (
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => {
                                            setQuery("");
                                            setCategory("all");
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
                                        <Text style={styles.name}>
                                            {marker.location_name}
                                        </Text>
                                        <ChevronRight
                                            size={18}
                                            color={Palette.primaryPurple100}
                                        />
                                    </Pressable>
                                ))}
                                {results.length === 0 && (
                                    <Text style={styles.empty}>
                                        No locations match. Try a different name
                                        or clear the filters.
                                    </Text>
                                )}
                            </View>
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
        justifyContent: "center",
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
    name: {
        flex: 1,
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
