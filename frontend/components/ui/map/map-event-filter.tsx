import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { Palette } from "@/constants/theme";

export type MapEventOption = { id: string; name: string; count: number };

type Props = {
    options: MapEventOption[];
    selectedId: string;
    onSelect: (id: string) => void;
    loading: boolean;
    error: string | null;
    pinCount: number;
};

export default function MapEventFilter({
    options,
    selectedId,
    onSelect,
    loading,
    error,
    pinCount,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const selected =
        options.find((option) => option.id === selectedId) ?? options[0];
    const visible = options.filter((option) =>
        option.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return (
        <View style={styles.container}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Filter by event: ${selected?.name ?? "All issues"}`}
                accessibilityState={{
                    expanded: open,
                    disabled: loading || Boolean(error),
                }}
                disabled={loading || Boolean(error)}
                onPress={() => {
                    setQuery("");
                    setOpen(true);
                }}
                style={styles.trigger}>
                <View style={styles.triggerText}>
                    <Text style={styles.label}>EVENT</Text>
                    <Text
                        numberOfLines={1}
                        style={styles.selected}>
                        {selected?.name ?? "All issues"}
                    </Text>
                </View>
                <Text style={styles.count}>{pinCount} pins</Text>
                {loading ? (
                    <ActivityIndicator color={Palette.primaryPurple100} />
                ) : (
                    <ChevronDown
                        size={18}
                        color={Palette.primaryPurple100}
                    />
                )}
            </Pressable>
            {error && (
                <Text
                    accessibilityLiveRegion="polite"
                    style={styles.error}>
                    Event filters unavailable. All issues are shown. Refresh to
                    try again.
                </Text>
            )}
            {!loading && !error && pinCount === 0 && (
                <Text
                    style={styles.error}
                    accessibilityLiveRegion="polite">
                    {selectedId === "all"
                        ? "No mapped issues available."
                        : "No mapped issues for this selection."}
                </Text>
            )}
            <Modal
                visible={open}
                transparent
                animationType="slide"
                onRequestClose={() => setOpen(false)}>
                <View style={styles.backdrop}>
                    <View
                        style={styles.sheet}
                        accessibilityViewIsModal>
                        <View style={styles.headingRow}>
                            <Text style={styles.heading}>Filter by event</Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close event filter"
                                onPress={() => setOpen(false)}
                                style={styles.close}>
                                <X
                                    size={22}
                                    color={Palette.primaryBlack100}
                                />
                            </Pressable>
                        </View>
                        <Text style={styles.hint}>
                            Choose an event to show its intake issues. Counts
                            include issues needing a location.
                        </Text>
                        <View style={styles.search}>
                            <Search
                                size={18}
                                color={Palette.primaryBlack70}
                            />
                            <TextInput
                                accessibilityLabel="Search events"
                                placeholder="Search events"
                                placeholderTextColor={Palette.primaryBlack70}
                                value={query}
                                onChangeText={setQuery}
                                autoCorrect={false}
                                style={styles.input}
                            />
                        </View>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            style={styles.list}>
                            {visible.map((option) => (
                                <Pressable
                                    key={option.id}
                                    accessibilityRole="radio"
                                    accessibilityState={{
                                        checked: selectedId === option.id,
                                    }}
                                    accessibilityLabel={`${option.name}, ${option.count} issues`}
                                    onPress={() => {
                                        onSelect(option.id);
                                        setOpen(false);
                                    }}
                                    style={[
                                        styles.option,
                                        selectedId === option.id &&
                                            styles.active,
                                    ]}>
                                    <Text style={styles.optionText}>
                                        {option.name}
                                    </Text>
                                    <Text style={styles.count}>
                                        {option.count}
                                    </Text>
                                    {selectedId === option.id && (
                                        <Check
                                            size={18}
                                            color={Palette.primaryPurple100}
                                        />
                                    )}
                                </Pressable>
                            ))}
                            {visible.length === 0 && (
                                <Text style={styles.empty}>
                                    No matching events.
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#ffffff",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6,
    },
    trigger: {
        minHeight: 58,
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    triggerText: { flex: 1, gap: 3 },
    label: {
        fontFamily: "Lato_700Bold",
        fontSize: 10,
        letterSpacing: 1.2,
        color: Palette.primaryBlack70,
    },
    selected: {
        fontFamily: "Lato_700Bold",
        fontSize: 15,
        color: Palette.primaryPurple100,
    },
    count: {
        fontFamily: "Lato_400Regular",
        fontSize: 13,
        color: Palette.primaryBlack70,
    },
    error: {
        fontFamily: "Lato_400Regular",
        fontSize: 12,
        color: Palette.primaryBlack70,
    },
    backdrop: {
        flex: 1,
        backgroundColor: "#00000055",
        justifyContent: "center",
        padding: 24,
    },
    sheet: {
        backgroundColor: "#ffffff",
        borderRadius: 20,
        padding: 20,
        gap: 12,
        maxHeight: "80%",
    },
    headingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    heading: {
        fontFamily: "Lato_700Bold",
        fontSize: 22,
        color: Palette.primaryBlack100,
    },
    close: { padding: 10 },
    hint: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        color: Palette.primaryBlack70,
    },
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
        color: Palette.primaryBlack100,
    },
    list: { flexGrow: 0 },
    option: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 14,
        minHeight: 52,
        borderRadius: 10,
        marginBottom: 4,
    },
    active: { backgroundColor: "#F3EEF9" },
    optionText: {
        flex: 1,
        fontFamily: "Lato_400Regular",
        fontSize: 15,
        color: Palette.primaryBlack100,
    },
    empty: {
        padding: 20,
        textAlign: "center",
        fontFamily: "Lato_400Regular",
        color: Palette.primaryBlack70,
    },
});
