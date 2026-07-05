#!/usr/bin/env python3
"""
Fetch scenic spot images from Xiaohongshu (Little Red Book).
Uses Playwright to browse and extract image URLs.
"""
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
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


def has_wikimedia_images(spot_path: Path) -> bool:
    """Check if spot already has Wikimedia images."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False
    content = readme.read_text(encoding="utf-8")
    return "upload.wikimedia.org" in content


def extract_note_ids(html: str) -> list[str]:
    """Extract note IDs from Xiaohongshu search results."""
    # Pattern for note links: /explore/xxx or /discover/item/xxx
    pattern = r'(?:/explore/|/discover/item/)([a-zA-Z0-9]+)'
    matches = re.findall(pattern, html)
    return list(dict.fromkeys(matches))[:20]


def fetch_images_for_spot(name: str, province: str, max_images: int = 6) -> list[dict]:
    """Search Xiaohongshu for scenic spot images."""
    search_query = f"{name} 攻略"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()

        images = []

        try:
            # Search
            url = f"https://www.xiaohongshu.com/search_result?keyword={quote(search_query)}"
            page.goto(url, timeout=30000)
            time.sleep(3)

            # Wait for content to load
            try:
                page.wait_for_selector("section.note-item, div.note-card", timeout=10000)
            except PlaywrightTimeoutError:
                # Try to scroll to trigger loading
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(2)

            # Extract note links
            note_ids = []
            links = page.locator("a[href*='/explore/'], a[href*='/discover/item/']").all()
            for link in links[:15]:
                href = link.get_attribute("href")
                if href:
                    note_id = href.split("/")[-1].split("?")[0]
                    if len(note_id) > 10:
                        note_ids.append(note_id)

            note_ids = list(dict.fromkeys(note_ids))[:10]

            # Visit each note to get full images
            for note_id in note_ids[:5]:
                if len(images) >= max_images:
                    break

                try:
                    note_url = f"https://www.xiaohongshu.com/explore/{note_id}"
                    page.goto(note_url, timeout=15000)
                    time.sleep(2)

                    # Get title
                    title = ""
                    try:
                        title_elem = page.locator("h1, .title, .note-title").first
                        title = title_elem.inner_text(timeout=3000).strip()
                    except:
                        pass

                    # Get all images from note
                    img_elements = page.locator("div.swiper-slide img, .note-content img, main img").all()
                    for img in img_elements:
                        if len(images) >= max_images:
                            break

                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        if src and "sns-avatar" not in src and "xiaohongshu" in src:
                            # Clean up URL - get highest quality version
                            if "?" in src:
                                src = src.split("?")[0]

                            # Avoid duplicates
                            if not any(img["url"] == src for img in images):
                                images.append({
                                    "url": src,
                                    "title": title or name,
                                    "source": f"https://www.xiaohongshu.com/explore/{note_id}",
                                    "keywords": [name, province, "旅游攻略"]
                                })

                    time.sleep(1)
                except Exception as e:
                    print(f"  Note error: {e}")
                    continue

        except Exception as e:
            print(f"  Search error: {e}")
        finally:
            browser.close()

        return images[:max_images]


def update_readme(spot_path: Path, images: list[dict]):
    """Add Xiaohongshu images to README."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return

    content = readme.read_text(encoding="utf-8")

    # Check if already has images
    if "![" in content and ("upload.wikimedia" in content or "xiaohongshu" in content):
        return False

    # Build image section
    img_section = "## 景区内主要景点\n\n"
    for idx, img in enumerate(images, 1):
        img_section += f"![]({img['url']})\n"
        img_section += f"**图 {idx}**: {img['title'][:100]}\n"
        if img.get("keywords"):
            img_section += f"关键词：{'、'.join(img['keywords'][:5])}\n"
        img_section += f"来源：[小红书]({img['source']})\n\n"

    # Replace or insert
    if "## 景区内主要景点\n\n" in content:
        content = content.replace("## 景区内主要景点\n\n", img_section)
    elif "## 景区内主要景点" in content:
        # Find the header and replace
        old_section_start = content.find("## 景区内主要景点")
        next_section = content.find("\n## ", old_section_start + 10)
        if next_section != -1:
            content = content[:old_section_start] + img_section + content[next_section:]
        else:
            content = content[:old_section_start] + img_section
    else:
        # Insert before 游览建议
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
    if has_wikimedia_images(spot_path):
        result["skipped"] = "already has Wikimedia images"
        return result

    images = fetch_images_for_spot(name, province, max_images)

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
    parser.add_argument("--delay", type=float, default=5.0)
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
            if path and not has_wikimedia_images(path):
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
