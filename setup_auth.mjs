import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { writeFileSync, appendFileSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

async function main() {
    try {
        console.log("Generating keys...");
        const keys = await generateKeyPair("RS256");
        const privateKey = await exportPKCS8(keys.privateKey);
        const publicKey = await exportJWK(keys.publicKey);
        const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

        // Format for .env file (one line, quoted if needed, but usually convex env set handles vars)
        // For .env.local, we might need to handle newlines. Usually "value" works.
        // But for private key, it has newlines.
        // @convex-dev/auth helper `requireEnv` reads process.env.
        // In local dev, nextjs loads .env.local.

        const privateKeyEnv = privateKey.trimEnd().replace(/\n/g, " "); // Flatten for easier handling

        // 1. Update .env.local
        const envLocalPath = '.env.local';
        let envContent = "";
        try {
            envContent = readFileSync(envLocalPath, 'utf8');
        } catch (e) { }

        if (!envContent.includes("JWT_PRIVATE_KEY")) {
            appendFileSync(envLocalPath, `\nJWT_PRIVATE_KEY="${privateKeyEnv}"\n`);
            console.log("Added JWT_PRIVATE_KEY to .env.local");
        } else {
            console.log("JWT_PRIVATE_KEY already in .env.local (skipping append)");
        }

        if (!envContent.includes("JWKS")) {
            // Escape double quotes in JSON for .env?
            // usually single quotes around value works: JWKS='...'
            appendFileSync(envLocalPath, `JWKS='${jwks}'\n`);
            console.log("Added JWKS to .env.local");
        } else {
            console.log("JWKS already in .env.local (skipping append)");
        }

        // 2. Set in Convex Env
        const runSet = (name, value) => {
            console.log(`Setting ${name} to Convex...`);
            const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
            const result = spawnSync(cmd, ['convex', 'env', 'set', name, value], {
                stdio: 'inherit',
                shell: false
            });
            if (result.status !== 0) {
                console.error(`Failed to set ${name}`);
            } else {
                console.log(`Successfully set ${name}`);
            }
        };

        runSet('JWT_PRIVATE_KEY', privateKeyEnv);
        runSet('JWKS', jwks);

    } catch (e) {
        console.error(e);
    }
}

main();
