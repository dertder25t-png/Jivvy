import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

const envPath = '.env.local';
const content = readFileSync(envPath, 'utf8');

// Parse JWT_PRIVATE_KEY
const privateKeyMatch = content.match(/JWT_PRIVATE_KEY="(.+?)"/s);
const privateKey = privateKeyMatch ? privateKeyMatch[1] : null;

// Parse JWKS
const jwksMatch = content.match(/JWKS='(.+?)'/s);
const jwks = jwksMatch ? jwksMatch[1] : null;

// Path to convex bin
const convexBin = resolve('node_modules', 'convex', 'bin', 'main.js');

const runSet = (name, value) => {
    if (!value) {
        console.error(`Skipping ${name} - not found`);
        return;
    }
    console.log(`Setting ${name}...`);

    // Run node directly
    const result = spawnSync('node', [convexBin, 'env', 'set', name, value], {
        stdio: 'inherit',
        shell: false
    });

    if (result.status !== 0) {
        console.error(`Failed to set ${name}. Exit code: ${result.status}`);
    } else {
        console.log(`Successfully set ${name}`);
    }
};

runSet('JWT_PRIVATE_KEY', privateKey);
runSet('JWKS', jwks);
