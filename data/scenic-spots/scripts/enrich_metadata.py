#!/usr/bin/env python3
"""
Enrich scenic spot metadata:
1. Extract and standardize coordinates (lat/lng in decimal)
2. Fetch image captions, descriptions and keywords from Wikimedia Commons API

Usage: python3 enrich_metadata.py --all --delay 0.5
"""
from urllib.request import Request, urlopen
from urllib.parse import quote, unquote
from pathlib import Path
import re
import argparse
import csv
import time
import json

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "5a-scenic-spots.csv"


def dms_to_decimal(degrees: float, minutes: float, seconds: float, direction: str) -> float:
    """Convert degrees/minutes/seconds to decimal degrees."""
    decimal = degrees + minutes / 60 + seconds / 3600
    if direction in ['S', 'W', '南', '西']:
        decimal = -decimal
    return decimal


def parse_coordinates(text: str) -> tuple[float, float] | None:
    """Parse coordinates from Wikipedia page in various formats."""
    # Format 1: 40°06′36″N 113°07′21″E
    m1 = re.search(
        r'(\d+)°(\d+)′(\d+)″[NS][\s　]+(\d+)°(\d+)′(\d+)″[EW]',
        text
    )
    if m1:
        lat = dms_to_decimal(float(m1.group(1)), float(m1.group(2)), float(m1.group(3)), 'N')
        lng = dms_to_decimal(float(m1.group(4)), float(m1.group(5)), float(m1.group(6)), 'E')
        return round(lat, 6), round(lng, 6)

    # Format 2: decimal inline / 40.11000°N 113.12250°E
    m2 = re.search(
        r'(\d+\.\d+)°[NS][\s　]+(\d+\.\d+)°[EW]',
        text
    )
    if m2:
        lat = float(m2.group(1))
        lng = float(m2.group(2))
        # Check direction hints in surrounding text
        if '西经' in text[:text.find(m2.group(0))]:
            lng = -lng
        return round(lat, 6), round(lng, 6)

    # Format 3: Geo microformat / 34.25983; 108.95175
    m3 = re.search(r'class="geo"[^>]*>\s*([\d.]+)\s*[;,]\s*([\d.]+)', text)
    if m3:
        return round(float(m3.group(1)), 6), round(float(m3.group(2)), 6)

    return None


def get_image_metadata(url: str) -> dict | None:
    """Fetch image metadata from Wikimedia Commons API."""
    filename = get_image_original_filename(url)
    if not filename:
        return None

    filename = unquote(filename)
    if "File:" not in filename:
        filename = f"File:{filename}"

    api_url = (
        f"https://commons.wikimedia.org/w/api.php?"
        f"action=query&titles={quote(filename)}&prop=imageinfo&iilimit=1"
        f"&iiprop=extmetadata&format=json"
    )

    try:
        req = Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read().decode("utf-8"))

        pages = data.get("query", {}).get("pages", {})
        for page_id, page_data in pages.items():
            if page_id == "-1":
                continue
            info = page_data.get("imageinfo", [{}])[0]
            meta = info.get("extmetadata", {})

            result = {
                "title": meta.get("ObjectName", {}).get("value", ""),
                "description": meta.get("ImageDescription", {}).get("value", ""),
                "date": meta.get("DateTime", {}).get("value", ""),
                "artist": meta.get("Artist", {}).get("value", ""),
                "license": meta.get("LicenseShortName", {}).get("value", ""),
                "categories_html": meta.get("Categories", {}).get("value", ""),
                "gps_latitude": meta.get("GPSLatitude", {}).get("value"),
                "gps_longitude": meta.get("GPSLongitude", {}).get("value"),
            }

            result["description"] = re.sub(r"<[^>]+>", "", result["description"]).strip()
            result["artist"] = re.sub(r"<[^>]+>", "", result["artist"]).strip()

            keywords = []
            if isinstance(result["categories_html"], str):
                cats = re.findall(r'title="Category:([^"]+)"', result["categories_html"])
                keywords = [c.replace("_", " ").strip() for c in cats[:10]]
            result["keywords"] = keywords

            return result
    except Exception as e:
        return None


def extract_image_urls(content: str) -> list[str]:
    """Extract unique Wikimedia image URLs from README."""
    urls = re.findall(r"!\[[^\]]*]\((https://upload\.wikimedia\.org/[^)]+)\)", content)
    seen = set()
    unique = []
    for u in urls:
        if u not in unique:
            unique.append(u)
    return unique


def get_image_original_filename(url: str) -> str | None:
    """Extract original Wikimedia filename from thumbnail URL."""
    # Remove thumbnail URLs have pattern: /wikipedia/commons/thumb/.../xxxpx-OriginalName.jpg
    # Or: /wikipedia/commons/a/ab/OriginalName.jpg
    # Find the part after last slash before thumbnail size marker
    m = re.search(r"/(\d+)px-([^/]+\.(?:jpg|jpeg|png|webp))", url, re.I)
    if m:
        return unquote(m.group(2))

    # Non-thumbnail direct URL
    m = re.search(r"/wikipedia/commons/[^/]+/[^/]+/([^/]+\.(?:jpg|jpeg|png|webp))", url, re.I)
    if m:
        return unquote(m.group(1))

    return None


