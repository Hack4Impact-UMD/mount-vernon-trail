import { render, screen } from "@testing-library/react-native";
import IssueMapPreview from "../issue-map-preview.web";
import TrailMap from "../trail-map.web";

it("directs web users to the native app from both map entry points", async () => {
    const preview = await render(<IssueMapPreview issueId="bridge-issue" />);
    expect(
        screen.getByText("Open the iOS or Android app to view the issue map."),
    ).toBeOnTheScreen();
    await preview.unmount();

    await render(
        <TrailMap
            selectedIssue={null}
            onSelectIssue={jest.fn()}
        />,
    );
    expect(
        screen.getByText(
            "Open the iOS or Android development build to view the map.",
        ),
    ).toBeOnTheScreen();
});
