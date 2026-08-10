import { createApp } from "./app";
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

    createApp(env, auth, tokenStore).listen(env.port, () => {
        console.log(`mount-vernon-trail backend listening on port ${env.port}`);
    });
}

try {
    main();
} catch (error) {
    console.error(
        `Startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
}
