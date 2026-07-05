#!/usr/bin/env python3
"""
More robust batch fetch with retry and progress tracking.
Usage: python3 batch_fetch_v2.py --delay 2.5 --retries 2
"""
from pathlib import Path
import subprocess
import sys
import csv
import time
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "5a-scenic-spots.csv"
PROGRESS = BASE_DIR / ".fetch_progress"


def load_progress() -> set:
    if not PROGRESS.exists():
        return set()
    return set(PROGRESS.read_text(encoding="utf-8").strip().splitlines())


def save_progress(name: str):
    done = load_progress()
    done.add(name)
    PROGRESS.write_text("\n".join(sorted(done)), encoding="utf-8")


def list_spots():
    spots = []
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            spots.append(row)
    return spots


def fetch_one(province: str, city: str, name: str, retries: int):
    script = BASE_DIR / "scripts" / "fetch_wikipedia.py"
    for attempt in range(retries + 1):
        try:
            subprocess.run(
                [sys.executable, str(script), "--name", name, "--province", province],
                cwd=str(BASE_DIR),
                check=True,
                timeout=60,
                capture_output=True,
                text=True,
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"  attempt {attempt+1} failed: {e.stderr[:100]}")
            time.sleep(2)
        except subprocess.TimeoutExpired:
            print(f"  attempt {attempt+1} timed out")
            time.sleep(2)
    return False


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay", type=float, default=2.5)
    parser.add_argument("--retries", type=int, default=2)
    args = parser.parse_args()

    all_spots = list_spots()
    done = load_progress()
    pending = [s for s in all_spots if s["景区名称"] not in done]

    by_province = defaultdict(list)
    for s in pending:
        by_province[s["省级行政区"]].append(s)

    print(f"Total: {len(all_spots)}, done: {len(done)}, pending: {len(pending)}, provinces: {len(by_province)}")

    for province, spots in sorted(by_province.items()):
        print(f"\n=== {province} ({len(spots)}) ===")
        for idx, s in enumerate(spots, 1):
            name = s["景区名称"]
            city = s.get("地级行政区", "") or s.get("县级行政区", "")
            print(f"  [{idx}/{len(spots)}] {name}")
            ok = fetch_one(province, city, name, args.retries)
            if ok:
                save_progress(name)
            if args.delay > 0:
                time.sleep(args.delay)

    done = load_progress()
    print(f"\n\nFinished. Total processed: {len(done)} / {len(all_spots)}")


if __name__ == "__main__":
    main()
