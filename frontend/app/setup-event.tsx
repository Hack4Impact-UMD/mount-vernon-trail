import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import { setupEvent } from "@/services/event-setup";
import { getDateString, parseAndValidateDate } from "@/utils/date";
import { getErrorMessage } from "@/utils/errors";
import { Feather } from "@expo/vector-icons";
import RNDateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import Svg, { Path } from "react-native-svg";

const TRELLO_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";

export default function SetupEventScreen() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const titleInputRef = useRef<TextInput>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const [description, setDescription] = useState("");
    const [dateStr, setDateStr] = useState("");
    const [date, setDate] = useState<Date | null>(null);
    const [eventLeader, setEventLeader] = useState("");
    const [zoneLeaders, setZoneLeaders] = useState("");
    const [toolHaulers, setToolHaulers] = useState("");
    const [gloverLover, setGloverLover] = useState("");
    const [notes, setNotes] = useState("");
    
    const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
    const [creating, setCreating] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const wait = setTimeout(() => {
            scrollViewRef.current?.flashScrollIndicators();
        }, 500);
        return () => clearTimeout(wait);
    }, []);

    const handleCancel = () => {
        if (creating || canceling) return;
        setCanceling(true);
        if (router.canGoBack()) {
            router.back();
            return;
        }
        // No back history to return to, so the screen stays put — clear the
        // spinner rather than leaving the buttons locked.
        setCanceling(false);
    }

    const handleCreate = async () => {
        // The volunteer roster is often unknown when an event is scheduled, and
        // every read path already defaults these to "", so only the title, date
        // and the accountable event leader are required.
        const required = [
            { value: title, message: "Event title is required." },
            { value: dateStr, message: "Event date is required." },
            { value: eventLeader, message: "Event leader is required." },
        ];
        const missing = required.find((field) => !field.value.trim());
        if (missing) {
            setError(missing.message);
            return;
        }
        const eventDate = parseAndValidateDate(dateStr.trim());
        if (!eventDate) {
            setError("Invalid date. Use MM/DD/YYYY format.");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const result = await setupEvent(
                {
                    title: title.trim(),
                    description: description.trim(),
                    eventDate,
                    eventLeader: eventLeader.trim(),
                    zoneLeaders: zoneLeaders.trim(),
                    toolHaulers: toolHaulers.trim(),
                    gloverLover: gloverLover.trim(),
                    notes: notes.trim(),
                },
                TRELLO_KEY,
            );
            Alert.alert("Event Created", `"${title.trim()}" has been set up!`, [
                {
                    text: "Open Trello Card",
                    onPress: () => Linking.openURL(result.cardUrl),
                },
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setCreating(false);
        }
    };

    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        // hide picker after selection
        setShowDatePicker(false);
        if (event.type === "set" && selectedDate) {
            setDate(selectedDate);
            const dateStr = getDateString(selectedDate);
            setDateStr(dateStr);
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <View style={styles.content}>
                    <Header />
                    <ScrollView 
                        ref={scrollViewRef}
                        style={styles.scrollContent} 
                        contentContainerStyle={styles.scrollContentContainer}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.headerSection}>
                            {/* Event Title */}
                            <View style={styles.titleRow}>
                                <Pressable style={styles.editPencilContainer} onPress={() => titleInputRef.current?.focus()}>
                                    <Svg height="32px" viewBox="0 -960 960 960" width="32px" style={styles.editPencil}>
                                        <Path fill={Palette.primaryPurple50} d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                                    </Svg>
                                </Pressable>
                                <TextInput
                                    ref={titleInputRef}
                                    style={styles.titleInput}
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder="New Event"
                                    placeholderTextColor="#aaa"
                                    maxLength={50}
                                />
                            </View>
                            {/* Date Input */}
                            <Pressable style={styles.dateInputContainer} onPress={() => setShowDatePicker(true)}>
                                <Feather name="calendar" size={18} color={Palette.primaryPurple50} /> 
                                <Text style={styles.dateInput}>{dateStr || "Select date"}</Text>
                            </Pressable>
                            {showDatePicker && (
                                <View style={styles.datePickerContainer}>
                                    <RNDateTimePicker 
                                        mode="date" 
                                        display="default"
                                        value={date ?? new Date()}
                                        onChange={handleDateChange} 
                                        minimumDate={new Date()}
                                    />
                                </View>
                            )}
                        </View>
                        {/* Event Leader + Zone Leader Input */}
                        <View style={styles.row}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Event Leader</Text>
                                <View style={styles.inputPill}>
                                    <TextInput style={styles.input} placeholder="Enter leader..." placeholderTextColor="#aaa" value={eventLeader} onChangeText={setEventLeader} />
                                </View>
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Zone Leaders</Text>
                                <View style={styles.inputPill}>
                                    <TextInput style={styles.input} placeholder="Enter leaders (optional)..." placeholderTextColor="#aaa" value={zoneLeaders} onChangeText={setZoneLeaders} />
                                </View>
                            </View>
                        </View>
                        {/* Tool Haulers + Glover Lover Input */}
                        <View style={styles.row}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Tool Haulers</Text>
                                <View style={styles.inputPill}>
                                    <TextInput style={styles.input} placeholder="Select tool haulers (optional)..." placeholderTextColor="#aaa" value={toolHaulers} onChangeText={setToolHaulers} />
                                </View>
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Glover Lover</Text>
                                <View style={styles.inputPill}>
                                    <TextInput style={styles.input} placeholder="Select glover lover (optional)..." placeholderTextColor="#aaa" value={gloverLover} onChangeText={setGloverLover} />
                                </View>
                            </View>
                        </View>
                        {/* Spacer */}
                        <View style={{ height: 4 }} />
                        {/* Work Scope */}
                        <Text style={styles.label}>Work Scope</Text>
                        <View style={[styles.textAreaContainer, styles.inputPill]}>
                            <TextInput
                                style={[styles.textArea, styles.input]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="2-person team to clear hedging..."
                                placeholderTextColor="#aaa"
                                multiline
                                textAlignVertical="top"
                            />
                        </View>
                        {/* Notes */}
                        <Text style={styles.label}>Notes</Text>
                        <View style={[styles.textAreaContainer, styles.inputPill]}>
                            <TextInput
                                style={[styles.textArea, styles.input]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Notes..."
                                placeholderTextColor="#aaa"
                                multiline
                                textAlignVertical="top"
                            />
                        </View>
                    </ScrollView>
                    {/* Error Message Display */}
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {/* Cancel Button */}
                        <Pressable
                            style={[
                                styles.cancelButton,
                                (creating || canceling) && styles.cancelButtonDisabled,
                            ]}
                            onPress={handleCancel}
                            disabled={creating || canceling}>
                            {creating || canceling ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            )}
                        </Pressable>
                        {/* Create Button */}
                        <Pressable
                            style={[
                                styles.createButton,
                                (creating || canceling) && styles.createButtonDisabled,
                            ]}
                            onPress={handleCreate}
                            disabled={creating || canceling}>
                            {creating || canceling ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.createButtonText}>
                                    Create Event
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
                <BottomNav />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: { 
        flex: 1, 
        backgroundColor: "#fff" 
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 12,
    },
    scrollContentContainer: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    headerSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        paddingTop: 10,
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        paddingBottom: 20,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        maxWidth: 300,
    },
    editPencilContainer: {
        justifyContent: "center",
        alignItems: "center",
        width: 32,
        height: 32,
    },
    editPencil: {
        marginTop: 0,
    },
    titleInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: "600",
        color: Palette.primaryPurple70,
        borderBottomWidth: 1,
        borderBottomColor: Palette.primaryPurple70,
        marginLeft: 10,
        paddingBottom: 2,
    },
    dateInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: 140,
        marginBottom: -8,
    },
    datePickerContainer: {
        width: "100%",
        alignItems: "flex-end",
        marginTop: 8,
    },
    dateInput: {
        flex: 1,
        marginLeft: 8,
        fontStyle: "italic",
        color: "#555",
        fontSize: 14,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    column: {
        width: "48%",
    },
    textAreaContainer: {
        borderRadius: 15,
        minHeight: 110,
        marginBottom: 20,
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    textArea: {
        flex: 1,
        paddingLeft: 12,
    },
    label: {
        fontSize: 12,
        fontFamily: "Lato_700Bold",
        letterSpacing: 0.5,
        color: "#6b6b6b",
        marginBottom: 10,
        marginLeft: 4,
        textTransform: "uppercase",
    },
    inputPill: {
        borderWidth: 1,
        borderColor: Palette.primaryPurple30,
        borderRadius: 15,
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: "#FAF8FC",
    },
    input: {
        fontStyle: "italic",
        color: "#555",
        fontSize: 12,
        marginVertical: -4,
        height: 40,
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingBottom: 20,
        gap: 16,
        marginTop: 8,
    },
    createButton: {
        flex: 1,
        backgroundColor: Palette.primaryPurple70,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    createButtonDisabled: {
        opacity: 0.6,
    },
    createButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    cancelButton: {
        flex: 1,
        // borderWidth/borderColor, not outlineWidth/outlineColor: the outline
        // properties are web-only and render nothing on iOS or Android.
        borderWidth: 1,
        borderColor: Palette.primaryPurple70,
        backgroundColor: "#fff",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    cancelButtonDisabled: {
        opacity: 0.6,
    },
    cancelButtonText: {
        color: Palette.primaryPurple70,
        fontWeight: "700",
        fontSize: 16,
    },
    errorText: {
        color: "#c0392b",
        textAlign: "center",
        fontSize: 16,
        fontFamily: "Lato_700Bold",
        marginVertical: 6,
        paddingHorizontal: 20,
    }
});