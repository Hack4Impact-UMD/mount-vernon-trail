// Native modules with no JS implementation under the test runtime. Each mock is
// only as detailed as the tests need — anything richer belongs in the test.

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: jest.fn(() => true),
    }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    useFocusEffect: jest.fn(),
    Stack: Object.assign(() => null, { Screen: () => null }),
    Link: () => null,
}));

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-camera", () => ({
    CameraView: () => null,
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

jest.mock("expo-media-library", () => ({
    usePermissions: () => [{ granted: true }, jest.fn()],
    createAssetAsync: jest.fn(async () => ({ id: "asset-1" })),
    getAlbumAsync: jest.fn(async () => null),
    createAlbumAsync: jest.fn(async () => undefined),
    addAssetsToAlbumAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-image-picker", () => ({
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock("expo-web-browser", () => ({
    maybeCompleteAuthSession: jest.fn(),
    openAuthSessionAsync: jest.fn(async () => ({ type: "cancel" })),
}));

jest.mock("expo-auth-session", () => ({
    makeRedirectUri: jest.fn(() => "mvt://redirect"),
}));

jest.mock("expo-auth-session/providers/google", () => ({
    useAuthRequest: () => [null, null, jest.fn()],
}));

jest.mock("expo-splash-screen", () => ({
    preventAutoHideAsync: jest.fn(),
    hideAsync: jest.fn(),
}));

jest.mock("@expo-google-fonts/lato", () => ({
    useFonts: () => [true],
    Lato_300Light: "Lato_300Light",
    Lato_400Regular: "Lato_400Regular",
    Lato_700Bold: "Lato_700Bold",
}));

jest.mock("@react-native-async-storage/async-storage", () => {
    let store = {};
    return {
        __resetStore: () => {
            store = {};
        },
        getItem: jest.fn(async (key) => store[key] ?? null),
        setItem: jest.fn(async (key, value) => {
            store[key] = value;
        }),
        removeItem: jest.fn(async (key) => {
            delete store[key];
        }),
        clear: jest.fn(async () => {
            store = {};
        }),
    };
});

jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }));

// The real module reads EXPO_PUBLIC_FIREBASE_* at import time and throws if
// any are missing, which would break every test that transitively imports it.
jest.mock("@/config/firebase", () => ({
    auth: { currentUser: null },
    db: {},
    firebaseApp: {},
}));
