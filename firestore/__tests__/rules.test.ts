import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, deleteDoc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// Exercises firestore.rules against the emulator. The client-side requireUser()
// guards are UX only; these rules are the actual boundary, so every claim the
// PR makes about who can do what is asserted here.

const ADMIN = "admin-uid";
const OTHER_ADMIN = "other-admin-uid";
const VOLUNTEER = "volunteer-uid";
const STRANGER = "stranger-uid";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: "mvt-rules-test",
        firestore: {
            rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
            host: "127.0.0.1",
            port: 8085,
        },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

function admin(uid = ADMIN) {
    return testEnv.authenticatedContext(uid, { admin: true }).firestore();
}

function volunteer(uid = VOLUNTEER) {
    return testEnv.authenticatedContext(uid).firestore();
}

function anonymous() {
    return testEnv.unauthenticatedContext().firestore();
}

function eventDoc(overrides: Record<string, unknown> = {}) {
    return {
        eventId: "event-1",
        title: "Spring Cleanup",
        description: "",
        trelloCardId: "card-1",
        albumId: "album-1",
        albumUrl: "",
        createdBy: ADMIN,
        startedBy: null,
        startDate: null,
        endDate: null,
        savedAsDraftAt: null,
        isActive: false,
        isDraft: false,
        eventLeader: "Ada",
        zoneLeaders: "",
        toolHaulers: "",
        gloverLover: "",
        notes: "",
        metrics: { trashBagsCollected: 0 },
        ...overrides,
    };
}

async function seed(path: string, id: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), path, id), data);
    });
}

describe("events — read", () => {
    it("denies an unauthenticated read", async () => {
        await seed("events", "event-1", eventDoc());
        await assertFails(getDoc(doc(anonymous(), "events", "event-1")));
    });

    it("allows any signed-in user to read", async () => {
        // Deliberate: home-screen must read an admin-created event the
        // volunteer has never touched, to populate the pre-start modal.
        await seed("events", "event-1", eventDoc());
        await assertSucceeds(getDoc(doc(volunteer(), "events", "event-1")));
    });
});

describe("events — create", () => {
    it("denies a non-admin", async () => {
        await assertFails(
            setDoc(doc(volunteer(), "events", "event-1"), eventDoc({ createdBy: VOLUNTEER })),
        );
    });

    it("denies an unauthenticated caller", async () => {
        await assertFails(setDoc(doc(anonymous(), "events", "event-1"), eventDoc()));
    });

    it("denies an admin claiming someone else authored it", async () => {
        await assertFails(
            setDoc(doc(admin(), "events", "event-1"), eventDoc({ createdBy: OTHER_ADMIN })),
        );
    });

    it("denies creating an event that is already started", async () => {
        await assertFails(
            setDoc(
                doc(admin(), "events", "event-1"),
                eventDoc({ startedBy: ADMIN, startDate: new Date() }),
            ),
        );
    });

    it("allows an admin to create an unstarted event they own", async () => {
        await assertSucceeds(
            setDoc(doc(admin(), "events", "event-1"), eventDoc()),
        );
    });
});

describe("events — claiming (start)", () => {
    it("lets a volunteer claim an unstarted event", async () => {
        await seed("events", "event-1", eventDoc());
        await assertSucceeds(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                startDate: new Date(),
                startedBy: VOLUNTEER,
                isActive: true,
            }),
        );
    });

    it("denies claiming an event someone else already started", async () => {
        await seed("events", "event-1", eventDoc({ startedBy: STRANGER, startDate: new Date() }));
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                startDate: new Date(),
                startedBy: VOLUNTEER,
                isActive: true,
            }),
        );
    });

    it("denies claiming on someone else's behalf", async () => {
        await seed("events", "event-1", eventDoc());
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                startDate: new Date(),
                startedBy: STRANGER,
                isActive: true,
            }),
        );
    });

    it("denies smuggling an extra field into the claim", async () => {
        await seed("events", "event-1", eventDoc());
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                startDate: new Date(),
                startedBy: VOLUNTEER,
                isActive: true,
                title: "Hijacked",
            }),
        );
    });
});

describe("events — updates while running", () => {
    beforeEach(async () => {
        await seed(
            "events",
            "event-1",
            eventDoc({ startedBy: VOLUNTEER, startDate: new Date(), isActive: true }),
        );
    });

    it("lets the volunteer who started it write metrics", async () => {
        // Dotted paths report as the top-level key 'metrics'.
        await assertSucceeds(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                "metrics.trashBagsCollected": 4,
            }),
        );
    });

    it("denies an unrelated volunteer writing metrics", async () => {
        await assertFails(
            updateDoc(doc(volunteer(STRANGER), "events", "event-1"), {
                "metrics.trashBagsCollected": 4,
            }),
        );
    });

    it("lets an admin write metrics", async () => {
        await assertSucceeds(
            updateDoc(doc(admin(), "events", "event-1"), {
                "metrics.trashBagsCollected": 4,
            }),
        );
    });

    it("allows the notepad, draft and publish fields", async () => {
        await assertSucceeds(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                notepad: "Cleared the culvert",
                isDraft: true,
                isActive: false,
                savedAsDraftAt: new Date(),
            }),
        );
    });

    it("allows ending the event", async () => {
        await assertSucceeds(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                isActive: false,
                endDate: new Date(),
            }),
        );
    });

    it("denies reassigning startedBy after the claim", async () => {
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                startedBy: STRANGER,
            }),
        );
    });

    it("denies rewriting createdBy", async () => {
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), {
                createdBy: VOLUNTEER,
            }),
        );
    });

    it("denies editing the title", async () => {
        await assertFails(
            updateDoc(doc(volunteer(), "events", "event-1"), { title: "Renamed" }),
        );
    });
});

