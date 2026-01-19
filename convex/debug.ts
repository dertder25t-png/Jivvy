import { query } from "./_generated/server";

export const checkEnv = query({
    args: {},
    handler: async (ctx) => {
        const key = process.env.JWT_PRIVATE_KEY;
        const jwks = process.env.JWKS;
        const siteUrl = process.env.CONVEX_SITE_URL;
        return {
            hasPrivateKey: !!key,
            privateKeyLength: key ? key.length : 0,
            hasJWKS: !!jwks,
            jwksLength: jwks ? jwks.length : 0,
            hasSiteUrl: !!siteUrl,
            siteUrl: siteUrl
        };
    },
});
