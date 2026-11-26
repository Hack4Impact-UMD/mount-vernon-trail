import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import { Linking } from "react-native";
import { enqueuePhoto } from "@/services/photo-queue";
import CameraViewScreen from "../camera-view";

type Permission = { granted: boolean; canAskAgain: boolean };

const mockRouter = {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: jest.fn(),
    replace: jest.fn(),
};
let mockParams: Record<string, string> = {};
let mockCameraPermission: Permission | null = null;
const mockRequestCameraPermission = jest.fn();
let mockMediaPermission: Permission | null = null;
const mockRequestMediaPermission = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    Stack: Object.assign(() => null, { Screen: () => null }),
}));

jest.mock("expo-camera", () => {
    const { forwardRef, useImperativeHandle } = jest.requireActual("react");
    return {
        CameraView: forwardRef((_props: unknown, ref: unknown) => {
            useImperativeHandle(ref, () => ({
                takePictureAsync: async () => ({ uri: "file:///photo.jpg" }),
            }));
            return null;
        }),
        useCameraPermissions: () => [
            mockCameraPermission,
            mockRequestCameraPermission,
            jest.fn(),
        ],
    };
});

jest.mock("expo-media-library/legacy", () => ({
    usePermissions: () => [
        mockMediaPermission,
        mockRequestMediaPermission,
        jest.fn(),
    ],
    createAssetAsync: jest.fn(async () => ({ id: "asset-1" })),
    getAlbumAsync: jest.fn(async () => null),
    createAlbumAsync: jest.fn(async () => ({ id: "album-1" })),
    addAssetsToAlbumAsync: jest.fn(async () => true),
}));

jest.mock("@/services/photo-queue", () => ({
    enqueuePhoto: jest.fn(async () => undefined),
    flushInBackground: jest.fn(),
}));

jest.mock("react-native-gesture-handler", () => {
    const { View } = jest.requireActual("react-native");
    const chain: Record<string, () => unknown> = {};
    for (const method of ["runOnJS", "onStart", "onUpdate"]) {
        chain[method] = () => chain;
    }
    return {
        Gesture: { Pinch: () => chain },
        GestureDetector: ({ children }: { children: unknown }) => children,
        GestureHandlerRootView: View,
    };
});

jest.mock("react-native-reanimated", () => ({
    useSharedValue: (initial: number) => {
        let value = initial;
        return { get: () => value, set: (next: number) => (value = next) };
    },
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-linear-gradient", () => ({
    LinearGradient: jest.requireActual("react-native").View,
}));

const issueParams = {
    eventId: "event-1",
    albumId: "album-1",
    activeIssueId: "issue-1",
    issueName: "Fallen branch",
    mode: "before",
};

