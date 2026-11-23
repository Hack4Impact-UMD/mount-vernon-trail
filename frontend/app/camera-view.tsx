import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
// SDK 56 moved these calls to /legacy; the root import now throws at runtime.
import * as MediaLibrary from 'expo-media-library/legacy';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Button, Image, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { enqueuePhoto, flushInBackground } from '@/services/photo-queue';
import { getErrorMessage } from '@/utils/errors';
import Slider from '@react-native-community/slider';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Palette } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// icons
import BoltIcon from '@/components/icons/bolt';
import CameraSwitch from '@/components/icons/camera-switch';
import Refresh from '@/components/icons/refresh';
import Checkbox from '@/components/icons/checkbox';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Zoom change per doubling of finger distance; 0 to 1 is the expo-camera's full range
const PINCH_SENSITIVITY = 0.25; // Constant factor to adjust the sensitivity of pinch zoom gestures
const ZOOM_STEP = 0.1;

export default function CameraViewScreen() {
    const insets = useSafeAreaInsets();
    const [showGrid, setShowGrid] = useState(false);
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
        writeOnly: true,
        granularPermissions: ['photo'],
    });
    const [recentPhoto, setRecentPhoto] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [flashAnim] = useState(() => new Animated.Value(0));
    const cameraRef = useRef<CameraView | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0.3);
    const [zoom, setZoom] = useState(0);
    // Shared values rather than refs: the gesture callbacks are handed to the
    // builder during render, and the React Compiler rejects ref reads there.
    const currentZoom = useSharedValue(0);
    const startZoom = useSharedValue(0);
    const [flash, setFlash] = useState<'off' | 'on'>('off');
    // when navigated from the trail document screen
    const router = useRouter();
    // The standalone "Take After Picture" entry point on the home screen passes
    // only `mode`, so every issue-scoped param has to stay optional.
    const { beforeImageUri, activeIssueId, issueName, eventId, albumId, mode } = useLocalSearchParams<{
        beforeImageUri?: string;
        activeIssueId?: string; // keep track of issue card user pressed
        issueName?: string;
        eventId?: string;
        albumId?: string;
        mode?: 'before' | 'after';
    }>();
    const resolveMode = mode === 'after' ? 'after' : 'before';
    // overlay is set to before image, but user can still has option to choose from their gallary
    const [overlayUri, setOverlayUri] = useState<string | null>(
        resolveMode === 'after' ? (beforeImageUri ?? null) : null
    );
    const [viewState, setViewState] = useState<'camera' | 'confirmation'>('camera');
    const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);

    if (!permission) {
        // camera perms are still loading
        return <View />;
    }

    if (!permission.granted) {
        // user denies camera perms
        return (
            <View style={styles.container}>
            <Text style={styles.message}>We need your permission to show the camera</Text>
            <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    function toggleCameraFacing() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }
    function toggleFlash() {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    }
    function applyZoom(next: number) {
        const clamped = Math.min(1, Math.max(0, next));
        currentZoom.set(clamped);
        setZoom(clamped);
    }

    // The previous equation made it so that zooming out was half as effective as zooming in
    // using log2 makes pinch symmetric: the user spreading their fingers 2x or 0.5x to zoom
    // in or out zooms by the same amount. old linear {(scale - 1) * 0.12} also only ran while fingers moved
    // so zoom might stall short of the target
    const pinchGesture = Gesture.Pinch().runOnJS(true).onStart(() => {
        startZoom.set(currentZoom.get());
    }).onUpdate((e) => {
        const target = startZoom.get() + Math.log2(e.scale) * PINCH_SENSITIVITY;
        applyZoom(target); //ensures zoom is between 0 and 1 along with updating currentZoom shared value
    });

    async function takePhoto() {
        try {
            setIsCapturing(true);

            // white flash to indicate photo capture
            Animated.sequence([
                Animated.timing(flashAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: false,
                }),
                Animated.timing(flashAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                }),
            ]).start();

            const photo = await cameraRef.current?.takePictureAsync();
            if (!photo) return;

            setCapturedPhotoUri(photo.uri);
            setRecentPhoto(photo.uri);
            setViewState('confirmation');
        } catch (error) {
            console.error('Error taking photo:', error);
        } finally {
            setIsCapturing(false);
        }
    }

    async function openPhotoLibrary() {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });
            // overlay
            if (result.canceled || !result.assets?.[0]?.uri) return;
            const selectedPhoto = result.assets?.[0]?.uri;
            if (resolveMode === 'before') {
                setCapturedPhotoUri(selectedPhoto);
                setRecentPhoto(selectedPhoto);
                setViewState('confirmation');
            } else {
                setOverlayUri(selectedPhoto);
            }
        } catch (error) {
            console.error('Error opening photo library:', error);
        }
    }
    // Best-effort copy into the device camera roll. A refusal here must not
    // cost the volunteer the photo — the queued upload is the real destination.
    async function saveToCameraRoll(uri: string) {
        if (!mediaPermission?.granted) {
            const permissionResponse = await requestMediaPermission();
            if (!permissionResponse.granted) {
                Alert.alert(
                    'Photo not saved to your library',
                    'Without photo permission the picture will not appear in your camera roll. It is still attached to this trail issue.',
                );
                return;
            }
        }
        const asset = await MediaLibrary.createAssetAsync(uri);
        const album = await MediaLibrary.getAlbumAsync('mount-vernon-trail');
        // createAlbumAsync unconditionally would make a new album per photo.
        if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
            await MediaLibrary.createAlbumAsync('mount-vernon-trail', asset);
        }
    }

    // Captured photo confirmation buttons
    async function handleDone() {
        if (!capturedPhotoUri) return;

        try {
            await saveToCameraRoll(capturedPhotoUri);
        } catch (error) {
            // Non-fatal: keep going so the photo still reaches the album.
            console.error('Error saving photo to camera roll:', getErrorMessage(error));
        }

        // Issue-scoped capture. The standalone "Take After Picture" flow has no
        // event/album/issue, so it only lands in the camera roll above.
        if (eventId && albumId && activeIssueId) {
            try {
                await enqueuePhoto({
                    eventId,
                    albumId,
                    issueId: activeIssueId,
                    issueName: issueName ?? 'Trail issue',
                    slot: resolveMode,
                    uri: capturedPhotoUri,
                });
                flushInBackground(eventId);
            } catch (error) {
                Alert.alert(
                    'Could not attach photo',
                    getErrorMessage(error),
                );
                return;
            }
        }

        // back(), not replace(): the stack is trail-document -> trail-issue ->
        // camera, so replacing would spawn a second trail-document behind this
        // one, orphan the first (losing its notes), and re-fetch every issue.
        // The screen that pushed us re-reads the photo queue on focus.
        if (router.canGoBack()) {
            router.back();
            return;
        }
        // Nothing to return to (e.g. camera opened as the entry screen).
        router.replace('/home-screen');
    }
    function handleRetake() {
        setCapturedPhotoUri(null);
        setViewState('camera');
    }
    if (viewState === 'confirmation' && capturedPhotoUri) {
        return (
            <View style={styles.container}>
                <Image
                    source={{ uri: capturedPhotoUri }}
                    style={styles.camera}
                    resizeMode="cover"
                />
                <View style={[styles.confirmButtonRow, {bottom: insets.bottom + 20}]}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleDone}>
                        <Checkbox width={18} height={18} />
                        <Text style={styles.confirmButtonText}>DONE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.confirmButton} onPress={handleRetake}>
                        <Refresh width={16} height={16} />
                        <Text style={styles.confirmButtonText}>RETAKE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
    return (
        <>
        <Stack.Screen options={{ headerShown: false }} />
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={pinchGesture}>
                <View style={styles.container}>
                    <CameraView
                        style={styles.camera}
                        facing={facing}
                        flash={flash}
                        // @ts-ignore
                        ref={cameraRef}
                        zoom={zoom}
                    />
                    {resolveMode === 'after' && overlayUri && (
                        <View style={[ StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">
                            <Image
                                source={{ uri: overlayUri }}
                                resizeMode="cover"
                                style={{ flex : 1 }}
                            />
                        </View>
                    )}
                    {/* Rule-of-thirds grid for lining up horizontal and vertical edges so before/after shots match.
                        Rendered after the ghost overlay so the overlay doesn't dim the grid lines. */}
                    {showGrid && (
                        <View style={[styles.gridContainer, { bottom: insets.bottom + 125 }]} pointerEvents="none">
                            <View style={[styles.gridLineV, { left: '33.33%' }]} />
                            <View style={[styles.gridLineV, { left: '66.66%' }]} />
                            <View style={[styles.gridLineH, { top: '33.33%' }]} />
                            <View style={[styles.gridLineH, { top: '66.66%' }]} />
                        </View>
                    )}
                    {/* white screen flash */}
                    <Animated.View
                        style={[
                            styles.flashOverlay,
                            {
                                opacity: flashAnim,
                            },
                        ]}
                    />
                    <View style={[styles.topControls, { top: insets.top + 12 }]}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <View style={{ gap: 15 }}>
                            <TouchableOpacity onPress={toggleFlash}>
                                <BoltIcon
                                    width={25}
                                    height={37}
                                    fill={flash === "on" ? "white" : "#ffffff80"}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleCameraFacing}>
                                <CameraSwitch width={39} height={39} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.pillButton, showGrid && styles.pillButtonActive]}
                                onPress={() => setShowGrid(!showGrid)}
                            >
                                <Text style={styles.pillButtonText}>Grid</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Buttons to support zoom along with pinching */}
                    <View style={[styles.zoomControls, { bottom: insets.bottom + 140 }]}>
                        <TouchableOpacity style={styles.zoomButton} onPress={() => applyZoom(zoom - ZOOM_STEP)}>
                            <Text style={styles.zoomButtonText}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.zoomButton} onPress={() => applyZoom(zoom + ZOOM_STEP)}>
                            <Text style={styles.zoomButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.bottomContainer, { height: insets.bottom + 125 }]}>
                        {/* gallery/recent photo preview (right position) */}
                        <View style={[styles.photoContainer, { bottom: insets.bottom + 25 }]}>
                            <TouchableOpacity style={styles.photoPreview} onPress={openPhotoLibrary} disabled={isCapturing}>
                                {recentPhoto ? (
                                    <Image source={{ uri: recentPhoto }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.emptyPreview} />
                                )}
                            </TouchableOpacity>
                            <Text style={styles.previewLabel}>
                                {resolveMode === 'after' ? 'After' : 'Before'}
                            </Text>
                        </View>
                        {/* take photo button (center position) */}
                        <View style={[styles.captureContainer, {bottom: insets.bottom} ]}>
                            <TouchableOpacity
                                style={[
                                    styles.captureButton,
                                    isCapturing && styles.captureButtonActive,
                                ]}
                                onPress={takePhoto}
                                disabled={isCapturing}
                            >
                            <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                            <Text style={styles.captureLabel}>{resolveMode.toUpperCase()}</Text>
                        </View>
                        {/* Overlay opacity slider */}
                            {resolveMode === 'after' && overlayUri && (
                                <View style={[styles.sliderContainer, {bottom: insets.bottom + 40 } ]}>
                                    <Slider
                                        style={styles.slider}
                                        minimumValue={0}
                                        maximumValue={1}
                                        step={0.05}
                                        value={overlayOpacity}
                                        onValueChange={setOverlayOpacity}
                                        minimumTrackTintColor="#ffffff"
                                        maximumTrackTintColor="rgba(255,255,255,0.35)"
                                        thumbTintColor="#ffffff"
                                    />
                                    <Text style={styles.sliderLabel}>
                                        {Math.round(overlayOpacity * 100)}% Ghost
                                    </Text>
                                </View>
                            )}
                    </View>
                </View>
        </GestureDetector>
        </GestureHandlerRootView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
    },
    camera: {
        flex: 1,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: '#000000D9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    /* Left section with photo preview */
    photoContainer: {
        position: 'absolute',
        left: 25,
        alignItems: 'center',
    },
    previewLabel: {
        color: 'white',
        fontSize: 12,
        fontFamily: 'Lato_400Regular',
        marginTop: 5,
    },
    /* Photo Preview */
    photoPreview: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    emptyPreview: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    /* Center section with capture button */
    captureContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    captureButton: {
        width: 76,
        height: 76,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: 'white',
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ffffff',
    },
    captureButtonActive: {
        opacity: 0.7,
    },
    captureLabel: {
        color: 'white',
        fontFamily: 'Lato_700Bold',
        marginTop: 5,
        fontSize: 16,
    },
    flashOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
    },
    /* Overlay Slider */
    sliderContainer: {
        position: 'absolute',
        right: 20,
        alignItems: 'center',
    },
    slider: {
        width: SCREEN_HEIGHT * 0.12,
        height: SCREEN_HEIGHT * 0.04,
        transform: [{ scale: 0.9 }]
    },
    /* Grid */
    // Stops at the bottom bar so the thirds divide only the visible preview.
    gridContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    gridLineV: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    gridLineH: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    pillButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffffff80',
        alignItems: 'center',
    },
    pillButtonActive: {
        backgroundColor: '#ffffff40',
        borderColor: 'white',
    },
    pillButtonText: {
        color: 'white',
        fontFamily: 'Lato_700Bold',
        fontSize: 12,
    },
    /* Zoom */
    zoomControls: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    zoomButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#00000080',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomButtonText: {
        color: 'white',
        fontSize: 20,
        fontFamily: 'Lato_700Bold',
    },
    sliderLabel: {
        color: 'white',
        fontFamily: 'Lato_400Regular',
        fontSize: 12,
    },
    /* Confirmation */
    confirmButtonRow: {
        position: 'absolute',
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
    },
    confirmButton: {
        backgroundColor: 'white',
        paddingVertical: 16,
        paddingHorizontal: 26,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: Palette.primaryPurple30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    confirmButtonText: {
        color: Palette.primaryPurple70,
        fontFamily: 'Lato_700Bold',
        fontSize: 18,
    },
    /* Top Controls */
    topControls: {
        position: 'absolute',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        left: 20,
        right: 20,
    },
    cancelButton: {
        backgroundColor: '#D6D6D6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    cancelButtonText: {
        fontFamily: 'Lato_400Regular',
        fontSize: 14,
    },
});
