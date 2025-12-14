import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
    uniqueTokenPerInterval: number;
    interval: number; // in milliseconds
}

const rateLimiters = new Map<string, LRUCache<string, number>>();

export function rateLimit(
    options: RateLimitConfig
) {
    return {
        check: async (limit: number, token: string) => {
            const key = JSON.stringify(options);
            let tokenCache = rateLimiters.get(key);

            if (!tokenCache) {
                tokenCache = new LRUCache<string, number>({
                    max: options.uniqueTokenPerInterval || 500,
                    ttl: options.interval || 60000,
                });
                rateLimiters.set(key, tokenCache);
            }

            const tokenCount = (tokenCache.get(token) as number) || [0];
            const currentUsage = Array.isArray(tokenCount) ? tokenCount[0] : tokenCount;

            if (currentUsage >= limit) {
                throw new Error('Rate limit exceeded');
            }

            tokenCache.set(token, currentUsage + 1);
        },
    };
}
