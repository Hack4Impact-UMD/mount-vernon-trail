import { fireEvent, render } from "@testing-library/react-native";
import TrailLandmarkSearch from "../trail-landmark-search";

it("finds monuments by name and opens the selected monument", async () => {
    const onSelect = jest.fn();
    const view = await render(<TrailLandmarkSearch onSelect={onSelect} />);
    await fireEvent.press(view.getByLabelText("Search trail landmarks"));
    await fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "riverside",
    );
    expect(view.queryAllByRole("checkbox")).toHaveLength(0);
    await fireEvent.press(
        view.getByLabelText("View Riverside Park / Little Hunting Creek"),
    );
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: "RP" }),
    );
    expect(view.queryByLabelText("Landmark name or abbreviation")).toBeNull();
});

it("clears the query and selected category together", async () => {
    const view = await render(<TrailLandmarkSearch onSelect={jest.fn()} />);
    await fireEvent.press(view.getByLabelText("Search trail landmarks"));
    await fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "unknown",
    );
    await fireEvent.press(view.getByLabelText("Show Monuments"));
    await fireEvent.press(view.getByText("Clear"));
    expect(
        view.getByLabelText("Landmark name or abbreviation").props.value,
    ).toBe("");
    expect(
        view.getByLabelText("Show All").props.accessibilityState.selected,
    ).toBe(true);
    expect(view.queryByText(/No locations match/)).toBeNull();
});

it("searches bridges and mile markers and clears category filters", async () => {
    const onSelect = jest.fn();
    const view = await render(<TrailLandmarkSearch onSelect={onSelect} />);
    await fireEvent.press(view.getByLabelText("Search trail landmarks"));
    await fireEvent.press(view.getByLabelText("Show Bridges"));
    await fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "B29A",
    );
    await fireEvent.press(view.getByLabelText("View Bridge 29A"));
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bridge-29a", kind: "bridge" }),
    );
    await fireEvent.press(view.getByLabelText("Search trail landmarks"));
    await fireEvent.press(view.getByText("Clear"));
    await fireEvent.press(view.getByLabelText("Show Mile markers"));
    await fireEvent.changeText(
        view.getByLabelText("Landmark name or abbreviation"),
        "M4",
    );
    await fireEvent.press(view.getByLabelText("View Mile Marker 4"));
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "mile-marker-4", kind: "mile-marker" }),
    );
});
