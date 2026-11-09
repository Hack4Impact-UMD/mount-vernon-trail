import { fireEvent, render } from "@testing-library/react-native";
import TrailLandmarkSearch from "../trail-landmark-search";

it("filters monuments by name and amenity, then opens the selected monument", async () => {
    const onSelect = jest.fn();
    const view = await render(<TrailLandmarkSearch onSelect={onSelect} />);
    await fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    await fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "riverside",
    );
    await fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    expect(view.getByText(/No locations match/)).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Filter by Restrooms"));
    await fireEvent.press(
        view.getByLabelText("View Riverside Park / Little Hunting Creek"),
    );
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: "RP" }),
    );
    expect(
        view.queryByLabelText("Search trail landmarks or amenities"),
    ).toBeNull();
});

it("clears the query and all selected amenities together", async () => {
    const view = await render(<TrailLandmarkSearch onSelect={jest.fn()} />);
    await fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    await fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "unknown",
    );
    await fireEvent.press(view.getByLabelText("Filter by Parking"));
    await fireEvent.press(view.getByText("Clear"));
    expect(
        view.getByLabelText("Search trail landmarks or amenities").props.value,
    ).toBe("");
    expect(
        view.getByLabelText("Filter by Parking").props.accessibilityState
            .checked,
    ).toBe(false);
    expect(view.queryByText(/No locations match/)).toBeNull();
});

it("searches bridges and mile markers and clears category filters", async () => {
    const onSelect = jest.fn();
    const view = await render(<TrailLandmarkSearch onSelect={onSelect} />);
    await fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    await fireEvent.press(view.getByLabelText("Show Bridges"));
    await fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "B29A",
    );
    await fireEvent.press(view.getByLabelText("View Bridge 29A"));
    expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bridge-29a", kind: "bridge" }),
    );
    await fireEvent.press(
        view.getByLabelText("Search trail landmarks and amenities"),
    );
    await fireEvent.press(view.getByText("Clear"));
    await fireEvent.press(view.getByLabelText("Show Mile markers"));
    await fireEvent.changeText(
        view.getByLabelText("Search trail landmarks or amenities"),
        "M4",
    );
    await fireEvent.press(
        view.getByLabelText("View Mile Marker 4"),
    );
    expect(onSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "mile-marker-4", kind: "mile-marker" }),
    );
});
