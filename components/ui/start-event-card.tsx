import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

type Props = {
    onPress?: () => void;
};

export default function StartEventCard({ onPress }: Props) {
    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            <LinearGradient
                colors={['#693894', '#8A6BAD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.container}
            >
                <Image
                    source={require('../../assets/images/beaver-limbloppers.png')}
                    style={styles.image}
                    resizeMode="contain"
                />
                <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Start a Trail Event</Text>
                        <View style={styles.arrowContainer}>
                            <ChevronRight size={18} color="white" />
                        </View>
                    </View>
                    <Text style={styles.subtitle}>Capture before & after photos</Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        width: '100%',
        height: 127,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
        paddingRight: 18,

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },

    image: {
        position: 'absolute',
        bottom: -40, 
        width: 150,   
        height: 150,
    },

    textContainer: {
        flex: 1,
        marginLeft: 120,
    },

    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },

    subtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 4,
    },

    arrowContainer: {
        width: 30,
        height: 30,
        borderRadius: 18,
        backgroundColor: '#3BA34C',
        alignItems: 'center',
        justifyContent: 'center',
    },
});