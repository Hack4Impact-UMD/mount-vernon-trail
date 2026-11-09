import { fireEvent, render } from "@testing-library/react-native";
import TrailLandmarkSearch from "../trail-landmark-search";

it("finds monuments by name and opens the selected monument", () => {
    const onSelect = jest.fn();
    const view = render(<TrailLandmarkSearch onSelect={onSelect} />);
    fireEvent.press(view.getByLabelText("Search trail landmarks"));
    fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "riverside",
    );
    expect(view.queryAllByRole("checkbox")).toHaveLength(0);
    fireEvent.press(
        view.getByLabelText("View Riverside Park / Little Hunting Creek"),
    );
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: "RP" }),
    );
    expect(view.queryByLabelText("Landmark name or abbreviation")).toBeNull();
});

it("clears the query and selected category together", () => {
    const view = render(<TrailLandmarkSearch onSelect={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Search trail landmarks"));
    fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "unknown",
    );
    fireEvent.press(view.getByLabelText("Show Monuments"));
    fireEvent.press(view.getByText("Clear"));
    expect(
        view.getByLabelText("Landmark name or abbreviation").props.value,
    ).toBe("");
    expect(
        view.getByLabelText("Show All").props.accessibilityState.selected,
    ).toBe(true);
    expect(view.queryByText(/No locations match/)).toBeNull();
});

it("searches bridges and mile markers and clears category filters", () => {
    const onSelect = jest.fn();
    const view = render(<TrailLandmarkSearch onSelect={onSelect} />);
    fireEvent.press(view.getByLabelText("Search trail landmarks"));
    fireEvent.press(view.getByLabelText("Show Bridges"));
    fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "B29A",
    );
    fireEvent.press(view.getByLabelText("View Bridge 29A"));
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bridge-29a", kind: "bridge" }),
    );
    fireEvent.press(view.getByLabelText("Search trail landmarks"));
    fireEvent.press(view.getByText("Clear"));
    fireEvent.press(view.getByLabelText("Show Mile markers"));
    fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "M4",
    );
    fireEvent.press(view.getByLabelText("View Mile Marker 4"));
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "mile-marker-4", kind: "mile-marker" }),
    );
});
