import { act, fireEvent, render } from "@testing-library/react-native";
import React, { createRef } from "react";
import { createDefaultMetrics } from "@/services/event-service";
import * as eventService from "@/services/event-service";
import TrailMetricsSection, {
    METRIC_FIELD_KEYS,
    type TrailMetricsSectionHandle,
} from "../trail-metrics-section";

jest.setTimeout(30_000);

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
        const { getByLabelText, getByText } = await render(
            <TrailMetricsSection ref={ref} eventId="event-1" />,
        );

        await fireEvent.press(getByText("Drainage"));
        await fireEvent.press(getByLabelText("Increase Drains / culverts cleaned"));
        await act(async () => {
            await ref.current?.flushPendingUpdates();
        });

        expect(update).toHaveBeenCalledWith("event-1", {
            drainageCleaned: 1,
        });
        update.mockRestore();
    });

    it("keeps an edit made during a failed flush instead of restoring the older value", async () => {
        let failFirst: (error: Error) => void = () => undefined;
        const update = jest
            .spyOn(eventService, "updateEventMetrics")
            .mockImplementationOnce(
                () =>
                    new Promise<void>((_resolve, reject) => {
                        failFirst = reject;
                    }),
            )
            .mockResolvedValue(undefined);
        const ref = createRef<TrailMetricsSectionHandle>();
        const { getByLabelText, getByText } = await render(
            <TrailMetricsSection ref={ref} eventId="event-1" />,
        );
        const increase = () =>
            fireEvent.press(getByLabelText("Increase Drains / culverts cleaned"));

        await fireEvent.press(getByText("Drainage"));
        await increase();
        let firstFlush: Promise<void> | undefined;
        await act(async () => {
            firstFlush = ref.current?.flushPendingUpdates();
        });
        expect(update).toHaveBeenLastCalledWith("event-1", {
            drainageCleaned: 1,
        });

        await increase();
        await act(async () => {
            failFirst(new Error("offline"));
            await expect(firstFlush).rejects.toThrow("offline");
        });
        await act(async () => {
            await ref.current?.flushPendingUpdates();
        });

        expect(update).toHaveBeenLastCalledWith("event-1", {
            drainageCleaned: 2,
        });
        update.mockRestore();
    });
});
