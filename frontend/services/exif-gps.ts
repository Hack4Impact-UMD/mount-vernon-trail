// Prebuilt exifr bundles load browser orientation detection at import time.
// React Native has navigator but no userAgent, so load only GPS and byte parsers.
import "exifr/src/file-parsers/jpeg.mjs";
import "exifr/src/file-parsers/heif.mjs";
import "exifr/src/file-parsers/tiff.mjs";
import "exifr/src/segment-parsers/tiff-exif.mjs";
export { gps } from "exifr/src/highlevel/gps.mjs";
