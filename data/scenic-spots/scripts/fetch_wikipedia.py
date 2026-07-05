#!/usr/bin/env python3
"""
Fetch 5A scenic spot summaries from Wikipedia.
Usage: python3 fetch_wikipedia.py --name "云冈石窟" --province "山西省"
"""
from urllib.request import Request, urlopen
from urllib.parse import quote
from pathlib import Path
import re
import json
import argparse

BASE_DIR = Path(__file__).parent.parent


def fetch_wikipedia_page(name: str) -> str | None:
    clean_name = re.sub(r'（.*?）|旅游区|景区|风景名胜区|风景区|博物馆', '', name).strip()
    clean_name = clean_name or name
    search_url = f"https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote(clean_name)}&srlimit=5&format=json"
    try:
        req = Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
        resp = json.loads(urlopen(req, timeout=20).read().decode("utf-8"))
        results = resp.get("query", {}).get("search", [])
        if not results:
            return None
        page_title = None
        for r in results:
            t = r["title"]
            if "管理委员会" in t or "管理局" in t or "管理处" in t:
                continue
            if "旅游" in t and "景区" not in t and "风景" not in t:
                continue
            page_title = t
            break
        if not page_title:
            page_title = results[0]["title"]
    except Exception as e:
        print(f"[wiki search] {name} clean={clean_name} error: {e}")
        return None

    page_url = f"https://zh.wikipedia.org/wiki/{quote(page_title)}"
    try:
        req = Request(page_url, headers={"User-Agent": "Mozilla/5.0"})
        html = urlopen(req, timeout=20).read().decode("utf-8")
        return _extract_wiki_summary(html, page_url)
    except Exception as e:
        print(f"[wiki page] {page_title} error: {e}")
        return None


def _extract_wiki_summary(html: str, source_url: str) -> str:
    summary = ""
    m = re.search(r'<div[^>]+class="mw-parser-output"[^>]*>(.*?)(<h2|<div id="toc")', html, re.S)
    if m:
        raw = m.group(1)
        # Remove infobox and banners first
        raw = re.sub(r'<table[^>]+class="[^"]*infobox[^"]*"[^>]*>.*?</table>', "", raw, flags=re.S | re.I)
        raw = re.sub(r'<div[^>]+class="[^"]*mbox[^"]*"[^>]*>.*?</div>', "", raw, flags=re.S | re.I)
        raw = re.sub(r'<style[^>]*>.*?</style>', "", raw, flags=re.S | re.I)
        raw = re.sub(r'<div[^>]+class="mw-kartographer-map[^"]*"[^>]*>.*?</div>', "", raw, flags=re.S | re.I)
        raw = re.sub(r"<sup[^>]*>.*?</sup>", "", raw, flags=re.S)
        raw = re.sub(r"<[^>]+>", "", raw)
        raw = re.sub(r"\[[\d\s]+\]", "", raw)
        raw = re.sub(r"&#160;", " ", raw)
        raw = re.sub(r"&#xfeff;", "", raw)
        raw = re.sub(r"\s+", " ", raw).strip()
        summary = raw[:2000]

    sections = {}
    for heading, title, content in re.findall(
        r'<span class="mw-headline" id="([^"]+)">([^<]+)</span>.*?</h[23]>(.*?)(?=<h[23]|<div id="cat|$)',
        html,
        re.S,
    ):
        text = re.sub(r"<sup[^>]*>.*?</sup>", "", content, flags=re.S)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\[[\d\s]+\]", "", text)
        text = re.sub(r"\n{2,}", "\n", text).strip()
        if len(text) > 100:
            sections[title] = text

    return json.dumps({"summary": summary, "sections": sections, "source": source_url}, ensure_ascii=False)


def update_readme(spot_path: Path, wiki_json: str):
    data = json.loads(wiki_json)
    readme = spot_path / "README.md"
    if not readme.exists():
        print(f"[skip] {spot_path} README not found")
        return

    content = readme.read_text(encoding="utf-8")
    summary = data.get("summary", "").strip()
    if summary:
        content = content.replace("## 景区概览\n\n待补充。", f"## 景区概览\n\n{summary}")

    sections = data.get("sections", {})
    attractions = []
    for k, v in sections.items():
        if any(kw in k for kw in ["景点", "景区", "主要", "游览", "景观", "景观区"]):
            attractions.append((k, v))
    if attractions:
        built = []
        for name, text in attractions[:3]:
            built.append(f"### {name}\n\n{text}\n")
        if built:
            content = content.replace(
                "## 景区内主要景点\n\n### 景点一\n\n待补充景点介绍。\n\n![景点配图](./image-placeholder.jpg)\n\n### 景点二\n\n待补充景点介绍。",
                "## 景区内主要景点\n\n" + "\n".join(built),
            )

    source = data.get("source", "")
    if source:
        content = re.sub(r"source: .*", f"source: {source}", content)

    readme.write_text(content, encoding="utf-8")
    print(f"[updated] {readme}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--province", default="")
    args = parser.parse_args()

    spot_dirs = list(BASE_DIR.rglob(f"*/{args.name}/README.md"))
    if args.province:
        spot_dirs = [p for p in spot_dirs if args.province in str(p)]

    if not spot_dirs:
        print(f"[error] no directory found for {args.name} in {args.province}")
        raise SystemExit(1)

    result = fetch_wikipedia_page(args.name)
    if result:
        update_readme(spot_dirs[0].parent, result)
    else:
        print(f"[skip] no data for {args.name}")
