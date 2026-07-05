#!/usr/bin/env python3
"""
Fetch 5A scenic spot summaries and image URLs from Baidu Baike.
Usage: python3 fetch_baike.py --name "云冈石窟" --province "山西省"
"""
from urllib.request import Request, urlopen
from urllib.parse import quote, unquote
from pathlib import Path
import re
import json
import argparse
import time

BASE_DIR = Path(__file__).parent.parent


def fetch_baike_page(name: str) -> str | None:
    clean_name = re.sub(r'（.*?）|旅游区|景区|风景名胜区|风景区|博物馆', '', name).strip()
    clean_name = clean_name or name
    search_url = f"https://baike.baidu.com/search?word={quote(clean_name)}"
    try:
        req = Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
        html = urlopen(req, timeout=20).read().decode("utf-8")
        match = re.search(r'<a[^>]+href="(/item/[^"]+)"[^>]*>', html)
        if not match:
            return None
        item_path = unquote(match.group(1))
        item_path = item_path.split("#")[0]
    except Exception as e:
        print(f"[baike search] {name} error: {e}")
        return None

    page_url = f"https://baike.baidu.com{item_path}"
    try:
        req = Request(page_url, headers={"User-Agent": "Mozilla/5.0"})
        html = urlopen(req, timeout=20).read().decode("utf-8")
        return _extract_baike_content(html, page_url)
    except Exception as e:
        print(f"[baike page] {page_url} error: {e}")
        return None


def _extract_baike_content(html: str, source_url: str) -> str:
    summary = ""
    lemma_summary = html.find('class="J-lemma-summary lemma-summary"')
    if lemma_summary == -1:
        lemma_summary = html.find('class="lemma-summary"')
    if lemma_summary != -1:
        end = html.find("</div>", lemma_summary + 50)
        if end != -1:
            raw = html[lemma_summary:end]
            raw = re.sub(r"<sup[^>]*>.*?</sup>", "", raw, flags=re.S)
            raw = re.sub(r"<[^>]+>", "", raw)
            raw = re.sub(r"\[[\d\s]+\]", "", raw)
            raw = re.sub(r"&#160;", " ", raw)
            raw = re.sub(r"\n{2,}", "\n", raw).strip()
            if len(raw) > 100:
                summary = raw

    images = []
    for m in re.finditer(r'<img[^>]+data-src="(https?://[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*data-sign="[^"]*"', html):
        src = m.group(1)
        if src not in images and len(images) < 6:
            images.append(src)

    sections = {}
    for heading in re.finditer(r'<span class="title-prefix J-rect-title"[^>]*>([^<]+)</span>|<a[^>]+name="([^"]+)"[^>]*>|<div[^>]+class="para-title level-2"[^>]*><h2[^>]*>(.+?)</h2>', html):
        title = heading.group(1) or heading.group(2) or heading.group(3)
        if not title:
            continue
        title = re.sub(r"<[^>]+>", "", title).strip()
        if not title:
            continue
        start = heading.end()
        next_h = html.find('class="para-title level-2"', start)
        if next_h == -1:
            next_h = html.find('class="catalog-list"', start)
        if next_h == -1:
            next_h = start + 8000
        block = html[start:next_h]
        paras = re.findall(r'<div[^>]+class="para"[^>]*>(.*?)</div>', block, flags=re.S)
        text = "".join(re.sub(r"<[^>]+>", "", p) for p in paras)
        text = re.sub(r"\[[\d\s]+\]", "", text)
        text = re.sub(r"&#160;", " ", text).strip()
        if len(text) > 120:
            sections[title] = text

    return json.dumps({"summary": summary, "sections": sections, "images": images, "source": source_url}, ensure_ascii=False)


def update_readme(spot_path: Path, baike_json: str):
    data = json.loads(baike_json)
    readme = spot_path / "README.md"
    if not readme.exists():
        print(f"[skip] {spot_path} README not found")
        return

    content = readme.read_text(encoding="utf-8")

    summary = data.get("summary", "").strip()
    if summary and "待补充" in content.split("## 景区概览\n")[1].split("\n##")[0]:
        content = re.sub(
            r"(## 景区概览\n\n)[^\n#]*",
            rf"\1{summary}\n",
            content,
            flags=re.S,
        )

    sections = data.get("sections", {})
    items = []
    for name, text in sections.items():
        if any(kw in name for kw in ["景点", "景观", "游览", "景区", "主要", "介绍", "概况"]):
            items.append((name, text))
    if items:
        built = []
        for name, text in items[:4]:
            built.append(f"### {name}\n\n{text}\n")
        if built:
            target = "## 景区内主要景点\n\n### 景点一\n\n待补充景点介绍。\n\n![景点配图](./image-placeholder.jpg)\n\n### 景点二\n\n待补充景点介绍。"
            if target in content:
                content = content.replace(target, "## 景区内主要景点\n\n" + "\n".join(built))

    images = data.get("images", [])
    if images:
        md_images = []
        for idx, url in enumerate(images[:4], 1):
            md_images.append(f"![景点配图{idx}]({url})")
        if md_images:
            existing = "![景点配图](./image-placeholder.jpg)"
            if existing in content:
                content = content.replace(existing, "\n".join(md_images))
            else:
                before = content.find("## 游览建议")
                if before != -1:
                    content = content[:before] + "\n".join(md_images) + "\n\n" + content[before:]

    source = data.get("source", "")
    if source:
        if "source: https://zh.wikipedia.org" in content:
            content = re.sub(r"source: (https://zh.wikipedia.org[^\n]+)", rf"source_wikipedia: \1\nsource_baike: {source}", content)
        else:
            content = re.sub(r"source: .*", f"source: {source}", content)

    readme.write_text(content, encoding="utf-8")
    print(f"[updated] {readme} images={len(images)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--province", default="")
    parser.add_argument("--delay", type=float, default=0.8)
    args = parser.parse_args()

    spot_dirs = list(BASE_DIR.rglob(f"*/{args.name}/README.md"))
    if args.province:
        spot_dirs = [p for p in spot_dirs if args.province in str(p)]

    if not spot_dirs:
        print(f"[error] no directory found for {args.name} in {args.province}")
        raise SystemExit(1)

    result = fetch_baike_page(args.name)
    if result:
        update_readme(spot_dirs[0].parent, result)
    else:
        print(f"[skip] no baike data for {args.name}")

    if args.delay > 0:
        time.sleep(args.delay)
