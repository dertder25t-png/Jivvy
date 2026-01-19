// Generate fresh RSA key pair for Convex Auth and save to file
// Run with: node generate_fresh_keys.mjs

import { generateKeyPair, exportJWK, exportPKCS8 } from 'jose';
import { writeFileSync } from 'fs';

async function generateAuthKeys() {
    console.log("Generating fresh RSA-2048 key pair for Convex Auth...\n");

    const { publicKey, privateKey } = await generateKeyPair('RS256', {
        modulusLength: 2048,
    });

    // Export private key in PKCS8 PEM format
    const privatePem = await exportPKCS8(privateKey);

    // Export public key as JWK for JWKS
    const publicJwk = await exportJWK(publicKey);
    publicJwk.use = 'sig';
    publicJwk.alg = 'RS256';

    const jwks = JSON.stringify({ keys: [publicJwk] });

    // Save to files
    const output = `=== JWT_PRIVATE_KEY ===
Copy this entire value (including the BEGIN/END lines):

${privatePem}
=== JWKS ===
Copy this entire JSON:

${jwks}

=== INSTRUCTIONS ===
1. Go to Convex Dashboard > Your Deployment > Settings > Environment Variables
2. Delete the existing JWT_PRIVATE_KEY and JWKS variables  
3. Add JWT_PRIVATE_KEY with the PEM key above (include the BEGIN/END lines)
4. Add JWKS with the JSON above
5. Save and test login again
`;

    writeFileSync('new_auth_keys.txt', output);
    console.log("Keys saved to new_auth_keys.txt");
    console.log("\nOpen that file and copy the keys to your Convex Dashboard.");
}

generateAuthKeys().catch(console.error);
