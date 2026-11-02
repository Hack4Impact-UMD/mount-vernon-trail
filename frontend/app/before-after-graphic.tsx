import {
    listAlbumPhotos,
    type GooglePhotosMediaItem,
    uploadGraphic,
} from "@/api/backend-client";
import BottomNav from "@/components/ui/bottom-nav";
import Header from "@/components/ui/header";
import { Palette } from "@/constants/theme";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getAllEvents, type Event } from "@/services/event-service";
import { getTrelloClient } from "@/services/trello-config";
import { fetchDocumentTrailIssues } from "@/services/trello-service";
import type { TrailDocumentIssueItem } from "@/types/trail-types";
import { getErrorMessage } from "@/utils/errors";
import { useRouter } from "expo-router";
import { Check, House, X } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

type Step = "select" | "preview" | "success";
type PhotoSlot = "before" | "after";
type SelectablePhoto = GooglePhotosMediaItem & {
    slot: PhotoSlot;
    uri: string;
};

const TRELLO_API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY ?? "";

function slotForPhoto(photo: GooglePhotosMediaItem): PhotoSlot | null {
    const filename = photo.filename ?? "";
    const description = photo.description?.trim() ?? "";
    if (
        /(?:^|[-_\s])before(?:\.[^.]+)?$/i.test(filename) ||
        /\bbefore\s*$/i.test(description)
    ) {
        return "before";
    }
    if (
        /(?:^|[-_\s])after(?:\.[^.]+)?$/i.test(filename) ||
        /\bafter\s*$/i.test(description)
    ) {
        return "after";
    }
    return null;
}

function photoUri(photo: GooglePhotosMediaItem): string | null {
    if (!photo.baseUrl) return null;
    return `${photo.baseUrl}=w480-h480-c`;
}

async function loadEventPhotos(albumId: string): Promise<SelectablePhoto[]> {
    const photos: SelectablePhoto[] = [];
    let pageToken: string | undefined;
    do {
        const page = await listAlbumPhotos(albumId, pageToken);
        for (const photo of page.mediaItems) {
            const slot = slotForPhoto(photo);
            const uri = photoUri(photo);
            if (slot && uri && photo.mimeType?.startsWith("image/")) {
                photos.push({ ...photo, slot, uri });
            }
        }
        pageToken = page.nextPageToken;
    } while (pageToken);
    return photos;
}

function eventDate(event: Event): number {
    return event.date?.toMillis() ?? 0;
}

function safeFilePart(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}

function compositeAspectRatio(before: SelectablePhoto, after: SelectablePhoto) {
    const aspectRatio = (photo: SelectablePhoto) => {
        const width = Number(photo.mediaMetadata?.width);
        const height = Number(photo.mediaMetadata?.height);
        return width > 0 && height > 0 ? width / height : 4 / 3;
    };
    return ((aspectRatio(before) + aspectRatio(after)) / 2) * 2;
}

