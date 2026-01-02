/**
 * Proxy API Route
 * 
 * Fetches HTML content from external URLs for client-side parsing.
 * Used for syllabus imports and web scraping without exposing users' IPs.
 * 
 * Security measures:
 * - URL allowlist/denylist
 * - Size limits
 * - Timeouts
 * - Content-type validation
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum response size in bytes (5MB) */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

/** Request timeout in milliseconds */
const FETCH_TIMEOUT_MS = 15000;

/** Blocked hostnames (prevent SSRF attacks) */
const BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
    'metadata.google',
    'metadata.aws',
    '169.254.169.254',
];

/** Allowed content types */
const ALLOWED_CONTENT_TYPES = [
    'text/html',
    'text/plain',
    'text/calendar',
    'application/json',
    'text/xml',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isBlockedHost(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    return BLOCKED_HOSTS.some(blocked => 
        lower === blocked || 
        lower.startsWith(blocked) || 
        lower.endsWith(`.${blocked}`)
    );
}

function isValidUrl(urlString: string): { valid: boolean; url?: URL; error?: string } {
    try {
        const url = new URL(urlString);
        
        // Only allow http and https
        if (!['http:', 'https:'].includes(url.protocol)) {
            return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
        }

        // Check for blocked hosts
        if (isBlockedHost(url.hostname)) {
            console.warn(`[Proxy] Blocked SSRF attempt to host: ${url.hostname}`);
            return { valid: false, error: 'This host is not allowed' };
        }

        // Don't allow ports other than standard
        if (url.port && !['80', '443', ''].includes(url.port)) {
            return { valid: false, error: 'Non-standard ports are not allowed' };
        }

        return { valid: true, url };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

function isAllowedContentType(contentType: string): boolean {
    const type = contentType.toLowerCase().split(';')[0].trim();
    return ALLOWED_CONTENT_TYPES.some(allowed => type.startsWith(allowed));
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const targetUrl = searchParams.get('url');

        if (!targetUrl) {
            return NextResponse.json(
                { error: 'Missing url parameter', code: 'MISSING_URL' },
                { status: 400 }
            );
        }

        // Validate URL
        const validation = isValidUrl(targetUrl);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error, code: 'INVALID_URL' },
                { status: 400 }
            );
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(validation.url!.toString(), {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; JivvyBot/1.0; +https://jivvy.app)',
                    'Accept': 'text/html,text/plain,text/calendar,application/json,*/*',
                },
                redirect: 'manual',
            });

            clearTimeout(timeoutId);

            // Check response status
            if (!response.ok) {
                return NextResponse.json(
                    { 
                        error: `Upstream server returned ${response.status}`, 
                        code: 'UPSTREAM_ERROR',
                        status: response.status 
                    },
                    { status: 502 }
                );
            }

            // Check content type
            const contentType = response.headers.get('content-type') || '';
            if (!isAllowedContentType(contentType)) {
                return NextResponse.json(
                    { 
                        error: 'Content type not allowed', 
                        code: 'INVALID_CONTENT_TYPE',
                        contentType 
                    },
                    { status: 415 }
                );
            }

            // Check content length
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
                return NextResponse.json(
                    { 
                        error: 'Response too large', 
                        code: 'RESPONSE_TOO_LARGE',
                        maxSize: MAX_RESPONSE_SIZE 
                    },
                    { status: 413 }
                );
            }

            // Read body with size limit
            const reader = response.body?.getReader();
            if (!reader) {
                return NextResponse.json(
                    { error: 'No response body', code: 'EMPTY_RESPONSE' },
                    { status: 502 }
                );
            }

            const chunks: Uint8Array[] = [];
            let totalSize = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                totalSize += value.length;
                if (totalSize > MAX_RESPONSE_SIZE) {
                    reader.cancel();
                    return NextResponse.json(
                        { 
                            error: 'Response too large', 
                            code: 'RESPONSE_TOO_LARGE',
                            maxSize: MAX_RESPONSE_SIZE 
                        },
                        { status: 413 }
                    );
                }

                chunks.push(value);
            }

            // Combine chunks
            const body = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
                body.set(chunk, offset);
                offset += chunk.length;
            }

            // Decode and return
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const text = decoder.decode(body);

            return NextResponse.json({
                ok: true,
                url: validation.url!.toString(),
                contentType,
                size: totalSize,
                content: text,
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error) {
                if (fetchError.name === 'AbortError') {
                    return NextResponse.json(
                        { error: 'Request timed out', code: 'TIMEOUT' },
                        { status: 504 }
                    );
                }
                return NextResponse.json(
                    { error: fetchError.message, code: 'FETCH_FAILED' },
                    { status: 502 }
                );
            }

            throw fetchError;
        }

    } catch (error) {
        console.error('[Proxy] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
