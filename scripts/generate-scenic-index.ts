#!/usr/bin/env tsx
/**
 * Generate static JSON index for 5A scenic spots.
 * Parses all README.md files and creates searchable indexes.
 * Output: src/data/scenic-spots/
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'scenic-spots');
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data', 'scenic-spots');

interface ScenicImage {
  url: string;
  caption?: string;
  keywords?: string[];
  license?: string;
}

interface ScenicSpot {
  id: string;
  name: string;
  level: '5A';
  province: string;
  city: string;
  county: string;
  location: { lat: number; lng: number } | null;
  batch: string;
  source: string;
  intro: string;
  images: ScenicImage[];
}

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: Record<string, any> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

function extractIntro(content: string): string {
  // Try multiple heading patterns: old format, new format with emoji
  const overviewPatterns = [
    /## 景区概览\n\n([\s\S]*?)(?=\n## |$)/,
    /## 🗺️ 景区全景导览\n\n([\s\S]*?)(?=\n## |$)/,
    /## 🎤 AI导游带你游\n\n([\s\S]*?)(?=\n## |$)/,
  ];

  for (const pattern of overviewPatterns) {
    const match = content.match(pattern);
    if (match && match[1].trim().length > 30) {
      let intro = match[1].trim();
      // Remove CSS residue and placeholder
      intro = intro.replace(/mw-parser-output[\s\S]*?\{[\s\S]*?\}/g, '');
      intro = intro.replace(/display:inline|white-space:nowrap/g, '');
      intro = intro.replace(/待补充。?/, '').trim();
      // Clean up multiple newlines
      intro = intro.replace(/\n\s*\n/g, '\n').trim();
      // Limit length
      return intro.slice(0, 800);
    }
  }

  return '';
}

function extractImages(content: string, readmePath: string): ScenicImage[] {
  const images: ScenicImage[] = [];
  // Match markdown images: both remote URLs and local paths
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\)]+|[^\)]+\.(?:jpg|jpeg|png|webp))\)\n?(?:\*([^*]+)\*)?/g;

  let match;
  while ((match = imagePattern.exec(content)) !== null) {
    let url = match[2];
    // If it's a local path (not starting with http), prepend API path
    if (!url.startsWith('http')) {
      // Convert relative path to API path: /api/scenic-images?path=[province]/[city]/[spot]/images/[filename]
      const parts = readmePath.split(path.sep);
      const spotDir = parts[parts.length - 2];
      const cityDir = parts[parts.length - 3];
      const provinceDir = parts[parts.length - 4];
      const filename = path.basename(url);
      url = `/api/scenic-images?path=${encodeURIComponent(`${provinceDir}/${cityDir}/${spotDir}/images/${filename}`)}`;
    }
    const img: ScenicImage = {
      url,
      caption: match[3]?.trim() || match[1] || undefined,
    };
    images.push(img);
  }

  return images.slice(0, 6);
}

function toPinyinId(name: string): string {
  // Simple pinyin mapping for common chars, fallback to removing non-ascii
  return name
    .replace(/[^\w一-龥]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function processSpot(readmePath: string): ScenicSpot | null {
  const content = fs.readFileSync(readmePath, 'utf-8');
  const fm = parseFrontmatter(content);

  if (!fm.name) return null;

  const parts = readmePath.split(path.sep);
  const countyIndex = parts.length - 2;
  const cityIndex = parts.length - 3;
  const provinceIndex = parts.length - 4;

  const province = fm.province || parts[provinceIndex] || '';

  const spot: ScenicSpot = {
    id: toPinyinId(`${province}-${fm.name}`),
    name: fm.name,
    level: '5A',
    province,
    city: fm.city || parts[cityIndex] || '',
    county: fm.county || parts[countyIndex] || '',
    location: null,
    batch: fm.batch || '',
    source: fm.source || '',
    intro: extractIntro(content),
    images: extractImages(content, readmePath),
  };

  if (fm.latitude && fm.longitude) {
    spot.location = {
      lat: parseFloat(fm.latitude),
      lng: parseFloat(fm.longitude),
    };
  }

  return spot;
}

function main() {
  const spots: ScenicSpot[] = [];

  // Walk through all README.md files
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'scripts') {
        walk(fullPath);
      } else if (entry.name === 'README.md') {
        const spot = processSpot(fullPath);
        if (spot) spots.push(spot);
      }
    }
  }

  walk(DATA_DIR);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Full list
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'all.json'),
    JSON.stringify(spots, null, 2)
  );

  // 2. By province
  const byProvince: Record<string, ScenicSpot[]> = {};
  for (const spot of spots) {
    if (!byProvince[spot.province]) {
      byProvince[spot.province] = [];
    }
    byProvince[spot.province].push(spot);
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'by-province.json'),
    JSON.stringify(byProvince, null, 2)
  );

  // 3. By city
  const byCity: Record<string, ScenicSpot[]> = {};
  for (const spot of spots) {
    const key = `${spot.province}-${spot.city}`;
    if (!byCity[key]) {
      byCity[key] = [];
    }
    byCity[key].push(spot);
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'by-city.json'),
    JSON.stringify(byCity, null, 2)
  );

  // 4. Search index (name + location)
  const searchIndex = spots.map(s => ({
    id: s.id,
    name: s.name,
    province: s.province,
    city: s.city,
    location: s.location,
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'search-index.json'),
    JSON.stringify(searchIndex, null, 2)
  );

  // 5. Province and city lists
  const provinces = Object.keys(byProvince).sort();
  const cities: Record<string, string[]> = {};
  for (const province of provinces) {
    const citySet = new Set(byProvince[province].map(s => s.city));
    cities[province] = Array.from(citySet).sort();
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'province-list.json'),
    JSON.stringify(provinces, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'city-list.json'),
    JSON.stringify(cities, null, 2)
  );

  console.log(`✅ Generated indexes for ${spots.length} scenic spots`);
  console.log(`📍 With coordinates: ${spots.filter(s => s.location).length}`);
  console.log(`🖼️  With images: ${spots.filter(s => s.images.length > 0).length}`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

main();
