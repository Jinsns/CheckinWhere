#!/usr/bin/env tsx
/**
 * Enhanced scenic spot data enrichment:
 * - Wikipedia content
 * - Wikimedia Commons images
 * - Coordinates from GeoNames/Wikipedia
 * - Image metadata
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'url';

interface ScenicSpot {
  id: string;
  name: string;
  province: string;
  city: string;
  intro?: string;
  location?: { lat: number; lng: number };
  images?: Array<{ url: string; caption?: string }>;
}

const DATA_DIR = path.join(process.cwd(), 'data', 'scenic-spots');
const WIKIPEDIA_API = 'https://zh.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });
  return response.json();
}

async function searchWikipedia(name: string): Promise<string | null> {
  try {
    const searchUrl = `${WIKIPEDIA_API}?action=query&list=search&srsearch=${encodeURIComponent(name)}&srwhat=text&srlimit=3&format=json`;
    const data = await fetchJSON(searchUrl);
    const results = data?.query?.search;
    if (results && results.length > 0) {
      return results[0].title;
    }
  } catch (e) {
    console.error('Search error:', e);
  }
  return null;
}

async function getWikipediaExtract(title: string): Promise<string | null> {
  try {
    const url = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&explaintext=1&format=json`;
    const data = await fetchJSON(url);
    const pages = data?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId]?.extract) {
        return pages[pageId].extract.trim();
      }
    }
  } catch (e) {
    console.error('Extract error:', e);
  }
  return null;
}

async function getCoordinates(title: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=coordinates&format=json`;
    const data = await fetchJSON(url);
    const pages = data?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const coords = pages[pageId]?.coordinates?.[0];
      if (coords) {
        return { lat: coords.lat, lng: coords.lon };
      }
    }
  } catch (e) {
    console.error('Coordinates error:', e);
  }
  return null;
}

async function getWikimediaImages(title: string, maxImages: number = 4): Promise<string[]> {
  try {
    const searchUrl = `${COMMONS_API}?action=query&list=search&srsearch=${encodeURIComponent(title)}&srnamespace=6&srlimit=${maxImages}&format=json`;
    const data = await fetchJSON(searchUrl);
    const results = data?.query?.search || [];
    const imageUrls: string[] = [];

    for (const result of results) {
      if (imageUrls.length >= maxImages) break;
      const fileName = result.title.replace('File:', '');
      // Use direct thumbnail URL
      imageUrls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=400`);
    }
    return imageUrls;
  } catch (e) {
    console.error('Image search error:', e);
    return [];
  }
}

function findReadmeFile(spot: ScenicSpot): string | null {
  const possiblePaths = [
    path.join(DATA_DIR, spot.province, spot.city, spot.name, 'README.md'),
    path.join(DATA_DIR, spot.province, spot.name, 'README.md'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  // Find by glob matching
  const findDir = (dir: string, depth: number = 0): string | null => {
    if (depth > 4) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.includes(spot.name.slice(0, 5))) {
          const readme = path.join(fullPath, 'README.md');
          if (fs.existsSync(readme)) return readme;
        }
        const found = findDir(fullPath, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return findDir(DATA_DIR);
}

function updateReadme(
  filePath: string,
  intro?: string,
  location?: { lat: number; lng: number },
  images?: string[]
): void {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Update frontmatter coordinates
  if (location) {
    if (!/latitude:/.test(content)) {
      content = content.replace(/^(---\n[^]*?)(---)/m, `$1latitude: ${location.lat}\nlongitude: ${location.lng}\n$2`);
    }
  }

  // Update intro
  if (intro && intro.length > 100) {
    const existingIntro = content.match(/## 景区概览\n\n([\s\S]*?)(?=\n## |$)/);
    if (existingIntro && existingIntro[1].trim().length < 100) {
      const cleanIntro = intro.slice(0, 800).trim();
      content = content.replace(/## 景区概览\n\n[\s\S]*?(?=\n## |$)/, `## 景区概览\n\n${cleanIntro}\n\n`);
    }
  }

  // Update images
  if (images && images.length > 0) {
    // Check if already has enough images
    const imgCount = (content.match(/!\[.*?\]\(http/g) || []).length;
    if (imgCount < 2) {
      const imgSection = images.map(url => `![]( ${url} )`).join('\n\n');
      if (!content.includes('## 景区内主要景点')) {
        content += `\n\n## 景区内主要景点\n\n${imgSection}\n\n`;
      } else {
        // Replace placeholder or add to existing section
        const match = content.match(/## 景区内主要景点\n\n([\s\S]*?)(?=\n## |$)/);
        if (match && !match[1].includes('http')) {
          content = content.replace(/## 景区内主要景点\n\n[\s\S]*?(?=\n## |$)/, `## 景区内主要景点\n\n${imgSection}\n\n`);
        }
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

async function enrichSpot(spot: ScenicSpot): Promise<{ updated: boolean; details: any }> {
  const readmePath = findReadmeFile(spot);
  if (!readmePath) {
    return { updated: false, details: { error: 'README not found' } };
  }

  const details: any = { name: spot.name };

  // Search for Wikipedia page
  const wikiTitle = await searchWikipedia(`${spot.province} ${spot.name}`) ||
                    await searchWikipedia(spot.name);

  if (!wikiTitle) {
    return { updated: false, details: { ...details, error: 'No Wikipedia page found' } };
  }

  details.wikiTitle = wikiTitle;

  // Fetch data concurrently
  const [intro, coords, images] = await Promise.all([
    getWikipediaExtract(wikiTitle),
    getCoordinates(wikiTitle),
    getWikimediaImages(wikiTitle, 4),
  ]);

  if (intro) details.hasIntro = true;
  if (coords) details.hasCoords = true;
  if (images.length > 0) details.imageCount = images.length;

  updateReadme(readmePath, intro, coords, images);

  return { updated: true, details };
}

async function main(limit: number = 50, delay: number = 2000) {
  const allSpots: ScenicSpot[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'scenic-spots', 'all.json'), 'utf-8')
  );

  // Prioritize spots missing all data
  const needsEnrichment = allSpots.filter(s =>
    (!s.intro || s.intro.length < 100) &&
    (!s.location) &&
    (!s.images || s.images.length === 0)
  );

  console.log(`Total spots: ${allSpots.length}`);
  console.log(`Needs enrichment: ${needsEnrichment.length}`);
  console.log(`Processing first ${limit} spots...\n`);

  let successCount = 0;
  const toProcess = needsEnrichment.slice(0, limit);

  for (let i = 0; i < toProcess.length; i++) {
    const spot = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${spot.name}...`);
    try {
      const result = await enrichSpot(spot);
      if (result.updated) {
        successCount++;
        console.log(`  ✓ Updated:`, result.details);
      } else {
        console.log(`  ✗ Skipped:`, result.details);
      }
    } catch (e) {
      console.log(`  ✗ Error:`, e);
    }

    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.log(`\nDone! Successfully updated ${successCount} / ${toProcess.length} spots.`);
}

// Run with arguments: npm run tsx scripts/enrich-scenic-data.ts --limit=50 --delay=2000
const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const delay = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '2000');

main(limit, delay).catch(console.error);
