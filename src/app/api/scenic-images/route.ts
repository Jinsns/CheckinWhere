import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filepath = url.searchParams.get('path');

  if (!filepath) {
    return new NextResponse('Missing path parameter', { status: 400 });
  }

  const imagePath = path.join(process.cwd(), 'data', 'scenic-spots', decodeURIComponent(filepath));

  if (!fs.existsSync(imagePath)) {
    return new NextResponse('Image not found', { status: 404 });
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(filepath).toLowerCase();
  const contentType = ext === '.png'
    ? 'image/png'
    : ext === '.webp'
    ? 'image/webp'
    : 'image/jpeg';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
