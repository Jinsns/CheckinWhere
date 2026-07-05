#!/usr/bin/env python3
"""
Xiaohongshu (Little Red Book) image scraper using Playwright.
Headful mode for easy manual login when needed.

Usage: python3 xiaohongshu_scraper.py --name "故宫博物院" --province "北京市"
Usage: python3 xiaohongshu_scraper.py --all
"""
from playwright.sync_api import sync_playwright
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
    return len(images) >= 4


def download_image(url: str, save_path: Path) -> bool:
    """Download an image from URL."""
    try:
        from urllib.request import Request, urlopen
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://www.xiaohongshu.com/"
        })
        with urlopen(req, timeout=30) as resp:
            save_path.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"    Download failed: {e}")
        return False


def scrape_xiaohongshu(search_query: str, max_images: int = 6) -> list[dict]:
    """Scrape images from Xiaohongshu search."""
    images = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Headful for manual login
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()

        try:
            # Navigate to search
            url = f"https://www.xiaohongshu.com/search_result?keyword={search_query}&search_type=image"
            page.goto(url, timeout=60000)
            print(f"  Search page opened, waiting for content...")

            # Wait for user to login if needed
            print(f"  ⚠️  If you see login prompt, please login manually in the browser")
            print(f"  ⚠️  After login, the script will continue automatically")
            time.sleep(8)  # Give time for page load and potential login

            # Wait for images to appear
            try:
                page.wait_for_selector("img", timeout=15000)
            except:
                print("  No images found, trying search tab...")
                # Click search tab if needed
                try:
                    page.get_by_text("图片").click(timeout=5000)
                    time.sleep(3)
                except:
                    pass

            # Scroll to load more images
            for _ in range(3):
                page.evaluate("window.scrollBy(0, 800)")
                time.sleep(2)

            # Extract image URLs
            img_elements = page.locator("img").all()
            seen_urls = set()

            for img in img_elements:
                if len(images) >= max_images:
                    break

                try:
                    src = img.get_attribute("src")
                    if not src:
                        continue

                    # Skip small images, avatars, logos
                    if "sns-avatar" in src or "logo" in src or "xiaohongshu.ico" in src:
                        continue

                    # Get highest quality version
                    src = src.split("?")[0]

                    # Skip duplicates
                    if src in seen_urls or not src.startswith("http"):
                        continue
                    seen_urls.add(src)

                    # Get alt text or parent text
                    alt = img.get_attribute("alt") or ""
                    title = alt[:100] if alt else f"{search_query} 风景"

                    images.append({
                        "url": src,
                        "title": title,
                        "source": "Xiaohongshu"
                    })

                except Exception as e:
                    continue

            print(f"  Found {len(images)} images")

        except Exception as e:
            print(f"  Error: {e}")
        finally:
            browser.close()

        return images[:max_images]


def update_readme_with_local_images(spot_path: Path, images: list[dict]):
    """Download images locally and add to README."""
    readme = spot_path / "README.md"
    if not readme.exists():
        return False

    content = readme.read_text(encoding="utf-8")

    # Build image section
    img_section = "## 景区内主要景点\n\n"
    for idx, img in enumerate(images, 1):
        # Download image locally
        ext = Path(img['url']).suffix or '.jpg'
        if '?' in ext:
            ext = ext.split('?')[0]
        if len(ext) > 5 or not ext.startswith('.'):
            ext = '.jpg'

        img_filename = f"photo_{idx:02d}{ext}"
        img_path = spot_path / img_filename

        if download_image(img['url'], img_path):
            print(f"    Downloaded: {img_filename}")
            img_section += f"![{img['title'][:50]}]({img_filename})\n"
            img_section += f"**图 {idx}**: {img['title'][:80]}\n"
            img_section += f"来源：{img['source']}\n\n"
        else:
            img_section += f"![]({img['url']})\n"
            img_section += f"**图 {idx}**: {img['title'][:80]}\n\n"

        time.sleep(0.5)

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
    return True


def process_spot(province: str, name: str, max_images: int = 6) -> dict:
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
    search_term = re.sub(r"景区|旅游区|风景名胜区|风景区|公园", "", name).strip()
    search_term = f"{search_term} 风景 攻略"

    print(f"  Searching: {search_term}")
    images = scrape_xiaohongshu(search_term, max_images)

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
    parser.add_argument("--limit", type=int, default=10, help="Max spots to process in batch mode")
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

        print(f"Spots without images: {len(spots_without_images)}, processing first {args.limit}...")
        stats = {"success": 0, "total_images": 0}

        for idx, (province, name) in enumerate(spots_without_images, 1):
            print(f"\n[{idx}/{len(spots_without_images)}] {name}")
            try:
                r = process_spot(province, name, args.max_images)
                if r.get("images_fetched", 0) > 0:
                    stats["success"] += 1
                    stats["total_images"] += r["images_fetched"]
                print(f"  → {r}")
            except Exception as e:
                print(f"  → Error: {e}")

            if idx < len(spots_without_images):
                print(f"  Cooling down...")
                time.sleep(3)

        print(f"\nDone. Stats: {stats}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
