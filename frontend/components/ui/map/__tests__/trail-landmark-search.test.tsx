import { fireEvent, render } from "@testing-library/react-native";
import TrailLandmarkSearch from "../trail-landmark-search";

it("filters monuments by name and amenity, then opens the selected monument", () => {
    const onSelect = jest.fn();
    const view = render(<TrailLandmarkSearch onSelect={onSelect} />);
    fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "riverside",
    );
    fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    expect(view.getByText(/No locations match/)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    fireEvent.press(
        view.getByLabelText("View Riverside Park / Little Hunting Creek"),
    );
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: "RP" }),
    );
    expect(
        view.queryByLabelText("Search trail landmarks or amenities"),
    ).toBeNull();
});

it("clears the query and all selected amenities together", () => {
    const view = render(<TrailLandmarkSearch onSelect={jest.fn()} />);
    fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "unknown",
    );
    fireEvent.press(view.getByLabelText("Filter by Parking"));
    fireEvent.press(view.getByText("Clear"));
    expect(
        view.getByLabelText("Search trail landmarks or amenities").props.value,
    ).toBe("");
    expect(
        view.getByLabelText("Filter by Parking").props.accessibilityState
            .checked,
    ).toBe(false);
    expect(view.queryByText(/No locations match/)).toBeNull();
});

it("searches bridges and mile markers and clears category filters", () => {
    const onSelect = jest.fn();
    const view = render(<TrailLandmarkSearch onSelect={onSelect} />);
    fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    fireEvent.press(view.getByLabelText("Show Bridges"));
    fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "B29A",
    );
    fireEvent.press(view.getByLabelText("View Bridge 29A"));
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bridge-29a", kind: "bridge" }),
    );
    fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    fireEvent.press(view.getByText("Clear"));
    fireEvent.press(view.getByLabelText("Show Mile markers"));
    fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "M4",
    );
    fireEvent.press(
        view.getByLabelText("View Mile Marker 4"),
    );
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "mile-marker-4", kind: "mile-marker" }),
    );
});
