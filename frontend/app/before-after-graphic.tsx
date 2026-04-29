import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import { Check, Download, House, Plus, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

type Step = "select" | "preview" | "success";

export default function BeforeAfterGraphicScreen() {
    const router = useRouter();
    const [beforeUri, setBeforeUri] = useState<string | null>(null);
    const [afterUri, setAfterUri] = useState<string | null>(null);
    const [step, setStep] = useState<Step>("select");
    const [saving, setSaving] = useState(false);
    const [, requestMediaPermission] = MediaLibrary.usePermissions({
        writeOnly: true,
        granularPermissions: ["photo"],
    });
    const previewRef = useRef<View>(null);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (step === "select" && beforeUri && afterUri) setStep("preview");
    }, [beforeUri, afterUri, step]);

    const pickImage = async (slot: "before" | "after") => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: false,
                quality: 1,
            });
            if (result.canceled || !result.assets?.[0]?.uri) return;
            const uri = result.assets[0].uri;
            if (slot === "before") setBeforeUri(uri);
            else setAfterUri(uri);
        } catch (e) {
            console.error("Error picking image:", e);
            Alert.alert(
                "Unable to open photo library",
                "Please check photo permissions and try again.",
            );
        }
    };

    const clearSlot = (slot: "before" | "after") => {
        if (slot === "before") setBeforeUri(null);
        else setAfterUri(null);
        setStep("select");
    };

    const reset = () => {
        setBeforeUri(null);
        setAfterUri(null);
        setStep("select");
    };

    const handleSave = async () => {
        if (saving || !previewRef.current) return;
        setSaving(true);
        try {
            const perm = await requestMediaPermission();
            if (!perm.granted) {
                Alert.alert(
                    "Permission required",
                    "Please allow access to your photos to save the comparison image.",
                );
                return;
            }
            const uri = await captureRef(previewRef, {
                format: "jpg",
                quality: 0.95,
            });
            await MediaLibrary.createAssetAsync(uri);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            setStep("success");
        } catch (e) {
            console.error("Error saving image:", e);
            Alert.alert("Error", "Failed to save the comparison image.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <View style={styles.screen}>
                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    <Header />
                    {step === "success" && beforeUri && afterUri ? (
                        <SuccessView
                            beforeUri={beforeUri}
                            afterUri={afterUri}
                            onCreateAnother={reset}
                            onGoHome={() => router.replace("/home-screen")}
                        />
                    ) : (
                        <View style={styles.body}>
                            <Text style={styles.title}>
                                Before/After Pairing
                            </Text>
                            <Text style={styles.subtitle}>
                                {step === "preview"
                                    ? "Review your comparison and save"
                                    : "Select two photos to create a before/after comparison"}
                            </Text>

                            <View style={styles.pickerRow}>
                                <PhotoSlot
                                    label="BEFORE"
                                    uri={beforeUri}
                                    onPress={() => pickImage("before")}
                                    onClear={() => clearSlot("before")}
                                    borderColor="#693894"
                                    boxHeight={step === "preview" ? 225 : 395}
                                />
                                <PhotoSlot
                                    label="AFTER"
                                    uri={afterUri}
                                    onPress={() => pickImage("after")}
                                    onClear={() => clearSlot("after")}
                                    borderColor="#2D8682"
                                    boxHeight={step === "preview" ? 225 : 395}
                                />
                            </View>

                            {step === "select" && (
                                <View style={styles.hintBox}>
                                    {!beforeUri && !afterUri ? (
                                        <Text style={styles.hintText}>
                                            Tap the boxes above to select your
                                            before and after photos
                                        </Text>
                                    ) : (
                                        <>
                                            <Text style={styles.hintTitle}>
                                                Step 1 of 2 complete
                                            </Text>
                                            <Text style={styles.hintText}>
                                                Now select your &quot;
                                                {!beforeUri
                                                    ? "Before"
                                                    : "After"}
                                                &quot; photo
                                            </Text>
                                        </>
                                    )}
                                </View>
                            )}

                            {step === "preview" && beforeUri && afterUri && (
                                <>
                                    <Text style={styles.previewHeading}>
                                        PREVIEW
                                    </Text>
                                    <View
                                        ref={previewRef}
                                        collapsable={false}
                                        style={styles.composite}>
                                        <CompositeHalf
                                            uri={beforeUri}
                                            label="BEFORE"
                                        />
                                        <View style={styles.compositeDivider} />
                                        <CompositeHalf
                                            uri={afterUri}
                                            label="AFTER"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            actionStyles.card,
                                            { marginTop: 22 },
                                        ]}
                                        activeOpacity={0.85}
                                        onPress={handleSave}
                                        disabled={saving}>
                                        <View style={actionStyles.iconCircle}>
                                            <Download
                                                size={22}
                                                color={Palette.primaryBlack70}
                                                strokeWidth={2}
                                            />
                                        </View>
                                        <View>
                                            <Text style={actionStyles.title}>
                                                Save to Camera Roll
                                            </Text>
                                            <Text style={actionStyles.subtitle}>
                                                Download comparison image
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
                <BottomNav />
            </View>
        </>
    );
}

function PhotoSlot({
    label,
    uri,
    onPress,
    onClear,
    borderColor,
    boxHeight = 466,
}: {
    label: string;
    uri: string | null;
    onPress: () => void;
    onClear: () => void;
    borderColor: string;
    boxHeight?: number;
}) {
    return (
        <View style={slotStyles.column}>
            <Text style={slotStyles.label}>{label}</Text>
            {uri ? (
                <View
                    style={[
                        slotStyles.filledBox,
                        { borderColor, height: boxHeight },
                    ]}>
                    <Image
                        source={{ uri }}
                        style={slotStyles.image}
                        resizeMode="cover"
                    />
                    <View style={slotStyles.tag}>
                        <Text style={slotStyles.tagText}>{label}</Text>
                    </View>
                    <TouchableOpacity
                        style={slotStyles.clearButton}
                        onPress={onClear}
                        hitSlop={8}>
                        <X
                            size={16}
                            color="#6D6E71"
                            strokeWidth={2.5}
                        />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={slotStyles.emptyBox}
                    activeOpacity={0.7}
                    onPress={onPress}>
                    <Plus
                        size={48}
                        color={Palette.primaryBlack70}
                        strokeWidth={2}
                    />
                    <Text style={slotStyles.placeholderText}>Select Photo</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function CompositeHalf({ uri, label }: { uri: string; label: string }) {
    return (
        <View style={compositeStyles.half}>
            <Image
                source={{ uri }}
                style={compositeStyles.image}
                resizeMode="cover"
            />
            <View style={slotStyles.tag}>
                <Text style={slotStyles.tagText}>{label}</Text>
            </View>
        </View>
    );
}

function SuccessView({
    beforeUri,
    afterUri,
    onCreateAnother,
    onGoHome,
}: {
    beforeUri: string;
    afterUri: string;
    onCreateAnother: () => void;
    onGoHome: () => void;
}) {
    return (
        <View style={successStyles.container}>
            <View style={successStyles.checkCircle}>
                <View style={successStyles.checkInner}>
                    <Check
                        size={24}
                        color="#FFFFFF"
                        strokeWidth={3}
                    />
                </View>
            </View>
            <Text style={successStyles.title}>Saved Successfully!</Text>
            <Text style={successStyles.subtitle}>
                Your before/after comparison has been saved to your camera roll
            </Text>
            <View style={successStyles.composite}>
                <CompositeHalf
                    uri={beforeUri}
                    label="BEFORE"
                />
                <View style={styles.compositeDivider} />
                <CompositeHalf
                    uri={afterUri}
                    label="AFTER"
                />
            </View>
            <ActionCard
                icon={
                    <Plus
                        size={22}
                        color={Palette.primaryBlack70}
                        strokeWidth={2}
                    />
                }
                title="Create Another"
                subtitle="Make a new comparison"
                onPress={onCreateAnother}
            />
            <ActionCard
                icon={
                    <House
                        size={22}
                        color={Palette.primaryBlack70}
                        strokeWidth={2}
                    />
                }
                title="Go to Home"
                subtitle="Return to main screen"
                onPress={onGoHome}
            />
        </View>
    );
}

function ActionCard({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={actionStyles.card}
            activeOpacity={0.85}
            onPress={onPress}>
            <View style={actionStyles.iconCircle}>{icon}</View>
            <View>
                <Text style={actionStyles.title}>{title}</Text>
                <Text style={actionStyles.subtitle}>{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    title: {
        fontFamily: "Lato_700Bold",
        fontSize: 20,
        lineHeight: 35,
        letterSpacing: 0.38,
        color: Palette.primaryPurple70,
        textAlign: "center",
    },
    subtitle: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        color: Palette.primaryBlack70,
        textAlign: "center",
        marginTop: 8,
    },
    pickerRow: {
        flexDirection: "row",
        gap: 14,
        marginTop: 24,
    },
    hintBox: {
        backgroundColor: "#F0F0F0",
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 20,
        marginTop: 20,
        alignItems: "center",
    },
    hintTitle: {
        fontWeight: "700",
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: -0.15,
        color: "#693894",
        textAlign: "center",
    },
    hintText: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        color: Palette.primaryBlack70,
        textAlign: "center",
    },
    previewHeading: {
        fontFamily: "Lato_700Bold",
        fontSize: 14,
        color: Palette.primaryBlack70,
        textAlign: "center",
        letterSpacing: 1,
        marginTop: 28,
        marginBottom: 12,
    },
    composite: {
        flexDirection: "row",
        height: 280,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: Palette.primaryPurple70,
        backgroundColor: "#000",
    },
    compositeDivider: {
        width: 3,
        height: "100%",
        backgroundColor: "#FFFFFF",
    },
});

const slotStyles = StyleSheet.create({
    column: {
        flex: 1,
    },
    label: {
        fontFamily: "Lato_700Bold",
        fontSize: 13,
        color: Palette.primaryBlack70,
        textAlign: "center",
        letterSpacing: 1,
        marginBottom: 10,
    },
    emptyBox: {
        height: 395,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: Palette.primaryBlack30,
        borderStyle: "dashed",
        backgroundColor: "#F5F5F5",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    placeholderText: {
        fontFamily: "Lato_700Bold",
        fontSize: 14,
        color: Palette.primaryBlack70,
    },
    filledBox: {
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1.5,
    },
    image: {
        width: "100%",
        height: "100%",
    },
    tag: {
        position: "absolute",
        top: 9.49,
        left: 9.49,
        width: 56.85,
        height: 22.98,
        backgroundColor: "#000000B2",
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    tagText: {
        color: "#FFFFFF",
        fontFamily: "Lato_700Bold",
        fontSize: 11,
        letterSpacing: 0.5,
    },
    clearButton: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
});

const compositeStyles = StyleSheet.create({
    half: {
        flex: 1,
        backgroundColor: "#000",
    },
    image: {
        width: "100%",
        height: "100%",
    },
});

const successStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: "center",
    },
    checkCircle: {
        width: 75,
        height: 70,
        borderRadius: 9999,
        backgroundColor: Palette.teal,
        alignItems: "center",
        justifyContent: "center",
    },
    checkInner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: "#FFFFFF",
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "Lato_700Bold",
        fontSize: 26,
        color: "#000000",
        marginTop: 18,
    },
    subtitle: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        color: Palette.primaryBlack70,
        textAlign: "center",
        marginTop: 8,
        paddingHorizontal: 20,
    },
    composite: {
        flexDirection: "row",
        height: 220,
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: Palette.teal,
        backgroundColor: "#000",
        marginTop: 24,
    },
});

const actionStyles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "stretch",
        gap: 14,
        paddingHorizontal: 42,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        borderWidth: 0.75,
        borderColor: "#E5E5E5",
        height: 81,
        marginTop: 20,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F0F0F0",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: "#000000",
    },
    subtitle: {
        fontFamily: "Lato_400Regular",
        fontSize: 13,
        color: Palette.primaryBlack70,
        marginTop: 2,
    },
});
