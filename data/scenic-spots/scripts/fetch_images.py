#!/usr/bin/env python3
"""
Extract CC-licensed images from Wikipedia pages and write URLs to README.
Images are NOT downloaded, only referenced by URL.

Usage: python3 fetch_images.py --name "云冈石窟" --province "山西省"
Usage: python3 fetch_images.py --all --delay 1.5
"""
from urllib.request import Request, urlopen
from urllib.parse import quote, unquote
from pathlib import Path
import re
import argparse
import csv
import time

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "5a-scenic-spots.csv"


def get_wikipedia_page(name: str) -> str | None:
    clean_name = re.sub(r'（.*?）|旅游区|景区|风景名胜区|风景区|博物馆|旅游景区', '', name).strip()
    clean_name = clean_name or name
    url = f"https://zh.wikipedia.org/wiki/{quote(clean_name)}"
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urlopen(req, timeout=20)
        if resp.status != 200:
            return None
        return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def extract_image_filenames(html: str) -> list[str]:
    """Extract unique image filenames from the page, filtered by relevance."""
    # Find all File:xxx.jpg links
    file_links = re.findall(r'href="/wiki/File:([^"]+\.(?:jpg|jpeg|png|webp))"', html, re.I)

    # Find actual img src URLs from the page content (gallery, infobox)
    img_srcs = re.findall(r'<img[^>]+src="(//upload\.wikimedia\.org/[^"]+)"', html)

    seen = set()
    results = []

    # Priority: actual displayed images first
    for src in img_srcs:
        if "svg" in src.lower():
            continue
        filename = unquote(src.split("/")[-1].split("?")[0])
        if filename and filename not in seen and len(filename) > 10:
            seen.add(filename)
            results.append(src)

    # Then other file links, filtered
    for filename in file_links:
        if filename.lower().endswith(".svg"):
            continue
        if any(x in filename.lower() for x in ["logo", "icon", "map", "地图", "旗", "flag", "blank"]):
            continue
        if filename not in seen:
            seen.add(filename)
            results.append(f"//upload.wikimedia.org/wikipedia/commons/File:{filename}")

    return results[:12]


def get_commons_direct_url(file_path: str) -> str:
    """Convert Wikipedia File: path to a direct viewable URL."""
    if file_path.startswith("//"):
        # Already a direct src URL
        return "https:" + file_path
    return f"https://commons.wikimedia.org/wiki/File:{file_path}"


def update_readme(spot_path: Path, images: list[str]):
    readme = spot_path / "README.md"
    if not readme.exists():
        return

    content = readme.read_text(encoding="utf-8")

    # Skip if already has Wikimedia images
    if "https://upload.wikimedia.org" in content:
        return

    new_imgs = "\n".join(f"![]({get_commons_direct_url(img)})" for img in images[:6])
    if not new_imgs:
        return

    # Replace placeholder if exists
    old_marker = "![景点配图](./image-placeholder.jpg)"
    if old_marker in content:
        content = content.replace(old_marker, new_imgs)
    else:
        # Insert after "景区内主要景点" header
        content = content.replace(
            "## 景区内主要景点\n\n",
            f"## 景区内主要景点\n\n{new_imgs}\n\n"
        )

    readme.write_text(content, encoding="utf-8")


def find_spot_path(name: str, province: str) -> Path | None:
    # First try exact match
    for path in BASE_DIR.rglob(f"*/{name}/README.md"):
        parts = path.parts
        if province in parts:
            return path.parent
    # Try relaxed match (strip common suffixes)
    import re
    simplified = re.sub(r'（.*?）|旅游区|景区|风景名胜区|风景区|博物馆|旅游景区|风景区|公园', '', name).strip()
    if simplified and simplified != name:
        for path in BASE_DIR.rglob("*/README.md"):
            if 'scripts' in str(path):
                continue
            spot_name = path.parent.name
            if simplified in spot_name and province in path.parts:
                return path.parent
    return None


def process_spot(province: str, name: str):
    spot_path = find_spot_path(name, province)
    if not spot_path:
        print(f"  [skip] directory not found")
        return

    html = get_wikipedia_page(name)
    if not html:
        print(f"  [skip] no Wikipedia page found")
        return

    images = extract_image_filenames(html)
    if images:
        update_readme(spot_path, images)
        print(f"  [ok] {len(images)} images added")
    else:
        print(f"  [no images]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="")
    parser.add_argument("--province", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--delay", type=float, default=1.5)
    args = parser.parse_args()

    if args.all:
        spots = []
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                spots.append((row["省级行政区"], row["景区名称"]))

        print(f"Processing {len(spots)} spots...")
        for idx, (province, name) in enumerate(spots, 1):
            print(f"[{idx}/{len(spots)}] {name}")
            process_spot(province, name)
            if args.delay > 0:
                time.sleep(args.delay)
    elif args.name:
        process_spot(args.province, args.name)
    else:
        parser.print_help()

    print("\nDone")
