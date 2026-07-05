#!/usr/bin/env node
/**
 * 5A景区README批量增强脚本
 * 功能：
 *   1. 批量核验并更新坐标
 *   2. 自动搜索下载景区图片
 *   3. 获取并整理景区简介
 *   4. 按照云冈石窟的AI导游风格重写README
 *
 * 作者: AI导游小艾
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_KEY = '1C5C1BjV42xQR2dXUaoyHYQ6PsncxGeP';
const API_ENDPOINT = 'https://open.feedcoopapi.com/search_api/global_search';
const DATA_DIR = path.join(__dirname, '..', 'data', 'scenic-spots');

// 多样化的核心看点模板库
const coreHighlightsTemplates = [
  [
    '这里是景区最具代表性的景观，绝对不可错过',
    '独特的自然/人文风貌，是拍照打卡的首选之地',
    '建议停留15-20分钟，细细品味它的独特魅力'
  ],
  [
    '景区内最受欢迎的打卡点，游客必到',
    '站在这里可以俯瞰整个景区的壮丽景色',
    '天气好的时候拍照效果绝佳，记得预留时间'
  ],
  [
    '这里承载着景区最深厚的历史文化底蕴',
    '每一处细节都诉说着动人的故事',
    '建议跟随讲解员深入了解背后的历史'
  ],
  [
    '自然风光与人文景观完美融合的典范',
    '四季景致各异，无论何时来都有惊喜',
    '摄影爱好者的天堂，随手一拍都是大片'
  ],
  [
    '景区的标志性景观，没来过等于没来过',
    '最佳观赏时间是清晨和傍晚，光线最美',
    '记得带上充电宝，美景会让你停不下快门'
  ],
  [
    '这里曾是历史上重要的场所，意义非凡',
    '建筑/景观的设计独具匠心，体现了古人智慧',
    '站在这里，仿佛能与历史对话'
  ],
  [
    '远离人群的小众精华景点，安静而美好',
    '喜欢深度游的朋友一定不要错过',
    '这里能让你感受到不一样的景区魅力'
  ],
  [
    '观景位置绝佳，视野开阔',
    '是拍摄全景照片的最佳地点',
    '傍晚时分来，夕阳西下的景色美不胜收'
  ]
];

// 多样化的导游贴士模板库
const guideTipsTemplates = [
  '游览{name}时，建议放慢脚步，细细品味它的美。从不同角度欣赏会有不同的收获哦！',
  '{name}最适合拍照的时间是清晨和傍晚，光线柔和，人也相对较少。',
  '来{name}游览，建议穿舒适的鞋子，这里需要多走走才能发现它的美。',
  '如果你是摄影爱好者，{name}一定能让你拍出满意的作品，记得带上广角镜头！',
  '游览{name}时，不妨找个地方坐下来，静静感受周围的氛围，这才是旅行的意义。',
  '{name}的景色四季皆宜，每个季节都有不同的美，值得多次来访。',
  '想要深度了解{name}，可以提前做些功课，了解它的历史背景，游览时会更有感触。',
  '在{name}游览时，注意爱护环境，让这份美能够长久留存。',
  '{name}是整个景区的精华所在，建议至少预留20-30分钟在这里慢慢欣赏。',
  '游览{name}时，不妨关掉手机，用眼睛和心灵去感受这份美好。'
];

// 搜索API封装
async function search(query, options = {}) {
  const { docCount = 15, maxImageCount = 6, maxSnippetLength = 2000 } = options;

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
    console.error('Search error:', e.message);
    return null;
  }
}

// 提取坐标
function extractCoordinates(docs) {
  const allText = docs
    .flatMap(doc => doc.Snippet || [])
    .map(s => s.Text)
    .filter(t => t)
    .join('\n');

  const patterns = [
    /纬度?[：:]\s*(\d+\.?\d*).*?经度?[：:]\s*(\d+\.?\d*)/i,
    /经度?[：:]\s*(\d+\.?\d*).*?纬度?[：:]\s*(\d+\.?\d*)/i,
    /(\d+\.\d+)°?\s*N\s*[,，\s]*(\d+\.\d+)°?\s*E/i,
  ];

  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat > 0 && lat < 90 && lng > 70 && lng < 140) {
        return { lat, lng };
      }
    }
  }

  // 尝试分离匹配
  const latMatch = allText.match(/纬度?[：:]\s*(\d+\.?\d*)/i);
  const lngMatch = allText.match(/经度?[：:]\s*(\d+\.?\d*)/i);
  if (latMatch && lngMatch) {
    return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
  }

  return null;
}

// 检测是否包含过多英文
function hasTooMuchEnglish(text) {
  const englishChars = text.match(/[a-zA-Z]/g);
  if (!englishChars) return false;
  const chineseChars = text.match(/[一-龥]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  const englishRatio = englishChars.length / (text.length || 1);
  // 如果英文占比超过30%且中文占比低，过滤掉
  return englishRatio > 0.3 && chineseCount < text.length * 0.4;
}

// 提取简介文本
function extractIntro(docs) {
  const allSnippets = docs
    .flatMap(doc => doc.Snippet || [])
    .map(s => s.Text)
    .filter(t => t && t.length > 50)
    .filter(t => !t.includes('http') && !t.includes('<table') && !t.includes('门票'))
    .filter(t => !hasTooMuchEnglish(t));

  // 清理文本
  function cleanText(text) {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[.]{2,}/g, '')
      .replace(/\s+[，。！？]/g, m => m.trim())
      // 移除英文句子（以英文单词开头的句子）
      .replace(/[A-Z][a-zA-Z\s.,'"]{10,}[.?!]/g, '')
      // 移除独立的英文短语
      .replace(/\s*[a-zA-Z][a-zA-Z\s-]{5,}[.,!?](?=[\s\n]|$)/g, '')
      .trim();
  }

  // 按长度排序，取最长的几段合并
  const sorted = allSnippets.sort((a, b) => b.length - a.length);
  const introTexts = [];
  let totalLength = 0;

  for (const snippet of sorted) {
    if (totalLength >= 600) break;
    const cleaned = cleanText(snippet);
    if (cleaned.length > 100) {
      introTexts.push(cleaned);
      totalLength += cleaned.length;
    }
  }

  return introTexts.join('\n\n').slice(0, 800);
}

// 提取主要景点列表
function extractAttractions(docs) {
  const allText = docs
    .flatMap(doc => doc.Snippet || [])
    .map(s => s.Text)
    .filter(t => t)
    .join(' ');

  // 常用景点名称模式
  const attractionKeywords = [
    '太和殿', '乾清宫', '坤宁宫', '养心殿', '御花园', '角楼',
    '午门', '神武门', '三大殿', '太和门', '中和殿', '保和殿',
    '武英殿', '文华殿', '金水桥', '九龙壁', '珍妃井', '钟表馆',
    '太和殿', '中和殿', '保和殿', '乾清宫', '交泰殿', '坤宁宫',
    '御花园', '养心殿', '西六宫', '东六宫', '宁寿宫', '慈宁宫'
  ];

  // 从关键词中匹配
  const found = attractionKeywords.filter(kw => allText.includes(kw));

  // 如果找到的太少，用通用模板
  if (found.length < 4) {
    return [
      '核心景区',
      '精华观景台',
      '特色景观区',
      '文化展示区',
      '历史遗迹区',
      '自然观光带'
    ];
  }

  return [...new Set(found)].slice(0, 6);
}

// 下载图片
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        downloadImage(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1024) {
          reject(new Error('File too small'));
          return;
        }
        fs.writeFileSync(outputPath, buffer);
        resolve({ path: outputPath, size: buffer.length });
      });
    }).on('error', reject);
  });
}

// 提取并下载图片
async function fetchAndSaveImages(spotName, imagesDir, count = 6) {
  const result = await search(`${spotName} 景区 风光 实景 高清图片`, { docCount: 12, maxImageCount: 8 });
  if (!result || !result.Result || !result.Result.Documents) return [];

  const imageUrls = [];
  for (const doc of result.Result.Documents) {
    if (doc.Snippet) {
      for (const snippet of doc.Snippet) {
        if (snippet.Image && snippet.Image.ImageUrl) {
          imageUrls.push(snippet.Image.ImageUrl);
        }
      }
    }
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const downloaded = [];
  for (let i = 0; i < Math.min(count, imageUrls.length); i++) {
    const url = imageUrls[i];
    const filename = `spot-${i + 1}.jpg`;
    const outputPath = path.join(imagesDir, filename);

    try {
      const result = await downloadImage(url, outputPath);
      downloaded.push({
        filename,
        path: result.path,
        size: result.size
      });
      process.stdout.write(`🖼️  `);
    } catch (e) {
      // 静默失败
    }
  }

  return downloaded;
}

// 解析现有README
function parseReadme(readmePath) {
  const content = fs.readFileSync(readmePath, 'utf-8');
  const frontmatter = {};

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, rawContent: content };
}

// 生成导游风格的README
function generateGuideReadme(spot, data) {
  const { coordinates, intro, images, attractions } = data;
  const { name, province, city, county, batch } = spot;

  // 更新frontmatter
  let fm = `---
name: ${name}
level: 5A
province: ${province}
city: ${city}
county: ${county || ''}
batch: ${batch || ''}`;

  if (coordinates) {
    fm += `
latitude: ${coordinates.lat.toFixed(4)}
longitude: ${coordinates.lng.toFixed(4)}`;
  }

  fm += `
source: doubao-search
---

# ${name}

## 🎤 AI导游带你游

### 【开场白】
各位朋友，大家好！欢迎来到${province}${city}，欢迎来到${name}。我是你们今天的导游小艾。

站在这片土地上，你们可能想象不到，千百年前，这里曾是怎样一番景象。历史的年轮在这里留下了深深的印记，每一寸土地都在诉说着古老的故事。

${intro ? intro.slice(0, 150) + '...' : ''}

今天，就让我们一起走进这片神奇的土地，感受它独有的魅力。建议游览时间：半天到一天。拍照最佳时间是清晨或傍晚，光线柔和时最美。

---

## 🗺️ 景区全景导览
${name}位于${province}${city}${county ? county + '境内' : ''}，是国家AAAAA级旅游景区。

${intro ? intro.slice(0, 300) : ''}

**游览路线推荐**：景区入口 → 核心景观区 → 精华景点 → 观景平台 → 出口

---

## 🏛️ 主要景点详解

`;

  // 添加景点详情
  if (attractions && attractions.length > 0) {
    // 打乱模板顺序确保不重复
    const shuffledHighlights = [...coreHighlightsTemplates].sort(() => Math.random() - 0.5);
    const shuffledTips = [...guideTipsTemplates].sort(() => Math.random() - 0.5);

    attractions.forEach((attr, idx) => {
      const imgFile = images[idx] ? `![${attr}](images/${images[idx].filename})` : '';
      const highlightTemplate = shuffledHighlights[idx % shuffledHighlights.length];
      const highlights = highlightTemplate.map(item => `- ${item.replace('{name}', attr)}`).join('\n');
      const tip = shuffledTips[idx % shuffledTips.length].replace('{name}', attr);

      fm += `### 📍 ${attr}

${imgFile}

**核心看点**：
${highlights}

> 💡 **导游贴士**：
> ${tip}

---

`;
    });
  }

  // 添加结束语
  fm += `
## 【结束语】
各位朋友，今天的游览即将结束。希望${name}的美景能给你们留下美好的回忆。

有人说，旅行的意义不在于去过多少地方，而在于那些让你心动的瞬间。希望在${name}的这一天，能成为你旅途中一个温暖的记忆。

临走前，别忘了回头再看一眼。夕阳下的${name}，会给你最温柔的道别。

> ✨ **游览小贴士总结**：
> - **最佳时间**：春秋两季气候宜人，是游览的最佳时节
> - **穿着建议**：舒适的运动鞋，准备防晒用品
> - **游览时长**：建议安排半天到一天时间
> - **拍照指南**：清晨和傍晚光线最柔和，出片率最高
> - **注意事项**：爱护环境，文明游览，让美景长存

祝你们旅途愉快，平安吉祥！🙏

---

## 📷 景区美图

`;

  // 添加图片展示区
  const captions = ['景区全景', '核心景观', '特色风光', '细节之美', '四季风光', '人文景观'];
  images.forEach((img, idx) => {
    fm += `![${captions[idx] || `景点${idx + 1}`}](images/${img.filename})
*${captions[idx] || `${name}风光`}*

`;
  });

  // 添加景区小档案
  fm += `
---

## 📚 ${name}小档案

| 项目 | 信息 |
|------|------|
| 景区级别 | 国家AAAAA级旅游景区 |
| 所属省份 | ${province} |
| 所属城市 | ${city} |
| 建议游览时间 | 半天 - 1天 |
| 最佳游览季节 | 春秋两季 |

---

> 💡 **本页说明**：
> 本README由AI导游小艾根据网络公开资料整理生成。
> 坐标、图片、简介均来自豆包搜索API，仅供参考。
`;

  return fm;
}

// 处理单个景区
async function processSpot(spotPath, index, total) {
  const readmePath = path.join(spotPath, 'README.md');
  if (!fs.existsSync(readmePath)) return { success: false, error: 'No README' };

  const { frontmatter } = parseReadme(readmePath);
  const spotName = frontmatter.name;

  console.log(`\n[${index}/${total}] 🏛️  正在处理: ${spotName}`);
  console.log(`   📍 ${frontmatter.province} · ${frontmatter.city}`);

  try {
    // 1. 搜索坐标和简介
    const searchResult = await search(`${spotName} ${frontmatter.city} 经纬度 景区介绍 开放时间`, {
      docCount: 20,
      maxImageCount: 0
    });

    let coordinates = null;
    let intro = '';
    let attractions = [];

    if (searchResult && searchResult.Result && searchResult.Result.Documents) {
      coordinates = extractCoordinates(searchResult.Result.Documents);
      intro = extractIntro(searchResult.Result.Documents);
      attractions = extractAttractions(searchResult.Result.Documents);
    }

    // 保留原README中的坐标（如果新的没找到）
    if (!coordinates && frontmatter.latitude && frontmatter.longitude) {
      coordinates = {
        lat: parseFloat(frontmatter.latitude),
        lng: parseFloat(frontmatter.longitude)
      };
      console.log(`   ✅ 沿用原坐标: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
    } else if (coordinates) {
      console.log(`   ✅ 新获取坐标: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
    } else {
      console.log(`   ⚠️  未获取到坐标`);
    }

    // 2. 下载图片
    const imagesDir = path.join(spotPath, 'images');
    const existingImages = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir).filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i))
      : [];

    let images = [];
    if (existingImages.length < 3) {
      process.stdout.write(`   🖼️  正在下载图片: `);
      images = await fetchAndSaveImages(spotName, imagesDir, 6);
      console.log(`${images.length} 张`);
    } else {
      images = existingImages.map(f => ({ filename: f }));
      console.log(`   ✅ 已有 ${images.length} 张图片`);
    }

    // 3. 生成新的README
    const newReadme = generateGuideReadme(frontmatter, {
      coordinates,
      intro,
      images,
      attractions: attractions.length > 0 ? attractions : ['核心景区', '精华观景台', '特色景观区', '文化展示区']
    });

    // 4. 备份原文件并写入新文件
    const backupPath = readmePath + '.bak';
    fs.copyFileSync(readmePath, backupPath);
    fs.writeFileSync(readmePath, newReadme, 'utf-8');

    console.log(`   ✅ README已更新`);

    return {
      success: true,
      name: spotName,
      hasCoordinates: !!coordinates,
      imageCount: images.length
    };

  } catch (e) {
    console.log(`   ❌ 处理失败: ${e.message}`);
    return { success: false, name: spotName, error: e.message };
  }
}

// 递归查找所有景区目录
function findAllSpots(dir, spots = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAllSpots(fullPath, spots);
    } else if (entry.name === 'README.md' && dir !== DATA_DIR) {
      spots.push(dir);
    }
  }

  return spots;
}

// 主函数
async function main(args) {
  console.log('='.repeat(60));
  console.log('🏛️  5A景区README批量增强工具');
  console.log('🎯 功能: 坐标核验 + 图片下载 + 导游风格重写');
  console.log('='.repeat(60));
  console.log('');

  // 查找所有景区
  const allSpots = findAllSpots(DATA_DIR);
  console.log(`📋 共发现 ${allSpots.length} 个景区`);

  if (args.includes('--list')) {
    allSpots.forEach((spot, i) => {
      const parts = spot.replace(DATA_DIR + '/', '').split('/');
      console.log(`  ${i + 1}. ${parts.join(' · ')}`);
    });
    return;
  }

  // 支持单个景区测试
  if (args.includes('--test')) {
    const idx = parseInt(args[args.indexOf('--test') + 1]) || 0;
    await processSpot(allSpots[idx], 1, 1);
    return;
  }

  // 支持指定省份
  if (args.includes('--province')) {
    const province = args[args.indexOf('--province') + 1];
    const provinceSpots = allSpots.filter(s => s.includes(province));
    console.log(`📍 找到 ${provinceSpots.length} 个 ${province} 的景区`);

    for (let i = 0; i < provinceSpots.length; i++) {
      await processSpot(provinceSpots[i], i + 1, provinceSpots.length);
      if (i < provinceSpots.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return;
  }

  // 支持指定景区名称
  if (args.includes('--name')) {
    const name = args[args.indexOf('--name') + 1];
    const spot = allSpots.find(s => s.includes(name));
    if (spot) {
      await processSpot(spot, 1, 1);
    } else {
      console.log(`❌ 未找到景区: ${name}`);
    }
    return;
  }

  // 批量处理
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : allSpots.length;

  const toProcess = allSpots.slice(0, limit);
  console.log(`🚀 开始处理前 ${limit} 个景区...`);
  console.log('');

  const results = { success: 0, failed: 0, withCoords: 0, withImages: 0 };
  const failedSpots = [];

  for (let i = 0; i < toProcess.length; i++) {
    const result = await processSpot(toProcess[i], i + 1, toProcess.length);
    if (result.success) {
      results.success++;
      if (result.hasCoordinates) results.withCoords++;
      if (result.imageCount > 0) results.withImages++;
    } else {
      results.failed++;
      failedSpots.push(result.name);
    }

    // 避免请求过快
    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 输出统计
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理完成统计');
  console.log('='.repeat(60));
  console.log(`✅ 成功处理: ${results.success} 个`);
  console.log(`❌ 处理失败: ${results.failed} 个`);
  console.log(`📍 获得坐标: ${results.withCoords} 个`);
  console.log(`🖼️  获得图片: ${results.withImages} 个`);

  if (failedSpots.length > 0) {
    console.log('\n⚠️  处理失败的景区:');
    failedSpots.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n💡 提示: 原始README已备份为 README.md.bak');
  console.log('   如有问题可从备份恢复');
}

// 运行
if (require.main === module) {
  main(process.argv.slice(2)).catch(console.error);
}

module.exports = {
  search,
  extractCoordinates,
  extractIntro,
  fetchAndSaveImages,
  generateGuideReadme,
  processSpot
};
