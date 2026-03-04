import { type NextRequest, NextResponse } from 'next/server';

// Ensure this route is never statically pre-rendered or cached
export const dynamic = 'force-dynamic';

const ORTHANC_URL = process.env.ORTHANC_URL ?? 'http://localhost:8042';

async function proxyToDicomWeb(request: NextRequest, path: string[]): Promise<NextResponse> {
  const upstreamUrl = `${ORTHANC_URL}/dicom-web/${path.join('/')}${
    request.nextUrl.search ? request.nextUrl.search : ''
  }`;

  const headers = new Headers();
  // Forward relevant request headers (skip accept-encoding so we get raw bytes)
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === 'authorization' ||
      lower === 'accept' ||
      lower === 'content-type' ||
      lower === 'content-length'
    ) {
      headers.set(key, value);
    }
  }

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    // @ts-expect-error – Node.js fetch needs this to stream large DICOM files
    duplex: 'half',
  });

  // Buffer the full response to ensure binary data is transferred byte-perfectly
  const body = Buffer.from(await upstream.arrayBuffer());

  const responseHeaders = new Headers();
  // Forward the content-type (includes multipart boundary) from Orthanc
  const ct = upstream.headers.get('content-type');
  if (ct) {
    responseHeaders.set('content-type', ct);
  }
  responseHeaders.set('content-length', String(body.byteLength));

  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  return proxyToDicomWeb(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  return proxyToDicomWeb(request, path);
}
