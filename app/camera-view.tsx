import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import React, { useRef, useState } from 'react';
import { Animated, Button, Image, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
        writeOnly: true,
        granularPermissions: ['photo'],
    });
    const [recentPhoto, setRecentPhoto] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const flashAnim = useRef(new Animated.Value(0)).current;
    const cameraRef = useRef<CameraView | null>(null);
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0.3);
    const [zoom, setZoom] = useState(0);
    const currentZoomRef = useRef(0);
    const startZoomRef = useRef(0);

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
            if (!photo) {
                setIsCapturing(false);
                return;
            }

            // requests media library perms if not granted
            const permissionResponse = await requestMediaPermission();
            if (!permissionResponse.granted) {
                setRecentPhoto(photo.uri);
                setIsCapturing(false);
                return;
            }

            // saves photo to camera roll
            const asset = await MediaLibrary.createAssetAsync(photo.uri);
            await MediaLibrary.createAlbumAsync('mount-vernon-trail', asset);
            
            // stores the photo as the little recent preview
            setRecentPhoto(photo.uri);
            console.log('Photo saved:', photo.uri);
            setIsCapturing(false);
        } catch (error) {
            console.error('Error taking photo:', error);
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
           if (!result.canceled && result.assets?.[0]?.uri) {
                setOverlayUri(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error opening photo library:', error);
        }
    }

    const pinchGesture = Gesture.Pinch().runOnJS(true).onStart(() => {
        startZoomRef.current = currentZoomRef.current;
    }).onUpdate((e:any) => {
        const target = Math.min(1, Math.max(0, startZoomRef.current + (e.scale - 1) * 0.12));
        const smoothed = currentZoomRef.current + (target - currentZoomRef.current) * 0.25;
        if (Math.abs(smoothed - currentZoomRef.current) > 0.003) {
            currentZoomRef.current = smoothed;
            setZoom(smoothed);
        }
    });

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={pinchGesture}>
                <View style={styles.container}>
                <CameraView 
                    style={styles.camera} 
                    facing={facing} 
                    // @ts-ignore
                    ref={cameraRef}
                    zoom={zoom}
                />
                {overlayUri && (
                    <View style={[ StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]} pointerEvents="none">
                        <Image 
                            source={{ uri: overlayUri }} 
                            resizeMode="cover" 
                            style={{ flex : 1 }}
                        />
                    </View>
                )}
                {/* Overlay opacity slider */}
                {overlayUri && (
                    <View style={styles.sliderContainer}>
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
                    <Text style={styles.controlLabel}>
                        {Math.round(overlayOpacity * 100)}%
                    </Text>
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
                <View style={styles.bottomContainer}>
                    {/* flip camera button (left position) */}
                    <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing} disabled={isCapturing}>
                        <Text style={styles.buttonText}>⟲</Text>
                    </TouchableOpacity>

                    {/* take photo button (center position) */}
                    <TouchableOpacity 
                        style={[
                            styles.captureButton,
                            isCapturing && styles.captureButtonActive,
                        ]} 
                        onPress={takePhoto}
                        disabled={isCapturing}
                    >
                        <View 
                            style={[
                                styles.captureButtonInner,
                                isCapturing && styles.captureButtonInnerActive,
                            ]} 
                        />
                    </TouchableOpacity>

                    {/* gallery/recent photo preview (right position) */}
                    <TouchableOpacity style={styles.photoPreview} onPress={openPhotoLibrary} disabled={isCapturing}>
                        {recentPhoto ? (
                            <Image source={{ uri: recentPhoto }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.emptyPreview} />
                        )}
                </TouchableOpacity>
                </View>
                </View>
        </GestureDetector>
        </GestureHandlerRootView>
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
        height: 120,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 20,
    },
    flipButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButton: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FF3B30',
    },
    captureButtonActive: {
        opacity: 0.7,
    },
    captureButtonInnerActive: {
        backgroundColor: '#CC2E26',
    },
    flashOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
    },
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
    buttonText: {
        fontSize: 28,
        color: 'white',
        fontWeight: 'bold',
    },
    /* Overlay */
    sliderContainer: {
        position: 'absolute',
        top: '25%',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(30, 30, 30, 0.70)',
        overflow: 'hidden',
        left: SCREEN_HEIGHT * 0.015,
        width: SCREEN_HEIGHT * 0.05,
        height: SCREEN_HEIGHT * 0.26,
        borderRadius: SCREEN_HEIGHT * 0.033, 
        paddingVertical: SCREEN_HEIGHT * 0.017,
    },
    slider: {
        transform: [{ rotate: '-90deg' }],
        width: SCREEN_HEIGHT * 0.2, 
        height: SCREEN_HEIGHT * 0.2,
    },
    controlLabel: {
        color: 'white',
        fontWeight: '600',
        fontSize: SCREEN_HEIGHT * 0.016
    },
}); 