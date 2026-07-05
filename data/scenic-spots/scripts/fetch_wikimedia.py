#!/usr/bin/env python3
"""
Fetch additional images from Wikimedia Commons using search API.
This supplements existing Wikipedia image extraction.
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
    return len(images) > 2  # Has at least 2 real images


def search_wikimedia(keyword: str, max_images: int = 6) -> list[dict]:
    """Search Wikimedia Commons for images."""
    images = []

    # Remove province prefix if present
    parts = keyword.split(" ")
    if len(parts) > 1:
        base_term = " ".join(parts[1:])
    else:
        base_term = keyword

    # Clean up and try different search terms
    base_term = base_term.replace("景区", "").replace("旅游区", "").strip()
    for search_term in [f"{base_term} 风景", f"{base_term} 风光", base_term]:
        if len(images) >= max_images:
            break

        url = (
            f"https://commons.wikimedia.org/w/api.php?"
            f"action=query&list=search&srsearch={quote(search_term)}&srnamespace=6"
            f"&srlimit={max_images}&format=json"
        )

        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urlopen(req, timeout=15)
            data = json.loads(resp.read().decode("utf-8"))

            for item in data.get("query", {}).get("search", []):
                if len(images) >= max_images:
                    break

                title = item.get("title", "")
                pageid = item.get("pageid", 0)

                # Get image info
                info_url = (
                    f"https://commons.wikimedia.org/w/api.php?"
                    f"action=query&pageids={pageid}&prop=imageinfo"
                    f"&iiprop=url|extmetadata&format=json"
                )
                req2 = Request(info_url, headers={"User-Agent": "Mozilla/5.0"})
                resp2 = urlopen(req2, timeout=15)
                info_data = json.loads(resp2.read().decode("utf-8"))

                pages = info_data.get("query", {}).get("pages", {})
                for pid, page_data in pages.items():
                    imageinfo = page_data.get("imageinfo", [{}])[0]
                    img_url = imageinfo.get("url", "")
                    if not img_url:
                        continue

                    # Filter to image files only
                    img_lower = img_url.lower()
                    if not any(img_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        continue

                    meta = imageinfo.get("extmetadata", {})
                    img_title = meta.get("ObjectName", {}).get("value", "") or title.replace("File:", "")
                    license_name = meta.get("LicenseShortName", {}).get("value", "CC")

                    images.append({
                        "url": img_url,
                        "title": img_title[:100],
                        "license": license_name,
                        "source": "Wikimedia Commons"
                    })

        except Exception as e:
            continue

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
        img_section += f"**图 {idx}**: {img['title']}\n"
        if img.get("license"):
            img_section += f"授权：{img['license']}\n"
        img_section += "\n"

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

    # Skip if already has enough images
    if has_images(spot_path):
        result["skipped"] = "already has images"
        return result

    images = search_wikimedia(name, max_images)

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
    parser.add_argument("--delay", type=float, default=0.5)
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
