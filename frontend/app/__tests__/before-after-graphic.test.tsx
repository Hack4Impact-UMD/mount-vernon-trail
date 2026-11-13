import { fireEvent, render, screen } from "@testing-library/react-native";
import BeforeAfterGraphicScreen from "../before-after-graphic";

const mockRouter = {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: jest.fn(),
    replace: jest.fn(),
};

jest.mock("expo-router", () => ({
    useRouter: () => mockRouter,
}));

jest.mock("@/components/ui/header", () => () => null);
jest.mock("@/components/ui/bottom-nav", () => () => null);
jest.mock("expo-media-library/legacy", () => ({
    usePermissions: () => [{ granted: true }, jest.fn()],
    createAssetAsync: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
});

describe("before/after graphic navigation", () => {
    it("returns to the previous screen when there is back history", () => {
        render(<BeforeAfterGraphicScreen />);

        fireEvent.press(screen.getByLabelText("Go back"));

        expect(mockRouter.back).toHaveBeenCalledTimes(1);
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("returns home when there is no back history", () => {
        mockRouter.canGoBack.mockReturnValue(false);
        render(<BeforeAfterGraphicScreen />);

        fireEvent.press(screen.getByLabelText("Go back"));

        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(mockRouter.replace).toHaveBeenCalledWith("/home-screen");
    });
});
