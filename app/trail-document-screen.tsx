import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { View, Button, StyleSheet, Image, Text } from "react-native";

export default function TrailDocumentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        beforeImageUri?: string;
        afterImageUri?: string;
    }>();
    const beforeImageUri = typeof params.beforeImageUri === "string" ? params.beforeImageUri : null;
    const afterImageUri = typeof params.afterImageUri === "string" ? params.afterImageUri : null;
    return (
        // temporary buttons to test navigation to camera view
        <View>
            <Button title="before" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { mode: 'before' }, 
                })}
            />
            <Button title="after" onPress={() => 
                router.push({ 
                    pathname: '/camera-view', 
                    params: { 
                        mode: 'after',
                        beforeImageUri: beforeImageUri ?? "",
                    }, 
                })}
            />
            {beforeImageUri ? (
                <Image
                    source={{ uri: beforeImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No before image yet</Text>
            )}
            {afterImageUri ? (
                <Image
                    source={{ uri: afterImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                />
            ) : (
                <Text>No after image yet</Text>
            )}
        </View>
  );
}

const styles = StyleSheet.create({
    previewImage: {
        width: 180,
        height: 180,
        borderRadius: 12,
        marginTop: 20,
    },
});