it("imports the GPS parser with React Native's navigator and no browser userAgent", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { product: "ReactNative" },
    });
    try {
        jest.isolateModules(() => {
            const parser =
                jest.requireActual<typeof import("../exif-gps")>("../exif-gps");
            expect(typeof parser.gps).toBe("function");
        });
    } finally {
        if (descriptor)
            Object.defineProperty(globalThis, "navigator", descriptor);
        else Reflect.deleteProperty(globalThis, "navigator");
    }
});
