import { createApp } from "./app";
import { getFirestore } from "firebase-admin/firestore";
import { loadEnv } from "./env";
import { initFirebase } from "./firebase";
import {
    createOAuthClient,
    createTokenKeyValueStore,
    createTokenStore,
} from "./google-tokens";

function main(): void {
    const env = loadEnv();
    const auth = initFirebase(env);
    const tokenStore = createTokenStore(
        env,
        createTokenKeyValueStore(env),
        createOAuthClient(env),
    );
    const firestore = getFirestore();

    const server = createApp(
        env,
        auth,
        tokenStore,
        async (eventId) => {
            const snapshot = await firestore
                .collection("events")
                .doc(eventId)
                .get();
            return snapshot.exists ? snapshot.data() ?? null : null;
        },
    ).listen(env.port, () => {
        console.log(`mount-vernon-trail backend listening on port ${env.port}`);
    });
    // Node drops idle keep-alive sockets after 5s, well inside iOS's idle pool.
    // A client that reuses a socket Node just closed gets "The network
    // connection was lost", and NSURLSession does not retry a POST, so a photo
    // upload shortly after another call could fail at random. Outlive the
    // client's pool instead; headersTimeout must stay above keepAliveTimeout.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
}

try {
    main();
} catch (error) {
    console.error(
        `Startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
}
