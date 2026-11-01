// Only the GPS entry point is used; parser modules register themselves on import.
declare module "exifr/src/highlevel/gps.mjs" {
    export const gps: typeof import("exifr").gps;
}
