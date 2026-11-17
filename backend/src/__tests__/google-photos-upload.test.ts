import { uploadBytes, batchCreate } from "../google-photos";
import { PhotoByteTransferError } from "../errors";
const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
});
it.each([
    new TypeError("fetch failed"),
    new DOMException("Timed out", "TimeoutError"),
])(
    "classifies byte transport errors as safe before creation: %s",
    async (error) => {
        global.fetch = jest.fn().mockRejectedValueOnce(error);
        await expect(
            uploadBytes("token", new Uint8Array([1]), "image/jpeg"),
        ).rejects.toBeInstanceOf(PhotoByteTransferError);
    },
);
it("also handles connection loss while reading the upload token", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => {
            throw new TypeError("reset");
        },
    });
    await expect(
        uploadBytes("token", new Uint8Array([1]), "image/jpeg"),
    ).rejects.toBeInstanceOf(PhotoByteTransferError);
});
it("does not classify a batchCreate connection failure as a safe byte retry", async () => {
    const error = new TypeError("response lost");
    global.fetch = jest.fn().mockRejectedValueOnce(error);
    await expect(
        batchCreate("token", "album", [
            { uploadToken: "upload", fileName: "a.jpg" },
        ]),
    ).rejects.toBe(error);
});
