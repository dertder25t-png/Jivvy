/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@excalidraw/excalidraw'],
    webpack: (config, { isServer }) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp$": false,
            "onnxruntime-node$": false,
            "canvas$": false,
            // Fix for Supabase ESM/CJS build error
            "@supabase/supabase-js": "@supabase/supabase-js/dist/main/index.js",
        };

        // Fix for pdfjs-dist canvas dependency
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                canvas: false,
                fs: false,
                path: false,
            };
        }

        return config;
    },
};

export default nextConfig;

