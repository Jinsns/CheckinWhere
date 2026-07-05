#!/usr/bin/env python3
"""
Fetch scenic spot images using Bing Image Search.
More reliable than Xiaohongshu, less anti-scraping.

Usage: python3 bing_images.py --name "天下第一泉景区" --province "山东省"
Usage: python3 bing_images.py --all --limit 50
"""
from urllib.request import Request, urlopen
from urllib.parse import quote
from pathlib import Path
import argparse
import csv
import time
import re
import json

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "5a-scenic-spots.csv"


def find_spot_path(name: str, province: str) -> Path | None:
    """Find the directory path for a scenic spot."""
    for path in BASE_DIR.rglob(f"*/{name}/README.md"):
        parts = path.parts
        if province in parts:
            return path.parent
    # Relaxed match
    for path in BASE_DIR.rglob("*/README.md"):
        if "scripts" in str(path):
            continue
        spot_name = path.parent.name
        if name[:5] in spot_name and province in path.parts:
            return path.parent
    return None


def has_enough_images(spot_path: Path) -> bool:
    """Check if spot already has enough images."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False
    content = readme.read_text(encoding="utf-8")
    img_pattern = r"!\[[^\]]*\]\([^)]+\)"
    images = re.findall(img_pattern, content)
    return len(images) >= 4


def search_bing_images(keyword: str, max_images: int = 6) -> list[dict]:
    """Search Bing Images for scenic spot photos."""
    images = []
    seen_urls = set()

    search_url = (
        f"https://www.bing.com/images/async?q={quote(keyword + ' 风景 照片')}"
        f"&first=0&count=35&adlt=off&qft=+filterui:photo-photo"
    )

    try:
        req = Request(search_url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.bing.com/images"
        })
        resp = urlopen(req, timeout=20)
        html = resp.read().decode("utf-8", errors="ignore")

        # Extract murl values (Bing's image URL marker)
        murl_pattern = r'"murl":"(https?://[^"]+?\.(?:jpg|jpeg|png))"'
        matches = re.findall(murl_pattern, html, re.I)

        # Clean up escaped slashes
        matches = [m.replace("\\/", "/") for m in matches]

        # Also try turl pattern (thumbnail with original URL in context)
        if len(matches) < max_images:
            turl_pattern = r'thumbnailUrl":"(https?://[^"]+?\.(?:jpg|jpeg|png))'
            tmatches = re.findall(turl_pattern, html, re.I)
            matches.extend([m.replace("\\/", "/") for m in tmatches])

        for url in matches:
            if len(images) >= max_images:
                break

            url = url.replace("\\/", "/")
            if url in seen_urls:
                continue

            # Filter out Bing icons, logos, etc.
            if any(x in url.lower() for x in ["bing", "microsoft", "favicon", "logo", "icon"]):
                continue
            if "bp.blogspot.com" in url or "gravatar" in url:
                continue

            seen_urls.add(url)
            images.append({
                "url": url,
                "title": keyword,
                "source": "Bing Images"
            })

    except Exception as e:
        print(f"  Search error: {e}")

    return images[:max_images]


def download_image(url: str, save_path: Path) -> bool:
    """Download an image from URL."""
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://www.bing.com/"
        })
        with urlopen(req, timeout=30) as resp:
            content = resp.read()
            # Skip tiny images (< 2KB)
            if len(content) < 2048:
                return False
            save_path.write_bytes(content)
        return True
    except Exception as e:
        return False


def update_readme_with_local_images(spot_path: Path, images: list[dict]):
    """Download images locally and add to README."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False

    content = readme.read_text(encoding="utf-8")

    # Build image section
    img_section = "## 景区内主要景点\n\n"
    success_count = 0

    for idx, img in enumerate(images, 1):
        # Get file extension
        ext = Path(img['url']).suffix.lower()
        if not ext or ext not in ['.jpg', '.jpeg', '.png']:
            ext = '.jpg'

        img_filename = f"photo_{idx:02d}{ext}"
        img_path = spot_path / img_filename

        if download_image(img['url'], img_path):
            success_count += 1
            img_section += f"![{img['title'][:50]}]({img_filename})\n"
            img_section += f"**图 {idx}**: {img['title']} 风光\n"
            img_section += f"来源：{img['source']}\n\n"
        else:
            # Fallback to direct URL
            img_section += f"![]({img['url']})\n\n"

        time.sleep(0.3)

    # Replace or insert section
    if "## 景区内主要景点\n\n" in content:
        content = content.replace("## 景区内主要景点\n\n", img_section)
    elif "## 景区内主要景点" in content:
        old_section_start = content.find("## 景区内主要景点")
        next_section = content.find("\n## ", old_section_start + 10)
        if next_section != -1:
            content = content[:old_section_start] + img_section + content[next_section:]
        else:
            content = content[:old_section_start] + img_section
    else:
        if "## 游览建议" in content:
            content = content.replace("## 游览建议", img_section + "## 游览建议")

    readme.write_text(content, encoding="utf-8")
    return success_count > 0


def process_spot(province: str, name: str, max_images: int = 4) -> dict:
    """Process a single scenic spot."""
    result = {"name": name, "province": province, "images_fetched": 0}

    spot_path = find_spot_path(name, province)
    if not spot_path:
        result["error"] = "path not found"
        return result

    if has_enough_images(spot_path):
        result["skipped"] = "already has enough images"
        return result

    # Clean up search term
    search_term = re.sub(r"（.*?）|景区|旅游区|风景名胜区|风景区|公园|景区", "", name).strip()
    if province not in search_term:
        search_term = f"{province.replace('省', '').replace('市', '')} {search_term}"

    print(f"  Searching: {search_term}")
    images = search_bing_images(search_term, max_images)
    print(f"  Found {len(images)} images")

    if images:
        update_readme_with_local_images(spot_path, images)
        result["images_fetched"] = len(images)

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="")
    parser.add_argument("--province", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--max-images", type=int, default=4)
    parser.add_argument("--limit", type=int, default=200, help="Max spots to process")
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()

    if args.name:
        result = process_spot(args.province, args.name, args.max_images)
        print(result)
    elif args.all:
        spots = []
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                spots.append((row["省级行政区"], row["景区名称"]))

        # Filter to spots without images
        spots_without_images = []
        for province, name in spots:
            path = find_spot_path(name, province)
            if path and not has_enough_images(path):
                spots_without_images.append((province, name))

        # Limit batch size
        spots_without_images = spots_without_images[:args.limit]

        print(f"Spots without images: {len(spots_without_images)}")
        stats = {"success": 0, "total_images": 0}

        for idx, (province, name) in enumerate(spots_without_images, 1):
            print(f"\n[{idx}/{len(spots_without_images)}] {name}")
            try:
                r = process_spot(province, name, args.max_images)
                fetched = r.get("images_fetched", 0)
                if fetched > 0:
                    stats["success"] += 1
                    stats["total_images"] += fetched
                print(f"  → {r}")
            except Exception as e:
                print(f"  → Error: {e}")

            if args.delay > 0 and idx < len(spots_without_images):
                time.sleep(args.delay)

        print(f"\nDone. Stats: {stats}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
