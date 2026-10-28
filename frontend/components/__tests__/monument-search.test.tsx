import { fireEvent, render } from "@testing-library/react-native";
import MonumentSearch from "../monument-search";

it("filters monuments by name and amenity, then opens the selected monument", () => {
    const onSelect = jest.fn();
    const view = render(<MonumentSearch onSelect={onSelect} />);
    fireEvent.press(view.getByLabelText("Search monuments and amenities"));
    fireEvent.changeText(
        view.getByLabelText("Search monuments or amenities"),
        "riverside",
    );
    fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    expect(view.getByText(/No monuments match/)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    fireEvent.press(
        view.getByLabelText("View Riverside Park / Little Hunting Creek"),
    );
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: "RP" }),
    );
    expect(view.queryByLabelText("Search monuments or amenities")).toBeNull();
});

it("clears the query and all selected amenities together", () => {
    const view = render(<MonumentSearch onSelect={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Search monuments and amenities"));
    fireEvent.changeText(
        view.getByLabelText("Search monuments or amenities"),
        "unknown",
    );
    fireEvent.press(view.getByLabelText("Filter by Parking"));
    fireEvent.press(view.getByText("Clear"));
    expect(
        view.getByLabelText("Search monuments or amenities").props.value,
    ).toBe("");
    expect(
        view.getByLabelText("Filter by Parking").props.accessibilityState
            .checked,
    ).toBe(false);
    expect(view.queryByText(/No monuments match/)).toBeNull();
});