describe("events — delete", () => {
    it("denies deletion even for an admin", async () => {
        await seed("events", "event-1", eventDoc());
        await assertFails(deleteDoc(doc(admin(), "events", "event-1")));
    });

    it("denies deletion for the volunteer running it", async () => {
        await seed("events", "event-1", eventDoc({ startedBy: VOLUNTEER }));
        await assertFails(deleteDoc(doc(volunteer(), "events", "event-1")));
    });
});

describe("albums", () => {
    const album = (overrides: Record<string, unknown> = {}) => ({
        albumId: "album-1",
        title: "Spring Cleanup",
        titleLower: "spring cleanup",
        albumUrl: "",
        eventId: null,
        createdBy: ADMIN,
        createdAt: new Date(),
        ...overrides,
    });

    it("allows any signed-in user to read", async () => {
        await seed("albums", "album-1", album());
        await assertSucceeds(getDoc(doc(volunteer(), "albums", "album-1")));
    });

    it("denies a non-admin creating one", async () => {
        await assertFails(
            setDoc(doc(volunteer(), "albums", "album-1"), album({ createdBy: VOLUNTEER })),
        );
    });

    it("allows an admin to create one they own", async () => {
        await assertSucceeds(setDoc(doc(admin(), "albums", "album-1"), album()));
    });

    it("denies an admin attributing it to another admin", async () => {
        await assertFails(
            setDoc(doc(admin(), "albums", "album-1"), album({ createdBy: OTHER_ADMIN })),
        );
    });

    it("lets the owning admin link it to an event", async () => {
        await seed("albums", "album-1", album());
        await assertSucceeds(
            updateDoc(doc(admin(), "albums", "album-1"), {
                eventId: "event-1",
                albumUrl: "https://photos.example/a",
            }),
        );
    });

    it("denies a different admin updating it", async () => {
        await seed("albums", "album-1", album());
        await assertFails(
            updateDoc(doc(admin(OTHER_ADMIN), "albums", "album-1"), { eventId: "event-1" }),
        );
    });
});

describe("albumTitles — the duplicate-name reservation", () => {
    const reservation = (overrides: Record<string, unknown> = {}) => ({
        titleKey: "t_spring%20cleanup",
        title: "Spring Cleanup",
        titleLower: "spring cleanup",
        albumId: null,
        reservedBy: ADMIN,
        reservedAt: new Date(),
        status: "pending",
        ...overrides,
    });

    it("denies a non-admin reserving a title", async () => {
        await assertFails(
            setDoc(
                doc(volunteer(), "albumTitles", "t_x"),
                reservation({ reservedBy: VOLUNTEER }),
            ),
        );
    });

    it("allows an admin to reserve a title as pending", async () => {
        await assertSucceeds(
            setDoc(doc(admin(), "albumTitles", "t_x"), reservation()),
        );
    });

    it("denies reserving straight into the created state", async () => {
        await assertFails(
            setDoc(doc(admin(), "albumTitles", "t_x"), reservation({ status: "created" })),
        );
    });

    it("lets the holder finalize their reservation", async () => {
        await seed("albumTitles", "t_x", reservation());
        await assertSucceeds(
            updateDoc(doc(admin(), "albumTitles", "t_x"), {
                albumId: "album-1",
                status: "created",
            }),
        );
    });

    it("lets the holder roll back a pending reservation", async () => {
        await seed("albumTitles", "t_x", reservation());
        await assertSucceeds(deleteDoc(doc(admin(), "albumTitles", "t_x")));
    });

    it("denies deleting a finished reservation, so titles stay permanent", async () => {
        await seed("albumTitles", "t_x", reservation({ status: "created" }));
        await assertFails(deleteDoc(doc(admin(), "albumTitles", "t_x")));
    });

    it("denies releasing a reservation held by someone else", async () => {
        await seed("albumTitles", "t_x", reservation());
        await assertFails(deleteDoc(doc(admin(OTHER_ADMIN), "albumTitles", "t_x")));
    });
});

describe("everything else is closed by default", () => {
    it("denies reads and writes to an undeclared collection", async () => {
        await assertFails(setDoc(doc(admin(), "secrets", "s1"), { a: 1 }));
        await assertFails(getDoc(doc(admin(), "secrets", "s1")));
    });
});
