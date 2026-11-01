import { toByteArray } from "base64-js";
import { gps } from "../exif-gps";
import { resolvePhotoIssueLocation } from "../photo-issue-location";
import type { Card } from "../trello-types";

jest.mock("../exif-gps", () => ({ gps: jest.fn() }));
const card = {
    id: "issue",
    name: "Bridge issue",
    attachments: [
        { url: "https://trello.com/original.jpg", mimeType: "image/jpeg" },
        { url: "https://trello.com/other.jpg", mimeType: "image/jpeg" },
    ],
} as Card;
beforeEach(() => jest.resetAllMocks());
it("extracts original image GPS and preserves longitude-first order", async () => {
    jest.mocked(gps).mockResolvedValue({ latitude: 38.8, longitude: -77 });
    const load = jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID");
    expect(await resolvePhotoIssueLocation(card, load)).toMatchObject({
        coordinates: [-77, 38.8],
    });
    expect(load).toHaveBeenCalledWith(card.attachments![0].url);
    expect(gps).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(load).toHaveBeenCalledTimes(1);
});
it("tries the next attachment when the first has no GPS", async () => {
    jest.mocked(gps)
        .mockResolvedValueOnce(undefined as never)
        .mockResolvedValueOnce({ latitude: 38.8, longitude: -77 });
    expect(
        await resolvePhotoIssueLocation(
            card,
            jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID"),
        ),
    ).toMatchObject({ coordinates: [-77, 38.8] });
});
it.each([
    undefined,
    { latitude: NaN, longitude: -77 },
    { latitude: 91, longitude: -77 },
])("rejects absent or invalid GPS: %j", async (value) => {
    jest.mocked(gps).mockResolvedValue(value as never);
    expect(
        await resolvePhotoIssueLocation(
            card,
            jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID"),
        ),
    ).toBeNull();
});
it("continues when an attachment fails to load or parse", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.mocked(gps).mockRejectedValue(new Error("Invalid EXIF"));
    expect(
        await resolvePhotoIssueLocation(
            card,
            jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID"),
        ),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
});
it("skips non-image attachments", async () => {
    const load = jest.fn();
    expect(
        await resolvePhotoIssueLocation(
            {
                ...card,
                attachments: [
                    {
                        url: "https://trello.com/c/event",
                        mimeType: "text/html",
                    },
                ],
            },
            load,
        ),
    ).toBeNull();
    expect(load).not.toHaveBeenCalled();
});

it("reads real JPEG EXIF bytes, including the west longitude reference", async () => {
    // Minimal JPEG APP1 with a TIFF GPS IFD: 38°48' N, 77° W.
    const tiff = Buffer.alloc(128);
    tiff.write("II");
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8);
    tiff.writeUInt16LE(0x8825, 10);
    tiff.writeUInt16LE(4, 12);
    tiff.writeUInt32LE(1, 14);
    tiff.writeUInt32LE(26, 18);
    tiff.writeUInt16LE(4, 26);
    const entry = (
        offset: number,
        tag: number,
        type: number,
        count: number,
        value: number,
    ) => {
        tiff.writeUInt16LE(tag, offset);
        tiff.writeUInt16LE(type, offset + 2);
        tiff.writeUInt32LE(count, offset + 4);
        tiff.writeUInt32LE(value, offset + 8);
    };
    entry(28, 1, 2, 2, 78); // N, inline ASCII
    entry(40, 2, 5, 3, 80);
    entry(52, 3, 2, 2, 87); // W, inline ASCII
    entry(64, 4, 5, 3, 104);
    [38, 48, 0, 77, 0, 0].forEach((value, index) => {
        tiff.writeUInt32LE(value, 80 + index * 8);
        tiff.writeUInt32LE(1, 84 + index * 8);
    });
    const header = Buffer.from([
        255, 216, 255, 225, 0, 136, 69, 120, 105, 102, 0, 0,
    ]);
    const jpeg = Buffer.concat([header, tiff, Buffer.from([255, 217])]);
    const actual = jest.requireActual<typeof import("exifr")>("../exif-gps");
    expect(await actual.gps(toByteArray(jpeg.toString("base64")))).toEqual({
        latitude: 38.8,
        longitude: -77,
    });
});

it.each(["image/png", "image/webp", "image/gif"])(
    "skips unsupported %s attachments before downloading them",
    async (mimeType) => {
        const load = jest.fn();
        expect(
            await resolvePhotoIssueLocation(
                {
                    ...card,
                    attachments: [
                        { mimeType, url: "https://trello.com/photo" },
                    ],
                },
                load,
            ),
        ).toBeNull();
        expect(load).not.toHaveBeenCalled();
        expect(gps).not.toHaveBeenCalled();
    },
);
it("silently skips unknown image bytes and tries the next supported photo", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
        jest.mocked(gps)
            .mockRejectedValueOnce(new Error("Unknown file format"))
            .mockResolvedValueOnce({ latitude: 38.8, longitude: -77 });
        expect(
            await resolvePhotoIssueLocation(
                card,
                jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID"),
            ),
        ).toMatchObject({ coordinates: [-77, 38.8] });
        expect(warn).not.toHaveBeenCalled();
    } finally {
        warn.mockRestore();
    }
});
it("uses a supported extension when the attachment MIME type is missing", async () => {
    jest.mocked(gps).mockResolvedValue({ latitude: 38.8, longitude: -77 });
    expect(
        await resolvePhotoIssueLocation(
            {
                ...card,
                attachments: [
                    { mimeType: "", url: "https://trello.com/original.jpg" },
                ],
            },
            jest.fn().mockResolvedValue("data:image/jpeg;base64,AQID"),
        ),
    ).toMatchObject({ coordinates: [-77, 38.8] });
});
