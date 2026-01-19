import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { writeFileSync } from "fs";
import { spawnSync } from "child_process";

async function main() {
    try {
        const keys = await generateKeyPair("RS256");
        const privateKey = await exportPKCS8(keys.privateKey);
        const publicKey = await exportJWK(keys.publicKey);
        const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

        // Match the logic from @convex-dev/auth source
        const privateKeyEnv = privateKey.trimEnd().replace(/\n/g, " ");

        writeFileSync("keys.json", JSON.stringify({
            JWT_PRIVATE_KEY: privateKeyEnv,
            JWKS: jwks
        }, null, 2));

        console.log("Keys written to keys.json");

        console.log("Setting JWT_PRIVATE_KEY...");
        const ret1 = spawnSync("npx", ["convex", "env", "set", "JWT_PRIVATE_KEY", privateKeyEnv], { stdio: "inherit", shell: true });
        if (ret1.status !== 0) console.error("Failed to set JWT_PRIVATE_KEY");

        console.log("Setting JWKS...");
        const ret2 = spawnSync("npx", ["convex", "env", "set", "JWKS", jwks], { stdio: "inherit", shell: true });
        if (ret2.status !== 0) console.error("Failed to set JWKS");

    } catch (e) {
        console.error(e);
    }
}

main();