async function press(text: string | RegExp) {
    const element = screen.queryByText(text) ?? screen.getByLabelText(text);
    await fireEvent.press(element);
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function captureAndPressDone() {
    await press("Take photo");
    await press("DONE");
}

// Android hardware Back on a visible popup arrives as the Modal's
// onRequestClose, not as a press on either of its buttons. requestClose does
// not bubble, so it is fired on the Modal that holds the popup's title.
async function pressAndroidBack(popupTitle: string) {
    let modal = screen.getByText(popupTitle).parent;
    while (modal && modal.type !== "Modal") modal = modal.parent;
    if (!modal) throw new Error(`No Modal around "${popupTitle}"`);
    await fireEvent(modal, "requestClose");
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

let openSettings: jest.SpyInstance;

beforeEach(() => {
    mockParams = issueParams;
    mockCameraPermission = { granted: true, canAskAgain: true };
    mockMediaPermission = { granted: true, canAskAgain: true };
    mockRequestMediaPermission.mockReset();
    openSettings = jest
        .spyOn(Linking, "openSettings")
        .mockResolvedValue(undefined);
});

afterEach(() => {
    openSettings.mockRestore();
});

describe("camera permission screen", () => {
    it("asks for camera access while the system prompt can still be shown", async () => {
        mockCameraPermission = { granted: false, canAskAgain: true };
        await render(<CameraViewScreen />);

        await press("Allow camera");

        expect(mockRequestCameraPermission).toHaveBeenCalled();
        expect(screen.queryByText("Open Settings")).toBeNull();
    });

    it("sends the volunteer to Settings once the prompt is blocked", async () => {
        mockCameraPermission = { granted: false, canAskAgain: false };
        await render(<CameraViewScreen />);

        await press("Open Settings");

        expect(openSettings).toHaveBeenCalled();
        expect(mockRequestCameraPermission).not.toHaveBeenCalled();
    });

    it("lets the volunteer leave without granting access", async () => {
        mockCameraPermission = { granted: false, canAskAgain: false };
        await render(<CameraViewScreen />);

        await press("Go back");

        expect(mockRouter.back).toHaveBeenCalled();
    });
});

describe("saving a photo to the phone's library", () => {
    it("saves into the app album without copying the photo twice", async () => {
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(
            "file:///photo.jpg",
        );
        expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith(
            "mount-vernon-trail",
            { id: "asset-1" },
            false,
        );
        expect(enqueuePhoto).toHaveBeenCalledWith(
            expect.objectContaining({
                issueId: "issue-1",
                slot: "before",
                uri: "file:///photo.jpg",
            }),
        );
    });

    it("still saves to the library first when attaching to the issue fails", async () => {
        jest.mocked(enqueuePhoto).mockRejectedValueOnce(
            new Error("Storage full"),
        );
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        expect(screen.getByText("Could not attach photo")).toBeTruthy();
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalled();
        expect(mockRouter.back).not.toHaveBeenCalled();

        await press("OK");
        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it("treats a failure to file into the album as saved", async () => {
        jest.mocked(MediaLibrary.getAlbumAsync).mockRejectedValueOnce(
            new Error("No read access"),
        );
        const consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(screen.queryByText("Photo not saved to your phone")).toBeNull();
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it("keeps the alert up until the volunteer answers it when access is denied", async () => {
        mockMediaPermission = { granted: false, canAskAgain: true };
        mockRequestMediaPermission.mockResolvedValue({
            granted: false,
            canAskAgain: true,
        });
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        expect(screen.getByText("Allow photo access")).toBeTruthy();
        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(enqueuePhoto).not.toHaveBeenCalled();

        await press("Continue");

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(enqueuePhoto).toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
    });

    it("asks again when the volunteer taps Allow", async () => {
        mockMediaPermission = { granted: false, canAskAgain: true };
        mockRequestMediaPermission
            .mockResolvedValueOnce({ granted: false, canAskAgain: true })
            .mockResolvedValueOnce({ granted: true, canAskAgain: true });
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        await press("Allow");

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(mockRequestMediaPermission).toHaveBeenCalledTimes(2);
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalled();
    });

    it("stays on the photo after opening Settings so it can be saved on return", async () => {
        mockMediaPermission = { granted: false, canAskAgain: false };
        mockRequestMediaPermission.mockResolvedValue({
            granted: false,
            canAskAgain: false,
        });
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        await press("Open Settings");

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(openSettings).toHaveBeenCalled();
        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(enqueuePhoto).not.toHaveBeenCalled();
    });

    it("warns that a standalone photo is lost without access", async () => {
        mockParams = { mode: "after" };
        mockMediaPermission = { granted: false, canAskAgain: false };
        mockRequestMediaPermission.mockResolvedValue({
            granted: false,
            canAskAgain: false,
        });
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        expect(screen.getByText(/not attached to a trail issue/)).toBeTruthy();
        await press("Discard");
        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
    });

    it("returns to the photo when Back dismisses the access prompt on a standalone capture", async () => {
        mockParams = { mode: "after" };
        mockMediaPermission = { granted: false, canAskAgain: false };
        mockRequestMediaPermission.mockResolvedValue({
            granted: false,
            canAskAgain: false,
        });
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        await pressAndroidBack("Allow photo access");

        expect(screen.queryByText("Allow photo access")).toBeNull();
        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
        expect(openSettings).not.toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
    });

    it("does not attach the photo when Back dismisses the save-error prompt", async () => {
        jest.mocked(MediaLibrary.createAssetAsync).mockRejectedValueOnce(
            new Error("Disk full"),
        );
        const consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        await render(<CameraViewScreen />);
        await captureAndPressDone();

        await pressAndroidBack("Photo not saved to your phone");
        expect(screen.queryByText("Photo not saved to your phone")).toBeNull();

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(enqueuePhoto).not.toHaveBeenCalled();

        // The volunteer can still finish from the confirmation screen.
        await press("DONE");
        expect(mockRouter.back).toHaveBeenCalled();
        expect(enqueuePhoto).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it("does not save a photo picked from the library a second time", async () => {
        jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: "file:///picked.jpg" }],
        } as ImagePicker.ImagePickerResult);
        await render(<CameraViewScreen />);

        await press("Choose from photo library");
        await press("DONE");

        expect(screen.getByText("DONE")).toBeTruthy();
        expect(mockRouter.back).toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
        expect(enqueuePhoto).toHaveBeenCalledWith(
            expect.objectContaining({ uri: "file:///picked.jpg" }),
        );
    });
});
