#!/usr/bin/env node
/**
 * 豆包搜索工具 - doubao-search-skill 命令行版本
 * 功能:
 *   1. 核验景区经纬度坐标
 *   2. 搜索并下载景区图片
 *   3. 获取景区简介信息
 */

const API_KEY = '1C5C1BjV42xQR2dXUaoyHYQ6PsncxGeP';
const API_ENDPOINT = 'https://open.feedcoopapi.com/search_api/global_search';
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

async function search(query, options = {}) {
  const { docCount = 20, maxImageCount = 4, maxSnippetLength = 1500 } = options;

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
      return null;
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Search error:', e);
    return null;
  }
}

function extractCoordinates(docs) {
  const allText = docs
    .flatMap(doc => doc.Snippet || [])
    .map(s => s.Text)
    .filter(t => t)
    .join('\n');

  const latPattern = /纬度?[：:]\s*(\d+\.?\d*)/i;
  const lngPattern = /经度?[：:]\s*(\d+\.?\d*)/i;
  const coordPattern = /(\d+\.?\d*)°?\s*[NSns][,，\s]*(\d+\.?\d*)°?\s*[EWew]/;
  const numPairPattern = /(\d{2}\.\d+)\s*[,，]\s*(\d{2,3}\.\d+)/;

  let lat = null, lng = null;

  const latMatch = allText.match(latPattern);
  const lngMatch = allText.match(lngPattern);
  if (latMatch && lngMatch) {
    lat = parseFloat(latMatch[1]);
    lng = parseFloat(lngMatch[1]);
  }

  const coordMatch = allText.match(coordPattern);
  if (coordMatch && !lat) {
    lat = parseFloat(coordMatch[1]);
    lng = parseFloat(coordMatch[2]);
  }

  const numMatch = allText.match(numPairPattern);
  if (numMatch && !lat) {
    const num1 = parseFloat(numMatch[1]);
    const num2 = parseFloat(numMatch[2]);
    if (num1 > 0 && num1 < 90 && num2 > 70 && num2 < 140) {
      lat = num1;
      lng = num2;
    }
  }

  return { lat, lng, sourceText: allText.slice(0, 800) };
}

function extractImages(docs, count = 5) {
  const images = [];
  for (const doc of docs) {
    if (doc.Snippet && doc.Snippet.length > 0) {
      for (const snippet of doc.Snippet) {
        if (snippet.Image && snippet.Image.ImageUrl) {
          images.push({
            url: snippet.Image.ImageUrl,
            title: doc.Title || '',
            source: doc.DisplayUrl || '',
          });
          if (images.length >= count) break;
        }
      }
    }
    if (images.length >= count) break;
  }
  return images;
}

function extractIntro(docs) {
  const snippets = docs
    .flatMap(doc => doc.Snippet || [])
    .map(s => s.Text)
    .filter(t => t && t.length > 50);

  return snippets.slice(0, 3).join('\n\n').slice(0, 1000);
}

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => resolve(outputPath));
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

function readReadmeLocation(readmePath) {
  try {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const latMatch = content.match(/latitude[：:]\s*(\d+\.?\d*)/i);
    const lngMatch = content.match(/longitude[：:]\s*(\d+\.?\d*)/i);

    return {
      lat: latMatch ? parseFloat(latMatch[1]) : null,
      lng: lngMatch ? parseFloat(lngMatch[1]) : null,
    };
  } catch (e) {
    return { lat: null, lng: null };
  }
}

async function verifyLocation(spotName, readmePath = null) {
  console.log(`🔍 正在核验坐标: ${spotName}\n`);
  const result = await search(`${spotName} 经纬度 坐标 位置`, { docCount: 15, maxImageCount: 0 });

  if (!result || !result.Result || !result.Result.Documents) {
    console.log('❌ 搜索失败');
    return;
  }

  const { lat, lng, sourceText } = extractCoordinates(result.Result.Documents);
  if (!lat || !lng) {
    console.log('⚠️  未能提取到坐标');
    return;
  }

  console.log('✅ 搜索获取坐标:');
  console.log(`   纬度: ${lat.toFixed(6)}`);
  console.log(`   经度: ${lng.toFixed(6)}`);

  if (readmePath && fs.existsSync(readmePath)) {
    const current = readReadmeLocation(readmePath);
    console.log('\n📄 README当前坐标:');
    if (current.lat && current.lng) {
      console.log(`   纬度: ${current.lat.toFixed(6)}`);
      console.log(`   经度: ${current.lng.toFixed(6)}`);
      const latDiff = Math.abs(lat - current.lat);
      const lngDiff = Math.abs(lng - current.lng);
      if (latDiff < 0.01 && lngDiff < 0.01) {
        console.log('\n✅ 坐标一致！');
      } else {
        console.log(`\n⚠️  差异: 纬度 ${latDiff.toFixed(4)}, 经度 ${lngDiff.toFixed(4)}`);
      }
    }
  }
}

