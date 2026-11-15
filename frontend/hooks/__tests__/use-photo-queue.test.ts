import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { flushEventPhotos } from "@/services/photo-queue";
import { usePhotoQueue } from "../use-photo-queue";

jest.mock("@/services/photo-queue", () => ({
    flushEventPhotos: jest.fn(async () => ({ uploaded: 0, failed: 0 })),
    getIssuePhotos: jest.fn(async () => ({})),
    subscribeToPhotoQueue: jest.fn(() => jest.fn()),
}));

it("retries on a timer and foreground return, and cleans up on unmount", async () => {
    jest.useFakeTimers();
    const originalState = AppState.currentState;
    let onChange!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    const listener = jest
        .spyOn(AppState, "addEventListener")
        .mockImplementation((_event, callback) => {
            onChange = callback;
            return { remove };
        });
    try {
        AppState.currentState = "active";
        const view = renderHook(() => usePhotoQueue("event-1"));
        await act(async () => { await Promise.resolve(); });
        expect(flushEventPhotos).toHaveBeenCalledWith("event-1", true);
        jest.mocked(flushEventPhotos).mockClear();
        await act(async () => {
            jest.advanceTimersByTime(5_000);
        });
        expect(flushEventPhotos).toHaveBeenCalledTimes(1);
        AppState.currentState = "background";
        await act(async () => {
            jest.advanceTimersByTime(5_000);
        });
        expect(flushEventPhotos).toHaveBeenCalledTimes(1);
        AppState.currentState = "active";
        await act(async () => {
            onChange("active");
        });
        expect(flushEventPhotos).toHaveBeenCalledTimes(2);
        await view.unmount();
        expect(remove).toHaveBeenCalled();
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });
        expect(flushEventPhotos).toHaveBeenCalledTimes(2);
    } finally {
        listener.mockRestore();
        AppState.currentState = originalState;
        jest.useRealTimers();
    }
});
