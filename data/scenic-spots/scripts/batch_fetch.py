#!/usr/bin/env python3
"""
Batch fetch scenic spot data from Wikipedia (Baidu Baike blocked as of Jun 2026)
Usage: python3 batch_fetch.py --province 山西省 --delay 1.5
"""
from pathlib import Path
import subprocess
import sys
import argparse
import csv

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "5a-scenic-spots.csv"


def list_spots_by_province(province: str | None):
    spots = []
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if province and row.get("省级行政区") != province:
                continue
            spots.append(row)
    return spots


def fetch_one(province: str, city: str, name: str, delay: float):
    script = BASE_DIR / "scripts" / "fetch_wikipedia.py"
    try:
        subprocess.run(
            [sys.executable, str(script), "--name", name, "--province", province],
            cwd=str(BASE_DIR),
            check=True,
            timeout=40,
        )
    except subprocess.CalledProcessError:
        pass
    if delay > 0:
        import time
        time.sleep(delay)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--province", default="")
    parser.add_argument("--delay", type=float, default=1.5)
    args = parser.parse_args()

    spots = list_spots_by_province(args.province)
    print(f"Found {len(spots)} spots to process")
    for idx, s in enumerate(spots, 1):
        province = s.get("省级行政区", "")
        city = s.get("地级行政区", "") or s.get("县级行政区", "")
        name = s.get("景区名称", "")
        print(f"\n[{idx}/{len(spots)}] {name} - {province} {city}")
        fetch_one(province, city, name, args.delay)

    print("\nDone")
