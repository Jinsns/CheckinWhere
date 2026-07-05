#!/usr/bin/env tsx
/**
 * Fill in "待补充" introductions using FeedCoop web search API
 */
import fs from 'fs';
import path from 'path';

const API_KEY = '1C5C1BjV42xQR2dXUaoyHYQ6PsncxGeP';
const API_ENDPOINT = 'https://open.feedcoopapi.com/search_api/global_search';
const DATA_DIR = path.join(process.cwd(), 'data', 'scenic-spots');

interface ReadmeInfo {
  path: string;
  name: string;
  province: string;
  city: string;
  hasEmptyIntro: boolean;
}

async function webSearch(query: string): Promise<any[]> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query: query + '\n',
        doc_count: 5,
        max_snippet_length: 1500,
        max_image_count_per_doc: 0,
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
        if (s.Text && s.Text.length > 80 && !s.Text.includes('下载') && !s.Text.includes('http')) {
          const cleaned = s.Text
            .replace(/<[^>]*>/g, '')
            .replace(/&[a-z]+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleaned.length > 80) {
            snippets.push(cleaned);
          }
        }
      }
    }
  }

  if (snippets.length === 0) return null;

  const uniqueSnippets = [...new Set(snippets)];
  const combined = uniqueSnippets.slice(0, 4).join('\n\n');

  // Clean up and format
  let result = combined
    .replace(/\s+/g, ' ')
    .replace(/[。.!！？?]{2,}/g, m => m[0])
    .trim();

  // Ensure it ends with proper punctuation
  if (!result.match(/[。！？.!?]$/)) {
    const lastPeriod = result.lastIndexOf('。');
    const lastExclaim = result.lastIndexOf('！');
    const lastQuestion = result.lastIndexOf('？');
    const lastDot = result.lastIndexOf('.');
    const lastEx = result.lastIndexOf('!');
    const lastQ = result.lastIndexOf('?');

    const lastPunc = Math.max(lastPeriod, lastExclaim, lastQuestion, lastDot, lastEx, lastQ);
    if (lastPunc > result.length * 0.6) {
      result = result.slice(0, lastPunc + 1);
    }
  }

  return result.slice(0, 1000).trim();
}

function findAllReadmes(): ReadmeInfo[] {
  const results: ReadmeInfo[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'README.md') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const hasEmptyIntro = content.includes('## 景区概览\n\n待补充');

        // Parse frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const lines = fmMatch[1].split('\n');
          let name = '', province = '', city = '';
          for (const line of lines) {
            const [key, ...rest] = line.split(':');
            const value = rest.join(':').trim();
            if (key === 'name') name = value;
            if (key === 'province') province = value;
            if (key === 'city') city = value;
          }
          results.push({ path: fullPath, name, province, city, hasEmptyIntro });
        }
      }
    }
  }

  walk(DATA_DIR);
  return results;
}

function updateReadmeIntro(filePath: string, intro: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('## 景区概览\n\n待补充')) {
    return false;
  }

  content = content.replace(
    /## 景区概览\n\n待补充。?\n\n/,
    `## 景区概览\n\n${intro}\n\n`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

async function main(limit: number = 100, delay: number = 2000) {
  const allReadmes = findAllReadmes();
  const needIntro = allReadmes.filter(r => r.hasEmptyIntro);

  console.log(`Total READMEs: ${allReadmes.length}`);
  console.log(`Need introduction: ${needIntro.length}`);
  console.log(`Processing first ${Math.min(limit, needIntro.length)} spots...\n`);

  let successCount = 0;
  const toProcess = needIntro.slice(0, limit);

  for (let i = 0; i < toProcess.length; i++) {
    const spot = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${spot.name} (${spot.province})...`);

    try {
      const docs = await webSearch(`${spot.province} ${spot.city} ${spot.name} 景区 简介 介绍`);

      if (docs.length === 0) {
        console.log(`  ✗ No search results`);
      } else {
        const intro = extractIntroFromResults(docs);
        if (intro && intro.length > 150) {
          const updated = updateReadmeIntro(spot.path, intro);
          if (updated) {
            successCount++;
            console.log(`  ✓ Updated (${intro.length} chars)`);
          } else {
            console.log(`  - Already has intro`);
          }
        } else {
          console.log(`  ✗ Intro too short: ${intro?.length || 0} chars`);
        }
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

  const { execSync } = require('child_process');
  execSync('npx tsx scripts/generate-scenic-index.ts', { stdio: 'inherit' });
}

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const delay = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '2000');

main(limit, delay).catch(console.error);
