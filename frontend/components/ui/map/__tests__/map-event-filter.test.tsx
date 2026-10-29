import { fireEvent, render } from "@testing-library/react-native";
import MapEventFilter from "../map-event-filter";

const options = [
    { id: "all", name: "All issues", count: 3 },
    { id: "unassigned", name: "Unassigned", count: 1 },
    { id: "event", name: "River cleanup", count: 2 },
];

it("searches, selects an event, and closes the picker", () => {
    const onSelect = jest.fn();
    const view = render(
        <MapEventFilter
            options={options}
            selectedId="all"
            onSelect={onSelect}
            loading={false}
            error={null}
            pinCount={2}
        />,
    );
    fireEvent.press(view.getByLabelText("Filter by event: All issues"));
    fireEvent.changeText(view.getByLabelText("Search events"), "river");
    expect(view.queryByLabelText("Unassigned, 1 issues")).toBeNull();
    fireEvent.press(view.getByLabelText("River cleanup, 2 issues"));
    expect(onSelect).toHaveBeenCalledWith("event");
    expect(view.queryByLabelText("Search events")).toBeNull();
});

it("explains a failed event load and prevents choosing misleading filters", () => {
    const view = render(
        <MapEventFilter
            options={options}
            selectedId="all"
            onSelect={jest.fn()}
            loading={false}
            error="Network failure"
            pinCount={2}
        />,
    );
    expect(view.getByText(/Event filters unavailable/)).toBeTruthy();
    expect(
        view.getByLabelText("Filter by event: All issues").props
            .accessibilityState.disabled,
    ).toBe(true);
});
