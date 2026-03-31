import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await segmentData.params;
    const objectKey = key.join('/');

    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const r2 = (ctx.env as any).R2_BUCKET;

    if (!r2) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    const object = await r2.get(objectKey);
    if (!object) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(object.body, { headers });
  } catch (error) {
    console.error('Image serve error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
