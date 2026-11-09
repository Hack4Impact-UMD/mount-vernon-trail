import { fireEvent, render } from "@testing-library/react-native";
import MapIssueCard from "../map-issue-card";
import type { MapPin } from "../map-overlays";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
const first: MapPin = {
    id: "one",
    coordinates: [-77, 38],
    title: "Clear vines",
    locationName: "Gravelly Point Park",
};
const second: MapPin = { ...first, id: "two", title: "Repair fence" };

it("shows all shared-location issues in a scrollable list and opens the chosen issue", () => {
    const onClose = jest.fn();
    const view = render(
        <MapIssueCard
            issue={{ ...first, sameLocationIssues: [first, second] }}
            onClose={onClose}
        />,
    );
    expect(view.getByText("2 issues at this location")).toBeTruthy();
    expect(view.getByLabelText("Issues at this location")).toBeTruthy();
    expect(view.getByText("Clear vines")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Open issue: Repair fence"));
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
        pathname: "/trail-issue-screen",
        params: { issueId: "two", issueName: "Repair fence" },
    });
});
it("retains the single-issue popup for a location with only one issue", () => {
    const view = render(
        <MapIssueCard
            issue={first}
            onClose={jest.fn()}
        />,
    );
    expect(view.getByLabelText("Issue details")).toBeTruthy();
    expect(view.queryByText(/issues at this location/)).toBeNull();
    expect(view.getByLabelText("Open issue: Clear vines")).toBeTruthy();
});
