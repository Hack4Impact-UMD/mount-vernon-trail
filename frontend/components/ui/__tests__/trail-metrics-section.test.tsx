import { act, fireEvent, render } from "@testing-library/react-native";
import React, { createRef } from "react";
import { createDefaultMetrics } from "@/services/event-service";
import * as eventService from "@/services/event-service";
import TrailMetricsSection, {
    METRIC_FIELD_KEYS,
    type TrailMetricsSectionHandle,
} from "../trail-metrics-section";

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

    it("flushes the last debounced metric edit before leaving", async () => {
        const update = jest
            .spyOn(eventService, "updateEventMetrics")
            .mockResolvedValue(undefined);
        const ref = createRef<TrailMetricsSectionHandle>();
        const { getByLabelText, getByText } = render(
            <TrailMetricsSection ref={ref} eventId="event-1" />,
        );

        fireEvent.press(getByText("Drainage"));
        fireEvent.press(getByLabelText("Increase Drains / culverts cleaned"));
        await act(async () => {
            await ref.current?.flushPendingUpdates();
        });

        expect(update).toHaveBeenCalledWith("event-1", {
            drainageCleaned: 1,
        });
        update.mockRestore();
    });
});
