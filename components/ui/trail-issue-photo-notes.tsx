import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PhotoSlot = "before" | "after";
interface Props {
    beforeImageUri: string | null;
    afterImageUri: string | null;
    notes:string;
    onNotesChange: (text:string) => void;
}

const TrailDropdown: React.FC<Props> = ({ beforeImageUri, afterImageUri, notes, onNotesChange }) => {
    const router = useRouter();

    const handlePhotoPress = async (slot: PhotoSlot) => {
        router.push({
            pathname: "/camera-view",
            params: {
                mode: slot,
                beforeImageUri: beforeImageUri ?? "",
            },
        });
    };

    const photos = {
        before: beforeImageUri,
        after: afterImageUri,
    };

    const PhotoCard = ({ slot, label }: { slot: PhotoSlot; label: string }) => (
        <TouchableOpacity
            style={styles.photoCard}
            onPress={() => handlePhotoPress(slot)}
            activeOpacity={0.75}
            accessibilityLabel={`${label} photo`}
            accessibilityRole="button">
            {photos[slot] ? (
                <Image
                    source={{ uri: photos[slot] as string }}
                    style={styles.photoImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.photoPlaceholder}>
                    <Image
                    source={require('../../assets/images/camera-purple.png')}
                    style={styles.cameraIcon} />
                    <Text style={styles.photoLabel}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>PHOTOS</Text>
            <View style={styles.photoRow}>
                <PhotoCard
                    slot="before"
                    label="Before"
                />
                <PhotoCard
                    slot="after"
                    label="After"
                />
            </View>

            <Text style={[styles.sectionTitle, styles.notesTitleSpacing]}>
                NOTES
            </Text>
            <TextInput
                style={styles.notesInput}
                placeholder="Any barriers, successes or metrics"
                placeholderTextColor="#6d6e71"
                value={notes}
                onChangeText={onNotesChange}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Notes input"
            />
        </View>
    );
};

const PURPLE = "#8A6BAD";
const PURPLE_LIGHT = "#FAF8FC";
const PURPLE_BORDER = "#C4B4D7";
const TEXT_DARK = "#666666";

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: "#FFFFFF",
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 1.2,
        color: TEXT_DARK,
        marginBottom: 12,
    },
    notesTitleSpacing: {
        marginTop: 24,
    },

    photoRow: {
        flexDirection: "row",
        gap: 12,
    },
    photoCard: {
        flex: 1,
        aspectRatio: 1.65,
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: PURPLE_BORDER,
        overflow: "hidden",
    },
    photoPlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    photoLabel: {
        fontSize: 15,
        color: PURPLE,
        fontWeight: "500",
    },
    photoImage: {
        width: "100%",
        height: "100%",
    },

    notesInput: {
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: PURPLE_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: "#000000",
        minHeight: 100,
        lineHeight: 22,
    },
    cameraIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
},
});

export default TrailDropdown;