def update_readme_with_metadata(spot_path: Path, coords: tuple | None, images_with_meta: list):
    readme = spot_path / "README.md"
    if not readme.exists():
        return

    content = readme.read_text(encoding="utf-8")
    original = content

    # Update frontmatter with coordinates
    if coords:
        lat, lng = coords
        # Only update if not already present
        if "latitude:" not in content[: content.find("---", 4)]:
            fm_end = content.find("---", 4)
            if fm_end != -1:
                new_fm = content[:fm_end].rstrip() + f"\nlatitude: {lat}\nlongitude: {lng}\n---"
                content = new_fm + content[fm_end + 3 :]

    # Update images with captions and keywords
    images = extract_image_urls(content)
    if images and images_with_meta:
        img_section = content.find("## 景区内主要景点")
        if img_section != -1:
            # Build new image section with metadata
            new_section = "## 景区内主要景点\n\n"
            for idx, (url, meta) in enumerate(images_with_meta, 1):
                if not meta:
                    new_section += f"![]({url})\n\n"
                    continue

                caption = meta.get("title") or meta.get("description", "")
                keywords = meta.get("keywords", [])
                license_info = meta.get("license", "")
                gps_lat = meta.get("gps_latitude")
                gps_lng = meta.get("gps_longitude")

                new_section += f"![]({url})\n"
                if caption:
                    new_section += f"**图 {idx}**: {caption[:200]}\n"
                if keywords:
                    clean_kws = [re.sub(r"<[^>]+>", "", str(k)) for k in keywords[:5]]
                    clean_kws = [k for k in clean_kws if k]
                    if clean_kws:
                        new_section += f"关键词：{'、'.join(clean_kws)}\n"
                if gps_lat and gps_lng:
                    new_section += f"坐标：{gps_lat}, {gps_lng}\n"
                if license_info:
                    new_section += f"授权：{license_info}\n"
                new_section += "\n"

            # Replace old section
            old_section_start = content.find("## 景区内主要景点")
            next_section = content.find("\n## ", old_section_start + 10)
            if next_section != -1:
                content = content[:old_section_start] + new_section + content[next_section:]
            else:
                content = content[:old_section_start] + new_section

    if content != original:
        readme.write_text(content, encoding="utf-8")
        return True
    return False


def find_spot_path(name: str, province: str) -> Path | None:
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


def get_wikipedia_page(name: str) -> str | None:
    clean_name = re.sub(
        r"（.*?）|旅游区|景区|风景名胜区|风景区|博物馆|旅游景区|公园", "", name
    ).strip()
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


def process_spot(province: str, name: str, delay: float) -> dict:
    result = {"name": name, "province": province, "coords": None, "images": 0, "images_with_meta": 0}

    spot_path = find_spot_path(name, province)
    if not spot_path:
        result["error"] = "path not found"
        return result

    # Get fresh page for coordinate parsing
    html = get_wikipedia_page(name)
    coords = None
    if html:
        coords = parse_coordinates(html)
        result["coords"] = coords

    # Extract images and get metadata for each
    images_with_meta = []
    if spot_path:
        readme_content = (spot_path / "README.md").read_text(encoding="utf-8")
        img_urls = extract_image_urls(readme_content)
        result["images"] = len(img_urls)

        for url in img_urls[:6]:
            meta = get_image_metadata(url)
            images_with_meta.append((url, meta))
            if meta:
                result["images_with_meta"] += 1
            time.sleep(delay * 0.5)

        if coords or images_with_meta:
            update_readme_with_metadata(spot_path, coords, images_with_meta)

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="")
    parser.add_argument("--province", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--delay", type=float, default=0.5)
    args = parser.parse_args()

    if args.name:
        result = process_spot(args.province, args.name, args.delay)
        print(result)
    elif args.all:
        spots = []
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                spots.append((row["省级行政区"], row["景区名称"]))

        print(f"Processing {len(spots)} spots...")
        stats = {"with_coords": 0, "with_images": 0, "total_images": 0, "total_meta": 0}

        for idx, (province, name) in enumerate(spots, 1):
            print(f"[{idx}/{len(spots)}] {name}")
            r = process_spot(province, name, args.delay)
            if r.get("coords"):
                stats["with_coords"] += 1
            if r.get("images", 0) > 0:
                stats["with_images"] += 1
            stats["total_images"] += r.get("images", 0)
            stats["total_meta"] += r.get("images_with_meta", 0)
            if args.delay > 0:
                time.sleep(args.delay)

        print(f"\nDone. Stats: {stats}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
