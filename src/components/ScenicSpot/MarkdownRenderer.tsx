'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  spotPath?: string; // 景区路径，用于解析本地图片
}

/**
 * 轻量级 Markdown 到 React 组件的转换器
 * 专门为景区 README 格式优化
 */
export default function MarkdownRenderer({ content, className = '', spotPath }: MarkdownRendererProps) {
  if (!content) return null;

  // 按段落分割处理
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) {
      i++;
      continue;
    }

    // 分割线 ---
    if (trimmedLine === '---') {
      elements.push(<hr key={key++} className="scenic-hr" />);
      i++;
      continue;
    }

    // H1 标题
    if (trimmedLine.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="scenic-h1">
          {trimmedLine.slice(2).trim()}
        </h1>
      );
      i++;
      continue;
    }

    // H2 标题 (包含 emoji)
    if (trimmedLine.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="scenic-h2">
          {trimmedLine.slice(3).trim()}
        </h2>
      );
      i++;
      continue;
    }

    // H3 标题 (包含 emoji)
    if (trimmedLine.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="scenic-h3">
          {trimmedLine.slice(4).trim()}
        </h3>
      );
      i++;
      continue;
    }

    // 图片: ![alt](url) - 更宽松的匹配
    const imgMatch = trimmedLine.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      const [, alt, url] = imgMatch;

      // 处理本地图片路径，转换为API路径
      let imageSrc = url;
      if (!url.startsWith('http') && !url.startsWith('/api/') && spotPath) {
        // 相对路径: images/spot-1.jpg -> /api/scenic-images?path=xxx/images/spot-1.jpg
        const filename = url.replace('images/', '').replace('./', '');
        imageSrc = `/api/scenic-images?path=${encodeURIComponent(`${spotPath}/images/${filename}`)}`;
      }

      elements.push(
        <figure key={key++} className="scenic-figure">
          <img
            src={imageSrc}
            alt={alt || '景区图片'}
            className="scenic-image"
            loading="lazy"
          />
          {alt && (
            <figcaption className="scenic-caption">
              {alt}
            </figcaption>
          )}
        </figure>
      );
      i++;
      continue;
    }

    // 引用块 >
    if (trimmedLine.startsWith('>')) {
      let quoteContent = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const lineContent = lines[i].trim().slice(1).trim();
        quoteContent += lineContent + ' ';
        i++;
      }
      // 检查是否是提示框
      const isTip = quoteContent.includes('贴士') || quoteContent.includes('提示') || quoteContent.includes('建议');
      elements.push(
        <div key={key++} className={`scenic-quote ${isTip ? 'scenic-tip' : ''}`}>
          {quoteContent.trim().replace(/\*\*/g, '')}
        </div>
      );
      continue;
    }

    // 列表项 - (处理中文破折号)
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('— ')) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('— ')) {
          listItems.push(trimmed.slice(2).trim());
          i++;
        } else if (trimmed) {
          break;
        } else {
          i++;
        }
      }
      if (listItems.length > 0) {
        elements.push(
          <ul key={key++} className="scenic-list">
            {listItems.map((item, idx) => (
              <li key={idx} className="scenic-list-item">{item}</li>
            ))}
          </ul>
        );
      }
      continue;
    }

    // 表格行
    if (trimmedLine.includes('|') && trimmedLine.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(
        <table key={key++} className="scenic-table">
          <tbody>
            {tableLines.slice(0, -1).filter((_, idx) => idx !== 1).map((tableLine, idx) => {
              const cells = tableLine.split('|').filter(c => c.trim());
              return (
                <tr key={idx}>
                  {cells.map((cell, cellIdx) => (
                    idx === 0 ? (
                      <th key={cellIdx}>{cell.trim()}</th>
                    ) : (
                      <td key={cellIdx}>{cell.trim()}</td>
                    )
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
      continue;
    }

    // 粗体文本 **text**
    if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      elements.push(
        <p key={key++} className="scenic-paragraph">
          <strong>{trimmedLine.slice(2, -2)}</strong>
        </p>
      );
      i++;
      continue;
    }

    // 普通段落 - 收集连续的非空行（排除markdown标记）
    let paragraph = '';
    while (i < lines.length && lines[i].trim()) {
      const currentTrimmed = lines[i].trim();
      // 排除markdown标记
      if (currentTrimmed.match(/^[#>|-]/) || currentTrimmed.includes('![')) {
        break;
      }
      paragraph += lines[i] + ' ';
      i++;
    }
    if (paragraph.trim()) {
      // 移除粗体标记
      const cleanParagraph = paragraph.trim().replace(/\*\*/g, '');
      elements.push(
        <p key={key++} className="scenic-paragraph">
          {cleanParagraph}
        </p>
      );
      continue;
    }

    i++;
  }

  return <div className={`scenic-markdown ${className}`}>{elements}</div>;
}
