import { auth } from "@/config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

// Reads the `admin` custom claim rather than comparing against a bundled email.
// The old EXPO_PUBLIC_ADMIN_EMAIL compare shipped in the JS bundle, was
// trivially spoofable, and could not be referenced from firestore.rules — so
// nothing enforced it server-side. Grant the claim with:
//   cd backend && npm run set-admin -- someone@example.com
export function useIsAdmin(): boolean | null {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                if (!cancelled) setIsAdmin(false);
                return;
            }
            // The cached ID token can be up to an hour old, so a freshly
            // granted claim would otherwise stay invisible with no explanation.
            // Check the cached token first (free), and only force a refresh
            // when it says non-admin — so existing admins pay nothing and a
            // newly granted one sees it immediately.
            user.getIdTokenResult()
                .then((cached) =>
                    cached.claims.admin === true
                        ? true
                        : user
                              .getIdTokenResult(true)
                              .then((fresh) => fresh.claims.admin === true),
                )
                .then((admin) => {
                    if (!cancelled) setIsAdmin(admin);
                })
                .catch((error: unknown) => {
                    console.error("Failed to read admin claim:", error);
                    if (!cancelled) setIsAdmin(false);
                });
        });
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, []);

    return isAdmin;
}
