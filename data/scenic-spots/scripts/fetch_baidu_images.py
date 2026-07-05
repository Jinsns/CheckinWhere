#!/usr/bin/env python3
"""
Fetch scenic spot images from Baidu Images.
More reliable than Xiaohongshu, no login required.
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


def has_images(spot_path: Path) -> bool:
    """Check if spot already has images."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False
    content = readme.read_text(encoding="utf-8")
    img_pattern = r"!\[[^\]]*\]\([^)]+\)"
    images = re.findall(img_pattern, content)
    return len(images) > 0


def fetch_baidu_images(keyword: str, max_images: int = 6) -> list[dict]:
    """Search Baidu Images and return high-quality image URLs."""
    images = []
    search_url = f"https://image.baidu.com/search/acjson?tn=resultjson_com&word={quote(keyword + ' 景点')}&rn={max_images * 2}"

    try:
        req = Request(search_url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://image.baidu.com/"
        })
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read().decode("utf-8"))

        for item in data.get("data", []):
            if len(images) >= max_images:
                break

            img_url = item.get("thumbURL") or item.get("objURL") or item.get("hoverURL")
            if not img_url:
                continue

            # Validate URL
            if not img_url.startswith("http"):
                continue

            # Skip small thumbnails
            width = item.get("width", 0)
            height = item.get("height", 0)
            if width and height and (width < 300 or height < 200):
                continue

            from_page = item.get("fromPageTitle", "") or item.get("fromPageTitleEnc", "")
            from_page = re.sub(r"<[^>]+>", "", from_page).strip()

            images.append({
                "url": img_url,
                "title": from_page or keyword,
                "source": "Baidu Images",
                "keywords": [keyword, "旅游", "景点"]
            })

    except Exception as e:
        print(f"  Baidu Images error: {e}")

    return images[:max_images]


def update_readme(spot_path: Path, images: list[dict]):
    """Add images to README."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False

    content = readme.read_text(encoding="utf-8")

    # Build image section
    img_section = "## 景区内主要景点\n\n"
    for idx, img in enumerate(images, 1):
        img_section += f"![]({img['url']})\n"
        title = img['title'][:80] if img['title'] else f"{spot_path.name} 图片"
        img_section += f"**图 {idx}**: {title}\n"
        if img.get("keywords"):
            img_section += f"关键词：{'、'.join(img['keywords'][:3])}\n"
        img_section += f"来源：{img['source']}\n\n"

    # Replace or insert
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
    return True


def process_spot(province: str, name: str, max_images: int = 6) -> dict:
    """Process a single scenic spot."""
    result = {"name": name, "province": province, "images_fetched": 0}

    spot_path = find_spot_path(name, province)
    if not spot_path:
        result["error"] = "path not found"
        return result

    # Skip if already has images
    if has_images(spot_path):
        result["skipped"] = "already has images"
        return result

    images = fetch_baidu_images(f"{province} {name}", max_images)

    if images:
        update_readme(spot_path, images)
        result["images_fetched"] = len(images)

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="")
    parser.add_argument("--province", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--max-images", type=int, default=6)
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
            if path and not has_images(path):
                spots_without_images.append((province, name))

        print(f"Total spots: {len(spots)}, without images: {len(spots_without_images)}")

        stats = {"success": 0, "total_images": 0}

        for idx, (province, name) in enumerate(spots_without_images, 1):
            print(f"[{idx}/{len(spots_without_images)}] {name}")
            try:
                r = process_spot(province, name, args.max_images)
                if r.get("images_fetched", 0) > 0:
                    stats["success"] += 1
                    stats["total_images"] += r["images_fetched"]
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
