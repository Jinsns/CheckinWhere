#!/usr/bin/env tsx
/**
 * FeedCoop Global Search API wrapper
 * Usage: npx tsx scripts/feedcoop-search.ts "搜索关键词" [--images]
 */
import fs from 'fs';
import path from 'path';

const API_KEY = '1C5C1BjV42xQR2dXUaoyHYQ6PsncxGeP';
const API_ENDPOINT = 'https://open.feedcoopapi.com/search_api/global_search';

if (!API_KEY) {
  console.error('Error: Please set FEEDCOOP_API_KEY environment variable');
  process.exit(1);
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  images: string[];
  source: string;
}

async function search(
  query: string,
  options: {
    docCount?: number;
    maxSnippetLength?: number;
    maxImageCount?: number;
  } = {}
): Promise<SearchResult[]> {
  const { docCount = 20, maxSnippetLength = 1000, maxImageCount = 4 } = options;

  console.log(`🔍 Searching for: "${query}"`);

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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data.Result?.Documents || !Array.isArray(data.Result.Documents)) {
      console.warn('No results found');
      return [];
    }

    return data.Result.Documents.map((r: any) => ({
      title: r.Title || '',
      url: r.Url || '',
      snippet: (r.Snippet || []).map((s: any) => s.Text || '').join('\n'),
      images: (r.Snippet || [])
        .filter((s: any) => s.Image?.ImageUrl)
        .map((s: any) => s.Image.ImageUrl),
      source: r.HostInfo?.Hostname || '',
    }));
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
}

function printResults(results: SearchResult[], showImages: boolean = false) {
  console.log(`\n📋 Found ${results.length} results:\n`);

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   ${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? '...' : ''}`);
    console.log(`   🔗 ${r.url}`);
    if (showImages && r.images.length > 0) {
      console.log(`   🖼️  Images: ${r.images.join(', ')}`);
    }
    console.log('');
  });
}

async function searchScenicSpotIntro(name: string, province: string): Promise<string | null> {
  const results = await search(`${province} ${name} 景区 简介 介绍`, {
    docCount: 5,
    maxSnippetLength: 500,
    maxImageCount: 0,
  });

  if (results.length === 0) return null;

  // Combine relevant snippets
  const snippets = results
    .map(r => r.snippet)
    .filter(s => s.length > 50)
    .join(' ')
    .slice(0, 800);

  return snippets || null;
}

async function main() {
  const args = process.argv.slice(2);
  const query = args.filter(a => !a.startsWith('--')).join(' ');
  const showImages = args.includes('--images');

  if (!query) {
    console.error('Usage: npx tsx scripts/feedcoop-search.ts "搜索关键词" [--images]');
    process.exit(1);
  }

  const results = await search(query, { maxImageCount: showImages ? 3 : 0 });
  printResults(results, showImages);
}

// Export for use in other scripts
export { search, searchScenicSpotIntro };

if (require.main === module) {
  main().catch(console.error);
}
