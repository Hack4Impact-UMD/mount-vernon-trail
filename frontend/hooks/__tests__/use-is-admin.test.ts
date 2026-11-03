import { act, renderHook } from "@testing-library/react-native";
import type { User } from "firebase/auth";
import { useIsAdmin } from "../use-is-admin";

let mockAuthCallback: ((user: User | null) => void) | null = null;

jest.mock("firebase/auth", () => ({
    onAuthStateChanged: jest.fn(
        (_auth: unknown, callback: (user: User | null) => void) => {
            mockAuthCallback = callback;
            return jest.fn();
        },
    ),
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe("useIsAdmin", () => {
    it("ignores an old claim lookup after sign-out", async () => {
        const claims = deferred<{ claims: { admin: boolean } }>();
        const user = {
            getIdTokenResult: jest.fn(() => claims.promise),
        } as unknown as User;
        const { result } = renderHook(() => useIsAdmin());

        act(() => mockAuthCallback?.(user));
        act(() => mockAuthCallback?.(null));
        await act(async () => {
            claims.resolve({ claims: { admin: true } });
            await claims.promise;
        });

        expect(result.current).toBe(false);
    });

    it("only accepts the latest user's claim result", async () => {
        const first = deferred<{ claims: { admin: boolean } }>();
        const second = deferred<{ claims: { admin: boolean } }>();
        const firstUser = {
            getIdTokenResult: jest.fn(() => first.promise),
        } as unknown as User;
        const secondUser = {
            getIdTokenResult: jest.fn(() => second.promise),
        } as unknown as User;
        const { result } = renderHook(() => useIsAdmin());

        act(() => mockAuthCallback?.(firstUser));
        act(() => mockAuthCallback?.(secondUser));
        await act(async () => {
            second.resolve({ claims: { admin: false } });
            first.resolve({ claims: { admin: true } });
            await Promise.all([first.promise, second.promise]);
        });

        expect(result.current).toBe(false);
    });
});
