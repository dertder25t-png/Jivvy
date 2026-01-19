import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const envPath = '.env.local';
const content = readFileSync(envPath, 'utf8');

// Parse JWT_PRIVATE_KEY (double quoted)
const privateKeyMatch = content.match(/JWT_PRIVATE_KEY="(.+?)"/s); // dot matches newline if s flag, but here it's flattened
const privateKey = privateKeyMatch ? privateKeyMatch[1] : null;

// Parse JWKS (single quoted)
const jwksMatch = content.match(/JWKS='(.+?)'/s);
const jwks = jwksMatch ? jwksMatch[1] : null;

const runSet = (name, value) => {
    if (!value) {
        console.error(`Skipping ${name} - value not found in .env.local`);
        return;
    }
    console.log(`Setting ${name}...`);
    // On Windows, npx might be a cmd file
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    // shell: false is crucial for passing strings with spaces/special chars as single argv
    const result = spawnSync(cmd, ['convex', 'env', 'set', name, value], {
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