async function fetchImages(spotName, outputDir, count = 5) {
  console.log(`🖼️  正在搜索图片: ${spotName}\n`);
  const result = await search(`${spotName} 景区 风光 图片`, { docCount: 10, maxImageCount: 8 });

  if (!result || !result.Result || !result.Result.Documents) {
    console.log('❌ 搜索失败');
    return;
  }

  const images = extractImages(result.Result.Documents, count);
  console.log(`找到 ${images.length} 张图片\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = path.extname(new URL(img.url).pathname) || '.jpg';
    const filename = `spot-${i + 1}${ext}`;
    const outputPath = path.join(outputDir, filename);

    try {
      process.stdout.write(`   下载中 [${i + 1}/${images.length}]: ${filename}...`);
      await downloadImage(img.url, outputPath);
      const stats = fs.statSync(outputPath);
      if (stats.size < 1024) {
        fs.unlinkSync(outputPath);
        console.log(' ❌ 文件过小，已删除');
      } else {
        console.log(` ✅ (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      console.log(` ❌ ${e.message}`);
    }
  }
  console.log(`\n✅ 图片保存在: ${outputDir}`);
}

async function fetchIntro(spotName) {
  console.log(`📝 正在获取简介: ${spotName}\n`);
  const result = await search(`${spotName} 景区 简介 介绍`, { docCount: 10, maxImageCount: 0 });

  if (!result || !result.Result || !result.Result.Documents) {
    console.log('❌ 搜索失败');
    return;
  }

  const intro = extractIntro(result.Result.Documents);
  console.log(intro);
  return intro;
}

async function main(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('🎯 豆包搜索工具 - 景区数据采集');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/verify-location.js <命令> [参数]');
    console.log('');
    console.log('可用命令:');
    console.log('  location <景区名> [README路径]  - 核验经纬度坐标');
    console.log('  images <景区名> <输出目录> [数量] - 搜索并下载景区图片');
    console.log('  intro <景区名>                    - 获取景区简介');
    console.log('  all <景区名> <数据目录>           - 执行所有采集');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/verify-location.js location "故宫博物院"');
    console.log('  node scripts/verify-location.js images "云冈石窟" data/scenic-spots/山西省/大同市/云冈石窟/images');
    console.log('  node scripts/verify-location.js intro "黄山风景区"');
    console.log('  node scripts/verify-location.js all "莫高窟" data/scenic-spots/甘肃省/酒泉市/敦煌莫高窟');
    console.log('');
    return;
  }

  const command = args[0];
  const spotName = args[1];

  switch (command) {
    case 'location':
      await verifyLocation(spotName, args[2]);
      break;
    case 'images':
      await fetchImages(spotName, args[2], parseInt(args[3]) || 5);
      break;
    case 'intro':
      await fetchIntro(spotName);
      break;
    case 'all':
      const dataDir = args[2];
      console.log('=' .repeat(50));
      await verifyLocation(spotName, path.join(dataDir, 'README.md'));
      console.log('');
      await fetchImages(spotName, path.join(dataDir, 'images'), 6);
      console.log('');
      await fetchIntro(spotName);
      console.log('');
      console.log('=' .repeat(50));
      console.log('✅ 所有数据采集完成！');
      break;
    default:
      console.log('❌ 未知命令，使用 --help 查看帮助');
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(console.error);
}

module.exports = {
  search,
  extractCoordinates,
  extractImages,
  extractIntro,
  downloadImage,
  verifyLocation,
  fetchImages,
  fetchIntro
};
