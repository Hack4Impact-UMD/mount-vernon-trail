import { Palette } from "@/constants/theme";
import { usePathname, useRouter } from "expo-router";
import { FileText, House, Images, User } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabKey = "home" | "drafts" | "albums" | "profile";

const ROUTES: Record<TabKey, string> = {
    home: "/home-screen",
    drafts: "/drafts",
    albums: "/albums",
    profile: "/profile",
};

const PATH_TO_TAB: Record<string, TabKey> = {
    "/home-screen": "home",
    "/drafts": "drafts",
    "/albums": "albums",
    "/profile": "profile",
};

type BottomNavProps = {
    active?: TabKey;
    onTabPress?: (tab: TabKey) => void;
};

const navItems: {
    key: TabKey;
    label: string;
    icon: (color: string) => React.ReactNode;
}[] = [
    {
        key: "home",
        label: "Home",
        icon: (color) => (
            <House
                size={30}
                color={color}
                strokeWidth={1.8}
            />
        ),
    },
    {
        key: "drafts",
        label: "Drafts",
        icon: (color) => (
            <FileText
                size={30}
                color={color}
                strokeWidth={1.8}
            />
        ),
    },
    {
        key: "albums",
        label: "Albums",
        icon: (color) => (
            <Images
                size={30}
                color={color}
                strokeWidth={1.8}
            />
        ),
    },
    {
        key: "profile",
        label: "Profile",
        icon: (color) => (
            <User
                size={30}
                color={color}
                strokeWidth={1.8}
            />
        ),
    },
];

export default function BottomNav({ active, onTabPress }: BottomNavProps) {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const activeTab = active ?? PATH_TO_TAB[pathname] ?? "home";

    const handlePress = (tab: TabKey) => {
        onTabPress?.(tab);
        router.replace(ROUTES[tab] as any);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {navItems.map((item) => {
                const isActive = activeTab === item.key;
                const color = isActive ? Palette.primaryPurple100 : "#A9A9A9";

                return (
                    <TouchableOpacity
                        key={item.key}
                        style={styles.navItem}
                        activeOpacity={0.8}
                        onPress={() => handlePress(item.key)}>
                        {item.icon(color)}
                        <Text
                            style={[
                                styles.label,
                                { color, fontWeight: isActive ? "600" : "400" },
                            ]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
        paddingTop: 10,
        paddingHorizontal: 8,

        // iOS shadow
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,

        // Android shadow
        elevation: 7,
    },
    navItem: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 70,
        gap: 5,
    },
    label: {
        fontSize: 12,
        fontFamily: "Lato_400Regular",
    },
});
