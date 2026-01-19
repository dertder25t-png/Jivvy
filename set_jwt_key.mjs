// Direct script to set JWT_PRIVATE_KEY using spawn with proper argument handling
import { spawn } from "child_process";
import { readFileSync } from "fs";

const envContent = readFileSync('.env.local', 'utf8');
const match = envContent.match(/JWT_PRIVATE_KEY="([^"]+)"/);

if (!match) {
    console.error("JWT_PRIVATE_KEY not found in .env.local");
    process.exit(1);
}

const privateKey = match[1];
console.log("Found JWT_PRIVATE_KEY, length:", privateKey.length);

// Use spawn with shell: false to avoid command line parsing issues
const child = spawn('npx.cmd', ['convex', 'env', 'set', 'JWT_PRIVATE_KEY', privateKey], {
    stdio: 'inherit',
    shell: false
});

child.on('close', (code) => {
    if (code === 0) {
        console.log("\n✅ JWT_PRIVATE_KEY set successfully!");
    } else {
        console.error("\n❌ Failed with exit code:", code);
    }
});

child.on('error', (err) => {
    console.error("Spawn error:", err);
});
