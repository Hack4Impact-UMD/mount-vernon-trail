/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    // The emulator is a shared, stateful resource; parallel workers would
    // clear each other's seeded data mid-test.
    maxWorkers: 1,
    testTimeout: 20000,
};
