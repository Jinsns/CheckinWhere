import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Use absolute path to the data directory
const DATA_DIR = path.join(
  typeof process === 'undefined' ? '' : process.cwd(),
  'data',
  'scenic-spots'
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spotPath = searchParams.get('path');

  if (!spotPath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  try {
    // Decode and sanitize path
    const decodedPath = decodeURIComponent(spotPath);
    const safePath = decodedPath.replace(/\.\./g, '').replace(/^\//, '');
    const readmePath = path.join(DATA_DIR, safePath, 'README.md');

    if (!fs.existsSync(readmePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(readmePath, 'utf-8');

    // Parse frontmatter
    const frontmatter: Record<string, any> = {};
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let body = content;

    if (fmMatch) {
      const fmLines = fmMatch[1].split('\n');
      for (const line of fmLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          frontmatter[key] = value;
        }
      }
      body = content.slice(fmMatch[0].length).trim();
    }

    return NextResponse.json({
      frontmatter,
      body,
      path: safePath,
    });
  } catch (error) {
    console.error('Error reading scenic content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
