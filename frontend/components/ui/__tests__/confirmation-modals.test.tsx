import { render, screen } from "@testing-library/react-native";
import EndEventModal from "../end-event-modal";
import PublishEventModal from "../publish-event-modal";

// iOS shows one modal at a time, so a failure has to appear inside the
// confirmation modal that is already up, not in a second AlertPopup.
describe("confirmation modal errors", () => {
    it("shows a publish failure inside the publish modal", async () => {
        await render(
            <PublishEventModal
                visible
                onCancel={jest.fn()}
                onConfirm={jest.fn()}
                error="Trello is down"
            />,
        );

        expect(screen.getByText("Publish failed")).toBeTruthy();
        expect(screen.getByText("Trello is down")).toBeTruthy();
    });

    it("shows an end-event failure inside the end-event modal", async () => {
        await render(
            <EndEventModal
                visible
                eventTitle="Saturday cleanup"
                onCancel={jest.fn()}
                onConfirm={jest.fn()}
                error="Permission denied"
            />,
        );

        expect(screen.getByText("Could not end the event")).toBeTruthy();
        expect(screen.getByText("Permission denied")).toBeTruthy();
    });

    it("shows no error block when nothing has failed", async () => {
        await render(
            <PublishEventModal
                visible
                onCancel={jest.fn()}
                onConfirm={jest.fn()}
            />,
        );

        expect(screen.queryByText("Publish failed")).toBeNull();
    });
});
