#!/usr/bin/env python3
"""
Enhanced Wikipedia image extractor.
Extracts images from infoboxes, galleries, and main content.
"""
from urllib.request import Request, urlopen
from urllib.parse import quote, unquote
from pathlib import Path
import argparse
import csv
import time
import re

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
    return len(images) >= 3


def download_image(url: str, save_path: Path) -> bool:
    """Download an image from URL."""
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer": "https://zh.wikipedia.org/"
        })
        with urlopen(req, timeout=30) as resp:
            content = resp.read()
            if len(content) < 4096:  # Skip tiny images
                return False
            save_path.write_bytes(content)
        return True
    except Exception as e:
        return False


def get_wikipedia_page(name: str) -> str | None:
    """Fetch Wikipedia page content."""
    clean_name = re.sub(r"（.*?）|旅游区|景区|风景名胜区|风景区|博物馆|旅游景区|公园|景区|^重庆|^陕西|^四川", "", name).strip()
    clean_name = clean_name or name

    # Try several variations
    variants = [
        clean_name,
        clean_name + "风景区",
        clean_name + "景区",
        clean_name + "风景名胜区",
        clean_name + "石窟",
        clean_name + "山",
    ]
    # Also try without city prefix
    for city in ["重庆", "成都", "西安", "北京", "上海", "广州", "杭州"]:
        if clean_name.startswith(city):
            variants.append(clean_name.replace(city, ""))

    for variant in list(dict.fromkeys(variants)):  # Remove duplicates
        if not variant:
            continue
        url = f"https://zh.wikipedia.org/wiki/{quote(variant)}"
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urlopen(req, timeout=20)
            if resp.status == 200:
                return resp.read().decode("utf-8", errors="replace")
        except Exception:
            continue
    return None


def extract_wikipedia_images(html: str, max_images: int = 6) -> list[dict]:
    """Extract all relevant images from Wikipedia page HTML."""
    images = []
    seen = set()

    # 1. Infobox images (highest priority)
    infobox_pattern = r'<table[^>]*class="[^"]*infobox[^"]*"[^>]*>.*?<img[^>]*src="(//upload\.wikimedia\.org/[^"]+\.(?:jpg|jpeg|png))"'
    matches = re.findall(infobox_pattern, html, re.I | re.S)
    for m in matches:
        if m not in seen:
            seen.add(m)
            images.append({"url": "https:" + m, "source": "Wikipedia Infobox"})

    # 2. Gallery images
    gallery_pattern = r'<ul[^>]*class="[^"]*gallery[^"]*"[^>]*>.*?</ul>'
    galleries = re.findall(gallery_pattern, html, re.I | re.S)
    for gallery in galleries:
        img_matches = re.findall(r'<img[^>]*src="(//upload\.wikimedia\.org/[^"]+\.(?:jpg|jpeg|png))"', gallery, re.I)
        for m in img_matches:
            if m not in seen:
                seen.add(m)
                images.append({"url": "https:" + m, "source": "Wikipedia Gallery"})

    # 3. Main content images
    content_img_pattern = r'<img[^>]*src="(//upload\.wikimedia\.org/[^"]+\.(?:jpg|jpeg|png))"[^>]*class="mw-file-element"'
    matches = re.findall(content_img_pattern, html, re.I)
    for m in matches:
        if m not in seen:
            seen.add(m)
            images.append({"url": "https:" + m, "source": "Wikipedia Content"})

    # 4. All other upload.wikimedia.org images
    all_img_pattern = r'src="(//upload\.wikimedia\.org/[^"]+\.(?:jpg|jpeg|png))"'
    matches = re.findall(all_img_pattern, html, re.I)
    for m in matches:
        if m not in seen:
            seen.add(m)
            images.append({"url": "https:" + m, "source": "Wikipedia"})

    return images[:max_images]


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
            img_section += f"![风景照片]({img_filename})\n"
            img_section += f"**图 {idx}**: 景区风光\n"
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
    return success_count


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

    html = get_wikipedia_page(name)
    if not html:
        result["error"] = "no Wikipedia page"
        return result

    images = extract_wikipedia_images(html, max_images)
    print(f"  Found {len(images)} images")

    if images:
        count = update_readme_with_local_images(spot_path, images)
        result["images_fetched"] = count

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="")
    parser.add_argument("--province", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--max-images", type=int, default=4)
    parser.add_argument("--limit", type=int, default=200)
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
            if path and not has_enough_images(path):
                spots_without_images.append((province, name))

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
