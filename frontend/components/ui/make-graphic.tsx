import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '@/constants/theme';

type Props = {
    onPress?: () => void;
};

export default function MakeBeforeAfterGraphic({ onPress }: Props) {
    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.shadowWrapper}>
            <View style={styles.container}>
                <LinearGradient
                    colors={[Palette.primaryPurple100, Palette.primaryPurple70]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>Make Before/After Graphic</Text>
                        <Text style={styles.subtitle}>Generate event before and after photos</Text>
                    </View>
                </LinearGradient>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    shadowWrapper: {
        shadowColor: '#693894',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    }, 
    container: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradient: {
        width: '100%',
        height: 70,
        justifyContent: 'center',
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: "Lato_700Bold",
    },
    subtitle: {
        color: '#FFFFFF99',
        fontSize: 14,
        marginTop: 4,
        fontFamily: "Lato_400Regular",
    },
});