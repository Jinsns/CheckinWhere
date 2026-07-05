#!/usr/bin/env tsx
/**
 * Enrich scenic spot data using AMap (高德地图) API
 * - Get coordinates
 * - Get basic address and description
 * - Get photos from POI data
 */

import fs from 'fs';
import path from 'path';

const AMAP_KEY = process.env.AMAP_KEY || '30cb701498eeae31d6789886fb389d6d';
const DATA_DIR = path.join(process.cwd(), 'data', 'scenic-spots');

interface ScenicSpot {
  id: string;
  name: string;
  province: string;
  city: string;
  intro?: string;
  location?: { lat: number; lng: number };
}

async function searchPOI(name: string, city: string, province: string): Promise<any | null> {
  try {
    const cityName = city || province;
    const url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(name)}&types=110000&city=${encodeURIComponent(cityName)}&citylimit=true&offset=5`;
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.status === '1' && data.pois && data.pois.length > 0) {
      return data.pois[0];
    }
    return null;
  } catch (e) {
    console.error('POI search error:', e);
    return null;
  }
}

async function getPOIDetail(poiId: string): Promise<any | null> {
  try {
    const url = `https://restapi.amap.com/v3/place/detail?key=${AMAP_KEY}&id=${poiId}`;
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.status === '1' && data.pois && data.pois.length > 0) {
      return data.pois[0];
    }
    return null;
  } catch (e) {
    console.error('POI detail error:', e);
    return null;
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
  // Directory search
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
  location?: { lat: number; lng: number },
  photos?: string[],
  address?: string
): void {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Update coordinates in frontmatter
  if (location && !content.includes('latitude:')) {
    content = content.replace(/^(---\n[^]*?)(---)/m,
      `$1latitude: ${location.lat}\nlongitude: ${location.lng}\n$2`);
  }

  // Add address info to intro
  if (address) {
    const introMatch = content.match(/## 景区概览\n\n([\s\S]*?)(?=\n## |$)/);
    if (introMatch && introMatch[1].trim().length < 100) {
      const currentIntro = introMatch[1].trim();
      const newIntro = currentIntro.includes('待补充')
        ? address
        : `${currentIntro}\n\n${address}`;
      content = content.replace(
        /## 景区概览\n\n[\s\S]*?(?=\n## |$)/,
        `## 景区概览\n\n${newIntro.trim()}\n\n`
      );
    }
  }

  // Add photos
  if (photos && photos.length > 0) {
    const imgCount = (content.match(/!\[.*?\]\(http/g) || []).length;
    if (imgCount < 2) {
      const imgSection = photos.map(url => `![]( ${url} )`).join('\n\n');
      if (!content.includes('## 景区内主要景点')) {
        content += `\n\n## 景区内主要景点\n\n${imgSection}\n\n`;
      } else {
        const match = content.match(/## 景区内主要景点\n\n([\s\S]*?)(?=\n## |$)/);
        if (match && !match[1].includes('http')) {
          content = content.replace(
            /## 景区内主要景点\n\n[\s\S]*?(?=\n## |$)/,
            `## 景区内主要景点\n\n${imgSection}\n\n`
          );
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

  // Search POI
  const poi = await searchPOI(spot.name, spot.city, spot.province);
  if (!poi) {
    return { updated: false, details: { ...details, error: 'POI not found' } };
  }

  details.poiName = poi.name;
  details.address = poi.address;

  // Parse coordinates
  const location = poi.location?.split(',');
  let coords;
  if (location && location.length === 2) {
    coords = { lng: parseFloat(location[0]), lat: parseFloat(location[1]) };
    details.hasCoords = true;
  }

  // Get detail photos
  const photos: string[] = [];
  if (poi.id) {
    const detail = await getPOIDetail(poi.id);
    if (detail?.photos?.length > 0) {
      photos.push(...detail.photos.slice(0, 4).map((p: any) => p.url));
      details.photoCount = photos.length;
    }
  }

  updateReadme(readmePath, coords, photos, poi.address);

  return { updated: true, details };
}

async function main(limit: number = 100, delay: number = 1500) {
  const allSpots: ScenicSpot[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'scenic-spots', 'all.json'), 'utf-8')
  );

  // Prioritize spots missing coordinates (most useful data)
  const needsLocation = allSpots.filter(s => !s.location);
  console.log(`Total spots: ${allSpots.length}`);
  console.log(`Missing coordinates: ${needsLocation.length}`);
  console.log(`Processing first ${limit} spots...\n`);

  let successCount = 0;
  const toProcess = needsLocation.slice(0, limit);

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
  console.log('Now regenerating the scenic index...');

  // Regenerate index after update
  const { execSync } = require('child_process');
  execSync('npx tsx scripts/generate-scenic-index.ts', { stdio: 'inherit' });
}

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const delay = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '1500');

main(limit, delay).catch(console.error);
