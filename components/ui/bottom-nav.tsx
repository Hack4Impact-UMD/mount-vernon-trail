import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { House, PlusCircle, Clock, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '@/constants/theme';

type TabKey = 'home' | 'new-event' | 'history' | 'profile';

type BottomNavProps = {
    active: TabKey;
    onTabPress: (tab: TabKey) => void;
};

const navItems: { key: TabKey; label: string; icon: (color: string) => React.ReactNode; }[] = [
    {
        key: 'home',
        label: 'Home',
        icon: (color) => <House size={30} color={color} strokeWidth={1.8} />,
    },
    {
        key: 'new-event',
        label: 'New Event',
        icon: (color) => <PlusCircle size={30} color={color} strokeWidth={1.8} />,
    },
    {
        key: 'history',
        label: 'History',
        icon: (color) => <Clock size={30} color={color} strokeWidth={1.8} />,
    },
    {
        key: 'profile',
        label: 'Profile',
        icon: (color) => <User size={30} color={color} strokeWidth={1.8} />,
    },
];

export default function BottomNav({ active, onTabPress, }: BottomNavProps) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {navItems.map((item) => {
                const isActive = active === item.key;
                const color = isActive ? Palette.primaryPurple100 : '#A9A9A9';

                return (
                    <TouchableOpacity key={item.key} style={styles.navItem} activeOpacity={0.8} onPress={() => onTabPress(item.key)}>
                        {item.icon(color)}
                        <Text style={[styles.label, { color, fontWeight: isActive ? '600' : '400' }]}>
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
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingTop: 10,
        paddingHorizontal: 8,
        
        // iOS shadow
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,

        // Android shadow
        elevation: 7,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
        gap: 5,
    },
    label: {
        fontSize: 12,
    },
});
