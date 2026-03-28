import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import BottomNav from '../components/ui/bottom-nav';
import Header from '../components/ui/header';
import StartEventCard from '../components/ui/start-event-card';

export default function HomeScreen() {
    const [active, setActive] = useState<'home' | 'new-event' | 'history' | 'profile'>('home');

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={styles.screen}>
                <Header userName='Sarah' />
                <View style={styles.content}>
                    <View style={styles.cardWrapper}>
                        <StartEventCard />
                    </View>
                    {/* rest of page content */}
                </View>
                <BottomNav active={active} onTabPress={(tab) => setActive(tab)} />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    content: {
        flex: 1,
    },
    cardWrapper: {
        marginTop: 10,
        paddingHorizontal: 20,
    },
});