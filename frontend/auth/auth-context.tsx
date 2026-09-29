import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "./google-auth";

// undefined = still initializing, null = signed out, User = signed in.
export type AuthState = {
    user: User | null | undefined;
};

const AuthContext = createContext<AuthState>({ user: undefined });

// One onAuthStateChanged subscription and one OAuth request object for the
// whole app; components read auth state from this context rather than each
// subscribing on their own.
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => subscribeToAuthState(setUser), []);

    const value = useMemo(() => ({ user }), [user]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    return useContext(AuthContext);
}
