import withPWA from "@ducanh2912/next-pwa";

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

const pwaConfig = withPWA({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
    runtimeCaching: [
        {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
                cacheName: "google-fonts",
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
            },
        },
        {
            urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
                cacheName: "static-fonts",
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                },
            },
        },
        {
            urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
            handler: "StaleWhileRevalidate",
            options: {
                cacheName: "static-images",
                expiration: {
                    maxEntries: 64,
                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
            },
        },
    ],
});

export default pwaConfig(nextConfig);
