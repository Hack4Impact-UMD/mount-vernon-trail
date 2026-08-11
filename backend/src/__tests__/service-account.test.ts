import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadServiceAccount } from "../service-account";

const VALID = {
    type: "service_account",
    project_id: "friends-of-mvt",
    client_email: "svc@friends-of-mvt.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
};

const LABEL = "FIREBASE_SERVICE_ACCOUNT_JSON";

describe("inline JSON", () => {
    it("accepts the key file contents on one line", () => {
        const account = loadServiceAccount(JSON.stringify(VALID), LABEL);
        expect(account.project_id).toBe("friends-of-mvt");
        // The \n escapes must survive as real newlines for cert() to accept it.
        expect(account.private_key).toContain("\n");
    });

    it("tolerates surrounding whitespace", () => {
        expect(
            loadServiceAccount(`  ${JSON.stringify(VALID)}  `, LABEL).project_id,
        ).toBe("friends-of-mvt");
    });

    it("explains the quoting trap when the JSON is malformed", () => {
        // What dotenv produces when the value is double-quoted: the \n escapes
        // become real newlines inside a JSON string, which is invalid.
        const mangled = JSON.stringify(VALID).replace(/\\n/g, "\n");
        expect(() => loadServiceAccount(mangled, LABEL)).toThrow(/NOT wrapped in quotes/);
    });

    it("rejects JSON that is not a service account", () => {
        expect(() => loadServiceAccount('{"hello":"world"}', LABEL)).toThrow(
            /missing project_id/,
        );
    });
});

describe("file path", () => {
    it("reads the key from a path", () => {
        const dir = mkdtempSync(join(tmpdir(), "sa-"));
        const file = join(dir, "key.json");
        writeFileSync(file, JSON.stringify(VALID));

        const account = loadServiceAccount(file, LABEL);
        expect(account.project_id).toBe("friends-of-mvt");
        expect(account.private_key).toContain("BEGIN PRIVATE KEY");
    });

    it("says the path was unreadable rather than blaming the JSON", () => {
        expect(() => loadServiceAccount("/no/such/key.json", LABEL)).toThrow(
            /could not be read/,
        );
    });

    it("reports a path that exists but holds junk", () => {
        const dir = mkdtempSync(join(tmpdir(), "sa-"));
        const file = join(dir, "key.json");
        writeFileSync(file, "not json at all");
        expect(() => loadServiceAccount(file, LABEL)).toThrow(/not valid JSON/);
    });
});