export default function BeforeAfterGraphicScreen() {
    const router = useRouter();
    const isAdmin = useIsAdmin();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [issues, setIssues] = useState<TrailDocumentIssueItem[]>([]);
    const [selectedIssue, setSelectedIssue] =
        useState<TrailDocumentIssueItem | null>(null);
    const [photos, setPhotos] = useState<SelectablePhoto[]>([]);
    const [beforePhoto, setBeforePhoto] = useState<SelectablePhoto | null>(
        null,
    );
    const [afterPhoto, setAfterPhoto] = useState<SelectablePhoto | null>(null);
    const [activeSlot, setActiveSlot] = useState<PhotoSlot>("before");
    const [step, setStep] = useState<Step>("select");
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [loadingEventData, setLoadingEventData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadedPreviewIds, setLoadedPreviewIds] = useState<Set<string>>(
        new Set(),
    );
    const previewRef = useRef<View>(null);

    useEffect(() => {
        if (isAdmin !== true) return;
        let cancelled = false;
        getAllEvents()
            .then((allEvents) => {
                if (!cancelled) {
                    setEvents(
                        allEvents
                            .filter((event) => Boolean(event.albumId))
                            .sort((a, b) => eventDate(b) - eventDate(a)),
                    );
                }
            })
            .catch((loadError: unknown) => {
                if (!cancelled) setError(getErrorMessage(loadError));
            })
            .finally(() => {
                if (!cancelled) setLoadingEvents(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    useEffect(() => {
        if (!selectedEvent) return;
        const event = selectedEvent;
        let cancelled = false;

        async function loadPairingData() {
            if (!TRELLO_API_KEY) {
                throw new Error("Missing Trello API credentials.");
            }
            const [eventPhotos, eventCard] = await Promise.all([
                loadEventPhotos(event.albumId),
                getTrelloClient(TRELLO_API_KEY).getEventCardByID(
                    event.trelloCardId,
                    true,
                ),
            ]);
            const eventIssues = await fetchDocumentTrailIssues(
                TRELLO_API_KEY,
                eventCard,
            );
            if (cancelled) return;
            setPhotos(eventPhotos);
            setIssues(eventIssues);
        }

        loadPairingData()
            .catch((loadError: unknown) => {
                if (!cancelled) setError(getErrorMessage(loadError));
            })
            .finally(() => {
                if (!cancelled) setLoadingEventData(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedEvent]);

    const selectEvent = (event: Event) => {
        setStep("select");
        setLoadingEventData(true);
        setError(null);
        setSelectedIssue(null);
        setIssues([]);
        setPhotos([]);
        setBeforePhoto(null);
        setAfterPhoto(null);
        setActiveSlot("before");
        setSelectedEvent(event);
    };

    const selectIssue = (issue: TrailDocumentIssueItem | null) => {
        setSelectedIssue(issue);
        setBeforePhoto(null);
        setAfterPhoto(null);
        setActiveSlot("before");
        setError(null);
    };

    const selectPhoto = (photo: SelectablePhoto) => {
        if (
            photo.id ===
            (activeSlot === "before" ? afterPhoto?.id : beforePhoto?.id)
        ) {
            setError("Choose two different photos for this comparison.");
            return;
        }
        if (activeSlot === "before") {
            setBeforePhoto(photo);
            setActiveSlot("after");
        } else {
            setAfterPhoto(photo);
        }
        setError(null);
    };

    const rejectPair = () => {
        setBeforePhoto(null);
        setAfterPhoto(null);
        setActiveSlot("before");
        setLoadedPreviewIds(new Set());
        setStep("select");
        setError(null);
    };

    const reviewPair = () => {
        setLoadedPreviewIds(new Set());
        setError(null);
        setStep("preview");
    };

    const approvePair = async () => {
        if (
            saving ||
            !previewRef.current ||
            !selectedEvent ||
            !selectedIssue ||
            !beforePhoto ||
            !afterPhoto
        ) {
            return;
        }
        if (
            !loadedPreviewIds.has(beforePhoto.id) ||
            !loadedPreviewIds.has(afterPhoto.id)
        ) {
            setError(
                "Wait for both photos to finish loading before approving.",
            );
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const uri = await captureRef(previewRef, {
                format: "jpg",
                quality: 0.95,
            });
            const eventTag = `event-${safeFilePart(selectedEvent.eventId)}`;
            const issueTag = `issue-${safeFilePart(selectedIssue.id)}`;
            await uploadGraphic(selectedEvent.albumId, {
                uri,
                fileName: `${issueTag}-${eventTag}-before-after.jpg`,
                mimeType: "image/jpeg",
                description:
                    `Before/after graphic for "${selectedIssue.name}" ` +
                    `— issueId=${selectedIssue.id}; event="${selectedEvent.title}" ` +
                    `— eventId=${selectedEvent.eventId}; ` +
                    `beforePhotoId=${beforePhoto.id}; afterPhotoId=${afterPhoto.id}`,
            });
            setStep("success");
        } catch (uploadError: unknown) {
            setError(getErrorMessage(uploadError));
        } finally {
            setSaving(false);
        }
    };

    const isPreviewReady =
        beforePhoto !== null &&
        afterPhoto !== null &&
        loadedPreviewIds.has(beforePhoto.id) &&
        loadedPreviewIds.has(afterPhoto.id);

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Header />
                <View style={styles.body}>
                    <Text style={styles.title}>Before/After Pairing</Text>
                    <Text style={styles.subtitle}>
                        Match photos to a trail issue, review the graphic, and
                        approve it to the event album.
                    </Text>

                    {isAdmin === null || (isAdmin && loadingEvents) ? (
                        <ActivityIndicator
                            style={styles.loader}
                            size="large"
                            color={Palette.primaryPurple100}
                        />
                    ) : !isAdmin ? (
                        <View style={styles.messageCard}>
                            <Text style={styles.messageTitle}>
                                Admin access required
                            </Text>
                            <Text style={styles.messageText}>
                                Only admins can create and upload before/after
                                graphics.
                            </Text>
                        </View>
                    ) : step === "success" && beforePhoto && afterPhoto ? (
                        <SuccessView
                            beforePhoto={beforePhoto}
                            afterPhoto={afterPhoto}
                            event={selectedEvent}
                            issue={selectedIssue}
                            onCreateAnother={rejectPair}
                            onGoHome={() => router.replace("/home-screen")}
                        />
                    ) : (
                        <>
                            {!selectedEvent ? (
                                <SelectionSection title="1. Select an event">
                                    {events.length === 0 ? (
                                        <Text style={styles.messageText}>
                                            No events with photo albums are
                                            available.
                                        </Text>
                                    ) : (
                                        events.map((event) => (
                                            <ChoiceRow
                                                key={event.eventId}
                                                title={event.title}
                                                subtitle={`Event album · ${event.date.toDate().toLocaleDateString()}`}
                                                onPress={() =>
                                                    selectEvent(event)
                                                }
                                            />
                                        ))
                                    )}
                                </SelectionSection>
                            ) : (
                                <>
                                    <ChoiceRow
                                        title={selectedEvent.title}
                                        subtitle="Selected event"
                                        actionLabel="Change"
                                        onPress={() => {
                                            setSelectedEvent(null);
                                            setSelectedIssue(null);
                                            setStep("select");
                                            setError(null);
                                        }}
                                    />
                                    {loadingEventData ? (
                                        <ActivityIndicator
                                            style={styles.loader}
                                            size="large"
                                            color={Palette.primaryPurple100}
                                        />
                                    ) : !selectedIssue ? (
                                        <SelectionSection title="2. Select a trail issue">
                                            {issues.length === 0 ? (
                                                <Text
                                                    style={styles.messageText}>
                                                    No Trello issues are linked
                                                    to this event.
                                                </Text>
                                            ) : (
                                                issues.map((issue) => (
                                                    <ChoiceRow
                                                        key={issue.id}
                                                        title={issue.name}
                                                        subtitle="Trello trail issue"
                                                        onPress={() =>
                                                            selectIssue(issue)
                                                        }
                                                    />
                                                ))
                                            )}
                                        </SelectionSection>
                                    ) : (
                                        <>
                                            <ChoiceRow
                                                title={selectedIssue.name}
                                                subtitle={`Issue · ${selectedEvent.title}`}
                                                actionLabel="Change"
                                                onPress={() =>
                                                    selectIssue(null)
                                                }
                                            />
                                            <View style={styles.section}>
                                                <Text
                                                    style={styles.sectionTitle}>
                                                    3. Match the photos
                                                </Text>
                                                <View
                                                    style={styles.slotButtons}>
                                                    <SlotButton
                                                        label="BEFORE"
                                                        selected={
                                                            activeSlot ===
                                                            "before"
                                                        }
                                                        filled={Boolean(
                                                            beforePhoto,
                                                        )}
                                                        onPress={() =>
                                                            setActiveSlot(
                                                                "before",
                                                            )
                                                        }
                                                    />
                                                    <SlotButton
                                                        label="AFTER"
                                                        selected={
                                                            activeSlot ===
                                                            "after"
                                                        }
                                                        filled={Boolean(
                                                            afterPhoto,
                                                        )}
                                                        onPress={() =>
                                                            setActiveSlot(
                                                                "after",
                                                            )
                                                        }
                                                    />
                                                </View>
                                                <Text
                                                    style={styles.sectionHint}>
                                                    Select a{" "}
                                                    {activeSlot.toUpperCase()}{" "}
                                                    photo from this event&apos;s
                                                    album.
                                                </Text>
                                                <View style={styles.photoGrid}>
                                                    {photos
                                                        .filter(
                                                            (photo) =>
                                                                photo.slot ===
                                                                activeSlot,
                                                        )
                                                        .map((photo) => (
                                                            <PhotoChoice
                                                                key={photo.id}
                                                                photo={photo}
                                                                selected={
                                                                    photo.id ===
                                                                    (activeSlot ===
                                                                    "before"
                                                                        ? beforePhoto?.id
                                                                        : afterPhoto?.id)
                                                                }
                                                                onPress={() =>
                                                                    selectPhoto(
                                                                        photo,
                                                                    )
                                                                }
                                                            />
                                                        ))}
                                                </View>
                                                {photos.filter(
                                                    (photo) =>
                                                        photo.slot ===
                                                        activeSlot,
                                                ).length === 0 && (
                                                    <Text
                                                        style={
                                                            styles.messageText
                                                        }>
                                                        No {activeSlot} photos
                                                        were found in this event
                                                        album.
                                                    </Text>
                                                )}
                                                {beforePhoto && afterPhoto && (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.primaryButton,
                                                            { marginTop: 20 },
                                                        ]}
                                                        activeOpacity={0.85}
                                                        onPress={reviewPair}>
                                                        <Text
                                                            style={
                                                                styles.primaryButtonText
                                                            }>
                                                            Preview graphic
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </>
                            )}

                            {step === "preview" &&
                                beforePhoto &&
                                afterPhoto &&
                                selectedIssue &&
                                selectedEvent && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>
                                            Review before approving
                                        </Text>
                                        <Text style={styles.sectionHint}>
                                            {selectedIssue.name} ·{" "}
                                            {selectedEvent.title}
                                        </Text>
                                        <View
                                            ref={previewRef}
                                            collapsable={false}
                                            style={[
                                                styles.composite,
                                                {
                                                    aspectRatio:
                                                        compositeAspectRatio(
                                                            beforePhoto,
                                                            afterPhoto,
                                                        ),
                                                },
                                            ]}>
                                            <CompositeHalf
                                                photo={beforePhoto}
                                                label="BEFORE"
                                                onLoad={() =>
                                                    setLoadedPreviewIds(
                                                        (current) =>
                                                            new Set([
                                                                ...current,
                                                                beforePhoto.id,
                                                            ]),
                                                    )
                                                }
                                                onError={() =>
                                                    setError(
                                                        "The before photo could not be loaded. Choose another photo and try again.",
                                                    )
                                                }
                                            />
                                            <View
                                                style={styles.compositeDivider}
                                            />
                                            <CompositeHalf
                                                photo={afterPhoto}
                                                label="AFTER"
                                                onLoad={() =>
                                                    setLoadedPreviewIds(
                                                        (current) =>
                                                            new Set([
                                                                ...current,
                                                                afterPhoto.id,
                                                            ]),
                                                    )
                                                }
                                                onError={() =>
                                                    setError(
                                                        "The after photo could not be loaded. Choose another photo and try again.",
                                                    )
                                                }
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={[
                                                styles.primaryButton,
                                                !isPreviewReady &&
                                                    styles.disabledButton,
                                            ]}
                                            activeOpacity={0.85}
                                            onPress={approvePair}
                                            disabled={
                                                saving || !isPreviewReady
                                            }>
                                            {saving ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text
                                                    style={
                                                        styles.primaryButtonText
                                                    }>
                                                    Approve and save to event
                                                    album
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rejectButton}
                                            activeOpacity={0.8}
                                            onPress={rejectPair}
                                            disabled={saving}>
                                            <X
                                                size={18}
                                                color={Palette.primaryBlack70}
                                            />
                                            <Text
                                                style={styles.rejectButtonText}>
                                                Reject and choose another pair
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                        </>
                    )}

                    {error && <Text style={styles.errorText}>{error}</Text>}
                </View>
            </ScrollView>
            <BottomNav />
        </View>
    );
}

function SelectionSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function ChoiceRow({
    title,
    subtitle,
    actionLabel,
    onPress,
}: {
    title: string;
    subtitle: string;
    actionLabel?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.choiceRow}
            activeOpacity={0.8}
            onPress={onPress}>
            <View style={styles.choiceText}>
                <Text
                    style={styles.choiceTitle}
                    numberOfLines={1}>
                    {title}
                </Text>
                <Text
                    style={styles.choiceSubtitle}
                    numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
            <Text style={styles.choiceAction}>{actionLabel ?? "Select"}</Text>
        </TouchableOpacity>
    );
}

function SlotButton({
    label,
    selected,
    filled,
    onPress,
}: {
    label: string;
    selected: boolean;
    filled: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[
                styles.slotButton,
                selected && styles.selectedSlotButton,
                filled && styles.filledSlotButton,
            ]}
            onPress={onPress}
            activeOpacity={0.8}>
            <Text
                style={[
                    styles.slotButtonText,
                    selected && styles.selectedSlotButtonText,
                ]}>
                {label}
                {filled ? "  SELECTED" : ""}
            </Text>
        </TouchableOpacity>
    );
}

function PhotoChoice({
    photo,
    selected,
    onPress,
}: {
    photo: SelectablePhoto;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.photoChoice, selected && styles.selectedPhotoChoice]}
            activeOpacity={0.8}
            onPress={onPress}>
            <Image
                source={{ uri: photo.uri }}
                style={styles.photoThumbnail}
                resizeMode="cover"
            />
            {selected && (
                <View style={styles.selectedBadge}>
                    <Check
                        size={16}
                        color="#fff"
                        strokeWidth={3}
                    />
                </View>
            )}
            <Text
                style={styles.photoName}
                numberOfLines={1}>
                {photo.filename ?? photo.description ?? photo.slot}
            </Text>
        </TouchableOpacity>
    );
}

function CompositeHalf({
    photo,
    label,
    onLoad,
    onError,
}: {
    photo: SelectablePhoto;
    label: string;
    onLoad: () => void;
    onError: () => void;
}) {
    return (
        <View style={compositeStyles.half}>
            <Image
                source={{ uri: `${photo.baseUrl}=w1200-h1200` }}
                style={compositeStyles.image}
                resizeMode="contain"
                onLoad={onLoad}
                onError={onError}
            />
            <View style={compositeStyles.labelBrush}>
                <Svg
                    viewBox="0 0 460 130"
                    preserveAspectRatio="none"
                    style={StyleSheet.absoluteFill}>
                    <Path
                        d="M0 13 Q22 3 48 9 L405 8 Q424 7 420 18 L438 27 L421 39 L432 50 L415 62 L430 74 L409 85 L422 98 L401 111 L409 122 L0 122 Z"
                        fill="#FFFFFF"
                    />
                </Svg>
                <Text style={compositeStyles.labelText}>{label}</Text>
            </View>
        </View>
    );
}

function SuccessView({
    beforePhoto,
    afterPhoto,
    event,
    issue,
    onCreateAnother,
    onGoHome,
}: {
    beforePhoto: SelectablePhoto;
    afterPhoto: SelectablePhoto;
    event: Event | null;
    issue: TrailDocumentIssueItem | null;
    onCreateAnother: () => void;
    onGoHome: () => void;
}) {
    return (
        <View style={successStyles.container}>
            <View style={successStyles.checkCircle}>
                <Check
                    size={24}
                    color="#FFFFFF"
                    strokeWidth={3}
                />
            </View>
            <Text style={successStyles.title}>Saved Successfully!</Text>
            <Text style={successStyles.subtitle}>
                The graphic for {issue?.name} was saved to the {event?.title}{" "}
                Google Photos album.
            </Text>
            <View
                style={[
                    successStyles.composite,
                    {
                        aspectRatio: compositeAspectRatio(
                            beforePhoto,
                            afterPhoto,
                        ),
                    },
                ]}>
                <CompositeHalf
                    photo={beforePhoto}
                    label="BEFORE"
                    onLoad={() => undefined}
                    onError={() => undefined}
                />
                <View style={styles.compositeDivider} />
                <CompositeHalf
                    photo={afterPhoto}
                    label="AFTER"
                    onLoad={() => undefined}
                    onError={() => undefined}
                />
            </View>
            <ActionCard
                icon={
                    <Check
                        size={22}
                        color={Palette.primaryBlack70}
                        strokeWidth={2}
                    />
                }
                title="Create Another"
                subtitle={`Make another graphic for ${event?.title}`}
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
            <View style={actionStyles.textContainer}>
                <Text style={actionStyles.title}>{title}</Text>
                <Text
                    style={actionStyles.subtitle}
                    numberOfLines={1}>
                    {subtitle}
                </Text>
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
    loader: {
        marginTop: 32,
    },
    section: {
        marginTop: 26,
    },
    sectionTitle: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: Palette.primaryBlack70,
        marginBottom: 12,
    },
    sectionHint: {
        fontFamily: "Lato_400Regular",
        fontSize: 13,
        color: Palette.primaryBlack70,
        marginTop: 12,
        marginBottom: 10,
    },
    choiceRow: {
        minHeight: 66,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E5E5",
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
    },
    choiceText: {
        flex: 1,
        paddingRight: 12,
    },
    choiceTitle: {
        fontFamily: "Lato_700Bold",
        fontSize: 15,
        color: Palette.primaryBlack70,
    },
    choiceSubtitle: {
        fontFamily: "Lato_400Regular",
        fontSize: 12,
        color: "#777",
        marginTop: 3,
    },
    choiceAction: {
        fontFamily: "Lato_700Bold",
        fontSize: 13,
        color: Palette.primaryPurple70,
    },
    slotButtons: {
        flexDirection: "row",
        gap: 10,
    },
    slotButton: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#DADADA",
        backgroundColor: "#fff",
    },
    selectedSlotButton: {
        borderColor: Palette.primaryPurple70,
        backgroundColor: "#F4EFF8",
    },
    filledSlotButton: {
        borderColor: Palette.teal,
    },
    slotButtonText: {
        fontFamily: "Lato_700Bold",
        fontSize: 13,
        color: Palette.primaryBlack70,
        letterSpacing: 0.5,
    },
    selectedSlotButtonText: {
        color: Palette.primaryPurple70,
    },
    photoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 10,
    },
    photoChoice: {
        width: "48%",
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "transparent",
        overflow: "hidden",
        backgroundColor: "#F3F3F3",
    },
    selectedPhotoChoice: {
        borderColor: Palette.primaryPurple70,
    },
    photoThumbnail: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "#E5E5E5",
    },
    selectedBadge: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Palette.primaryPurple70,
    },
    photoName: {
        paddingHorizontal: 8,
        paddingVertical: 7,
        fontFamily: "Lato_400Regular",
        fontSize: 11,
        color: Palette.primaryBlack70,
    },
    primaryButton: {
        minHeight: 52,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        backgroundColor: Palette.primaryPurple70,
    },
    primaryButtonText: {
        color: "#fff",
        fontFamily: "Lato_700Bold",
        fontSize: 15,
        textAlign: "center",
    },
    disabledButton: {
        opacity: 0.5,
    },
    rejectButton: {
        flexDirection: "row",
        gap: 8,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    rejectButtonText: {
        fontFamily: "Lato_700Bold",
        fontSize: 14,
        color: Palette.primaryBlack70,
    },
    composite: {
        flexDirection: "row",
        overflow: "hidden",
        marginTop: 12,
        backgroundColor: "#000",
    },
    compositeDivider: {
        width: 6,
        height: "100%",
        backgroundColor: "#FFFFFF",
    },
    messageCard: {
        marginTop: 24,
        padding: 18,
        borderRadius: 12,
        backgroundColor: "#F5F5F5",
    },
    messageTitle: {
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        color: Palette.primaryBlack70,
        marginBottom: 6,
    },
    messageText: {
        fontFamily: "Lato_400Regular",
        fontSize: 14,
        lineHeight: 20,
        color: Palette.primaryBlack70,
    },
    errorText: {
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#FFF0F0",
        color: "#B42318",
        fontFamily: "Lato_400Regular",
        fontSize: 13,
        lineHeight: 18,
    },
});

const compositeStyles = StyleSheet.create({
    half: {
        flex: 1,
        backgroundColor: "#000",
        overflow: "hidden",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    labelBrush: {
        position: "absolute",
        left: 0,
        bottom: 0,
        width: "47%",
        height: "21%",
        justifyContent: "center",
    },
    labelText: {
        color: "#302923",
        fontFamily: "Lato_700Bold",
        fontSize: 16,
        letterSpacing: -0.5,
        marginLeft: 6,
        marginTop: 1,
    },
});

const successStyles = StyleSheet.create({
    container: {
        paddingTop: 24,
        alignItems: "center",
    },
    checkCircle: {
        width: 70,
        height: 70,
        borderRadius: 9999,
        backgroundColor: Palette.teal,
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
        paddingHorizontal: 12,
    },
    composite: {
        width: "100%",
        marginTop: 24,
        overflow: "hidden",
        flexDirection: "row",
        backgroundColor: "#000",
    },
});

const actionStyles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "stretch",
        gap: 14,
        paddingHorizontal: 24,
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
    textContainer: {
        flex: 1,
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
