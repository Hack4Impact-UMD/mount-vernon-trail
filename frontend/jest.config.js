/** @type {import('jest').Config} */
module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
        "postinstall\\.mjs$": "<rootDir>/test-utils/firebase-postinstall-stub.js",
    },
    testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
    clearMocks: true,
    transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|firebase|@firebase/.*)",
    ],
};
