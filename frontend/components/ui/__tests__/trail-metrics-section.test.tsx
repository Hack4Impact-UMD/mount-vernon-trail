import { createDefaultMetrics } from "@/services/event-service";
import { METRIC_FIELD_KEYS } from "../trail-metrics-section";

describe("metrics model and UI stay in sync", () => {
    it("every EventMetrics key has an input field, and vice versa", () => {
        // trailImprovements used to exist in the model with no input, so it
        // could never be set and the counter could read "16 of 15".
        expect([...METRIC_FIELD_KEYS].sort()).toEqual(
            Object.keys(createDefaultMetrics()).sort(),
        );
    });

    it("declares no duplicate field keys", () => {
        expect(new Set(METRIC_FIELD_KEYS).size).toBe(METRIC_FIELD_KEYS.length);
    });
});
