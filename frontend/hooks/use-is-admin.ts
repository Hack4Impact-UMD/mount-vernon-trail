import { auth } from "@/config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? "";

export function useIsAdmin(): boolean | null {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAdmin(
                !!user &&
                    !!ADMIN_EMAIL &&
                    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
            );
        });
        return () => unsubscribe();
    }, []);

    return isAdmin;
}
