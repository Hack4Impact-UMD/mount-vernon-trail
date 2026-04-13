import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { TrailDocIssuesCard } from "@/components/ui/trail-doc-issues-card";
import { TrailDocStatsCard } from "@/components/ui/trail-doc-stats-card";
import { TrelloClient } from "@/services/trello-funcs";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import { TrailDocumentIssueItem } from "@/types/trail-types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Alert, Modal, Pressable, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { saveDraft, publishEvent } from "@/services/event-service";

// TODO remove this after trello auth is done
const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN;

export default function TrailDocumentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        eventCardID?: string;
        beforeImageUri?: string;
        afterImageUri?: string;
    }>();
    const eventCardID = params.eventCardID ?? "IpiGZLH0";
    const [active, setActive] = useState<
        "home" | "new-event" | "history" | "profile"
    >("home");
    const [issuesData, setIssuesData] = useState([] as TrailDocumentIssueItem[]);
    const [notepad, setNotepad] = useState("");
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [issuesError, setIssuesError] = useState<string | null>(null);
    const [statsData, setStatsData] = useState({
        trashCollection: 0,
        restorationEffort: 0,
    });
    useEffect(() => {
        async function loadTrailDocument() {
            if (!eventCardID) {
                console.error("event card id not found");
                return;
            }

            if(!API_KEY || !API_TOKEN){
                setIssuesError("Missing Trello API Credentials");
                return;
            }
            const trello = new TrelloClient(API_KEY, API_TOKEN);
            const eventCard = await trello.getEventCardByID(eventCardID, true);
            const issues = await fetchDocumentTrailIssues(API_KEY, API_TOKEN, eventCard);
            // TODO fetch stats once that flow is figured out
            const stats = {
                trashCollection: 12,
                restorationEffort: 250,
            }
            setIssuesData(issues);
            setStatsData(stats);
        }
        loadTrailDocument();
    }, [eventCardID]);

    function handleAddIssue() {
        router.push({
            pathname: "/trail-issue-screen",
            params: {
                issueId: `new-${Date.now()}`,
                issueName: `New Issue #${issuesData.length + 1}`,
                isNew: "true",
                eventCardID,
            },
        });
    }

    async function handleSaveDraft() {
        setSavingDraft(true);
        try {
            // TODO: swap "ACTIVE_EVENT_ID" for real eventId from Firebase
            await saveDraft("ACTIVE_EVENT_ID", notepad);
            Alert.alert("Saved", "Event saved to drafts.");
            router.replace("/drafts");
        } catch {
            Alert.alert("Error", "Could not save draft.");
        } finally {
            setSavingDraft(false);
        }
    }

    async function handlePublish() {
        setPublishing(true);
        try {
            // TODO: call trello-service.moveCardToCompleted here too
            await publishEvent("ACTIVE_EVENT_ID");
            setShowPublishModal(false);
            Alert.alert("Published!", "Event posted to Trello.");
            router.replace("/");
        } catch {
            Alert.alert("Error", "Could not publish.");
        } finally {
            setPublishing(false);
        }
    }

    const beforeImageUri = typeof params.beforeImageUri === "string" ? params.beforeImageUri : null;
    const afterImageUri = typeof params.afterImageUri === "string" ? params.afterImageUri : null;

    return (
        // temporary buttons to test navigation to camera view
        /*
        <View>
            <Button title="before" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { mode: 'before' }, 
                })}
            />
            <Button title="after" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { 
                        mode: 'after',
                        beforeImageUri: beforeImageUri ?? "",
                    }, 
                })}
            />
            {beforeImageUri ? (
                <Image
                    source={{ uri: beforeImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No before image yet</Text>
            )}
            {afterImageUri ? (
                <Image
                    source={{ uri: afterImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No after image yet</Text>
            )}
        </View>
        */
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.screen}>
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    {/* App Header */}
                    <Header userName={null} />
                    <View style={styles.contentContainer}>
                        {/* Page Header*/ } 
                        {/* TODO replace with actual page header after it is implemented */}
                        <View style={styles.headerSpacer}></View>
                        {/* Trail Issues Section */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <Text style={styles.sectionTitle}>Trail Issues</Text>
                            <TouchableOpacity
                                onPress={handleAddIssue}
                                style={{ flexDirection: "row", alignItems: "center", gap: 4,
                                        borderWidth: 1.5, borderColor: "#5B2D8E", borderRadius: 20,
                                        paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#FAF7FF" }}
                            >
                                <Ionicons name="add" size={16} color="#5B2D8E" />
                                <Text style={{ color: "#5B2D8E", fontWeight: "600", fontSize: 13 }}>Add Issue</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.listContainer}>
                            {issuesData.map((issue) => (
                                <TrailDocIssuesCard
                                    key={issue.id}
                                    id={issue.id}
                                    name={issue.name}
                                    date={issue.creationDate}
                                    imageUrl={issue.imageUrl}
                                    onPress={() => router.push({
                                        pathname: "/trail-issue-screen",
                                        params: { issueId: issue.id, issueName: issue.name, eventCardID },
                                    })}
                                />
                            ))}
                        </View>

                        
                       {/* Notepad Section */}
                    <Text style={styles.sectionTitle}>Notepad</Text>
                    <TextInput
                        style={{ borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12,
                                padding: 14, fontSize: 14, minHeight: 100, marginBottom: 24,
                                backgroundColor: "#FAFAFA" }}
                        value={notepad}
                        onChangeText={setNotepad}
                        multiline
                        placeholder="Start documenting the event"
                        placeholderTextColor="#bbb"
                        textAlignVertical="top"
                    />

                    {/* Statistics Section */}
                    <Text style={styles.sectionTitle}>Statistics</Text>
                    <TrailDocStatsCard {...statsData} />

                    {/* Action Buttons */}
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 24 }}>
                        <TouchableOpacity
                            onPress={handleSaveDraft}
                            disabled={savingDraft}
                            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                                    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#DADADA",
                                    backgroundColor: "#F5F5F5" }}
                        >
                            <Ionicons name="document-outline" size={18} color="#555" style={{ marginRight: 6 }} />
                            <Text style={{ color: "#444", fontWeight: "600", fontSize: 14 }}>Save as draft</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowPublishModal(true)}
                            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                                    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#5B2D8E",
                                    backgroundColor: "#FAF7FF" }}
                        >
                            <Ionicons name="share-outline" size={18} color="#5B2D8E" style={{ marginRight: 6 }} />
                            <Text style={{ color: "#5B2D8E", fontWeight: "600", fontSize: 14 }}>Post to Trello</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                </ScrollView>
                <BottomNav 
                    active={active} 
                    onTabPress={(tab) => setActive(tab)}
                ></BottomNav>
            </View>
            
            <Modal visible={showPublishModal} transparent animationType="fade"
                onRequestClose={() => setShowPublishModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
                            alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: "82%", backgroundColor: "#fff", borderRadius: 16, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>Post to Trello?</Text>
                        <Text style={{ fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 24 }}>
                            This will publish the event to your Trello board and mark it as complete.
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <Pressable onPress={() => setShowPublishModal(false)}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 10,
                                        borderWidth: 1.5, borderColor: "#DDD", alignItems: "center" }}>
                                <Text style={{ color: "#555", fontWeight: "600" }}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handlePublish} disabled={publishing}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 10,
                                        backgroundColor: "#5B2D8E", alignItems: "center" }}>
                                <Text style={{ color: "#fff", fontWeight: "700" }}>Post</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    previewImage: {
        width: 180,
        height: 180,
        borderRadius: 12,
        marginTop: 20,
    },
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    contentContainer: {
        paddingHorizontal: 20,
    },
    listContainer: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
    },
    headerSpacer: {
        height: 120
    },
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    loader: {
        flex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    errorText: {
        fontSize: 15,
        color: "#888",
        textAlign: "center",
    },
});
