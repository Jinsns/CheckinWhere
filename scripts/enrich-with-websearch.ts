#!/usr/bin/env tsx
/**
 * Enrich scenic spot data using FeedCoop web search API
 * - Fill in missing introductions
 * - Get high quality images
 */
import fs from 'fs';
import path from 'path';

const API_KEY = '1C5C1BjV42xQR2dXUaoyHYQ6PsncxGeP';
const API_ENDPOINT = 'https://open.feedcoopapi.com/search_api/global_search';
const DATA_DIR = path.join(process.cwd(), 'data', 'scenic-spots');

interface ScenicSpot {
  id: string;
  name: string;
  province: string;
  city: string;
  intro?: string;
  location?: { lat: number; lng: number };
  images?: Array<{ url: string; caption?: string }>;
}

async function webSearch(
  query: string,
  options: {
    docCount?: number;
    maxImageCount?: number;
    maxSnippetLength?: number;
  } = {}
): Promise<any[]> {
  const { docCount = 20, maxImageCount = 4, maxSnippetLength = 1000 } = options;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query: query + '\n',
        doc_count: docCount,
        max_snippet_length: maxSnippetLength,
        max_image_count_per_doc: maxImageCount,
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return [];
    }

    const data = await response.json() as any;
    return data.Result?.Documents || [];
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
}

function extractIntroFromResults(docs: any[]): string | null {
  const snippets: string[] = [];

  for (const doc of docs) {
    if (doc.Snippet && Array.isArray(doc.Snippet)) {
      for (const s of doc.Snippet) {
        if (s.Text && s.Text.length > 50 && !s.Text.includes('下载') && !s.Text.includes('http')) {
          snippets.push(s.Text.trim());
        }
      }
    }
  }

  if (snippets.length === 0) return null;

  // Combine first few snippets
  const combined = snippets.slice(0, 3).join('\n\n');
  // Clean up
  return combined
    .replace(/\s+/g, ' ')
    .replace(/[。.!！？?].{0,20}$/, m => m.includes('。') || m.includes('！') || m.includes('？') ? m : '')
    .slice(0, 800)
    .trim();
}

function extractImagesFromResults(docs: any[]): string[] {
  const images: string[] = [];

  for (const doc of docs) {
    if (doc.Snippet && Array.isArray(doc.Snippet)) {
      for (const s of doc.Snippet) {
        if (s.Image?.ImageUrl && images.length < 6) {
          const url = s.Image.ImageUrl;
          // Skip watermarked images
          if (!url.includes('vcg.') && !url.includes('watermark') && url.length < 300) {
            images.push(url);
          }
        }
      }
    }
  }

  return images;
}

function findReadmeFile(spot: ScenicSpot): string | null {
  const possiblePaths = [
    path.join(DATA_DIR, spot.province, spot.city, spot.name, 'README.md'),
    path.join(DATA_DIR, spot.province, spot.name, 'README.md'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function updateReadme(
  filePath: string,
  intro?: string | null,
  images?: string[]
): void {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Update introduction
  if (intro && intro.length > 100) {
    const introMatch = content.match(/## 景区概览\n\n([\s\S]*?)(?=\n## |$)/);
    if (introMatch && introMatch[1].trim().length < 100) {
      content = content.replace(
        /## 景区概览\n\n[\s\S]*?(?=\n## |$)/,
        `## 景区概览\n\n${intro}\n\n`
      );
    }
  }

  // Update images section
  if (images && images.length > 0) {
    const imgSection = images.map(url => `![]( ${url} )`).join('\n\n');
    // Check if already has good images
    const existingImages = content.match(/!\[.*?\]\(http/g) || [];
    if (existingImages.length < 3) {
      content = content.replace(
        /## 景区内主要景点\n\n[\s\S]*?(?=\n## |$)/,
        `## 景区内主要景点\n\n${imgSection}\n\n`
      );
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

  // Search for scenic spot info
  const docs = await webSearch(`${spot.province} ${spot.name} 景区 简介 介绍`, {
    docCount: 5,
    maxImageCount: 3,
  });

  if (docs.length === 0) {
    return { updated: false, details: { ...details, error: 'No search results' } };
  }

  const intro = extractIntroFromResults(docs);
  const images = extractImagesFromResults(docs);

  if (intro) {
    details.hasIntro = true;
    details.introLength = intro.length;
  }
  if (images.length > 0) {
    details.imageCount = images.length;
  }

  updateReadme(readmePath, intro, images);

  return { updated: !!(intro || images.length > 0), details };
}

async function main(limit: number = 50, delay: number = 1500) {
  const allSpots: ScenicSpot[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'scenic-spots', 'all.json'), 'utf-8')
  );

  // Prioritize spots missing intro AND images
  const needsEnrichment = allSpots.filter(s =>
    (!s.intro || s.intro.length < 100) && (!s.images || s.images.length < 3)
  );

  console.log(`Total spots: ${allSpots.length}`);
  console.log(`Needs enrichment (intro + images): ${needsEnrichment.length}`);
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
  console.log('Now regenerating the scenic index...');

  // Regenerate index after update
  const { execSync } = require('child_process');
  execSync('npx tsx scripts/generate-scenic-index.ts', { stdio: 'inherit' });
}

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const delay = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '1500');

main(limit, delay).catch(console.error);
