import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "./google-auth";

// undefined = still initializing, null = signed out, User = signed in.
export type AuthState = {
    user: User | null | undefined;
};

const AuthContext = createContext<AuthState>({ user: undefined });

// One subscription for the whole app. Previously every component that called
// useGoogleAuth() — including the header, which is on nearly every screen —
// opened its own onAuthStateChanged listener and its own OAuth request object.
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => subscribeToAuthState(setUser), []);

    const value = useMemo(() => ({ user }), [user]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    return useContext(AuthContext);
}
