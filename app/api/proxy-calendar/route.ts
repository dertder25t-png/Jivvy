import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch calendar: ${response.statusText}`, { status: response.status });
        }

        const data = await response.text();

        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Access-Control-Allow-Origin': '*', // Allow client to read this
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
