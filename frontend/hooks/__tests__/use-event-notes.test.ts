import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { updateEventNotes } from "@/services/event-service";
import { pendingNotesKey, useEventNotes } from "../use-event-notes";

jest.mock("@/services/event-service", () => ({
    updateEventNotes: jest.fn(),
}));

let changeAppState: (state: "active" | "background" | "inactive") => void;

beforeEach(() => {
    jest.useFakeTimers();
    (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
    jest.mocked(updateEventNotes).mockReset().mockResolvedValue();
    jest.spyOn(AppState, "addEventListener").mockImplementation(
        (_event, listener) => {
            changeAppState = listener;
            return { remove: jest.fn() } as unknown as ReturnType<
                typeof AppState.addEventListener
            >;
        },
    );
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

async function renderLoaded(serverNotes = "from setup") {
    const hook = await renderHook(
        ({ notes }: { notes: string | undefined }) =>
            useEventNotes("event-1", notes),
        { initialProps: { notes: undefined as string | undefined } },
    );
    await hook.rerender({ notes: serverNotes });
    return hook;
}

it("starts from the server notes and does not write them back", async () => {
    const { result } = await renderLoaded();
    expect(result.current.notes).toBe("from setup");
    await act(async () => jest.runAllTimers());
    expect(updateEventNotes).not.toHaveBeenCalled();
});

it("saves to Firestore after typing stops, then drops the local copy", async () => {
    const { result } = await renderLoaded();
    await act(async () => result.current.setNotes("bench 4 repaired"));
    expect(await AsyncStorage.getItem(pendingNotesKey("event-1"))).toBe(
        "bench 4 repaired",
    );
    expect(updateEventNotes).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1000));
    expect(updateEventNotes).toHaveBeenCalledWith(
        "event-1",
        "bench 4 repaired",
    );
    expect(await AsyncStorage.getItem(pendingNotesKey("event-1"))).toBeNull();
});

it("saves immediately when the app is backgrounded", async () => {
    const { result } = await renderLoaded();
    await act(async () => result.current.setNotes("typed then swiped away"));
    await act(async () => changeAppState("background"));
    expect(updateEventNotes).toHaveBeenCalledWith(
        "event-1",
        "typed then swiped away",
    );
});

it("saves when the screen unmounts, e.g. going back to Home", async () => {
    const { result, unmount } = await renderLoaded();
    await act(async () => result.current.setNotes("left mid-event"));
    await unmount();
    expect(updateEventNotes).toHaveBeenCalledWith("event-1", "left mid-event");
});

it("restores and re-sends notes Firestore never acknowledged", async () => {
    jest.mocked(updateEventNotes).mockRejectedValue(new Error("offline"));
    const first = await renderLoaded();
    await act(async () => first.result.current.setNotes("written offline"));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(first.result.current.saveError).not.toBeNull();
    await first.unmount();
    jest.mocked(updateEventNotes).mockReset().mockResolvedValue();

    const second = await renderLoaded("from setup");
    expect(second.result.current.notes).toBe("written offline");
    expect(updateEventNotes).toHaveBeenCalledWith("event-1", "written offline");
});

it("keeps the newer local copy when an older save is acknowledged", async () => {
    let resolveFirst!: () => void;
    jest.mocked(updateEventNotes).mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveFirst = resolve)),
    );
    const { result } = await renderLoaded();
    await act(async () => result.current.setNotes("v1"));
    await act(async () => jest.advanceTimersByTime(1000));
    await act(async () => result.current.setNotes("v2"));
    await act(async () => resolveFirst());
    expect(await AsyncStorage.getItem(pendingNotesKey("event-1"))).toBe("v2");
});

it("an old save finishing after reopen does not delete newer notes", async () => {
    let resolveOldSave!: () => void;
    jest.mocked(updateEventNotes).mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveOldSave = resolve)),
    );
    const first = await renderLoaded();
    await act(async () => first.result.current.setNotes("v1"));
    await first.unmount();

    const second = await renderLoaded();
    expect(second.result.current.notes).toBe("v1");
    jest.mocked(updateEventNotes).mockRejectedValue(new Error("offline"));
    await act(async () => second.result.current.setNotes("v2"));
    await act(async () => resolveOldSave());
    expect(await AsyncStorage.getItem(pendingNotesKey("event-1"))).toBe("v2");

    await second.unmount();
    jest.mocked(updateEventNotes).mockReset().mockResolvedValue();
    const third = await renderLoaded();
    expect(third.result.current.notes).toBe("v2");
});

it("keeps the Notepad read-only until the saved draft has loaded", async () => {
    await AsyncStorage.setItem(pendingNotesKey("event-1"), "unsynced draft");
    const readDraft = jest.mocked(AsyncStorage.getItem);
    const realRead = readDraft.getMockImplementation()!;
    let finishRead!: () => void;
    readDraft.mockImplementationOnce(async (key) => {
        await new Promise<void>((resolve) => (finishRead = resolve));
        return realRead(key);
    });

    const { result } = await renderLoaded();
    expect(result.current.ready).toBe(false);
    await act(async () => result.current.setNotes("typed while loading"));
    expect(await realRead(pendingNotesKey("event-1"))).toBe("unsynced draft");

    await act(async () => finishRead());
    expect(result.current.ready).toBe(true);
    expect(result.current.notes).toBe("unsynced draft");
});
