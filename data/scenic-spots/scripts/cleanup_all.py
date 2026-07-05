#!/usr/bin/env python3
"""
Clean up CSS residue in all README.md files.
Also ensure the "景点一" / "景点二" sections have the image placeholder replaced.
"""
from pathlib import Path
import re

BASE_DIR = Path(__file__).parent.parent


def clean_summary(content: str) -> str:
    """Remove CSS residue from the overview section."""
    if "## 景区概览" not in content:
        return content

    # Find the summary section
    match = re.search(r"(## 景区概览\n\n)(.+?)(\n## )", content, re.S)
    if not match:
        return content

    prefix = match.group(1)
    summary = match.group(2)
    suffix = match.group(3)

    # Remove CSS class definitions
    summary = re.sub(r"\.mw-parser-output[^{]*\{[^}]*\}", "", summary)
    summary = re.sub(r"html[^{]*\{[^}]*\}", "", summary)
    summary = re.sub(r"@media[^{]*\{[^}]*\}", "", summary)
    summary = re.sub(r"body[^{]*\{[^}]*\}", "", summary)

    # Remove inline CSS properties
    summary = re.sub(r"display:inline", "", summary)
    summary = re.sub(r"white-space:nowrap", "", summary)
    summary = re.sub(r"&#xfeff;", "", summary)

    # Clean up multiple blank lines
    summary = re.sub(r"\n\s*\n", "\n", summary).strip()

    return content.replace(match.group(0), prefix + summary + "\n\n" + suffix)


def clean_images_section(content: str) -> str:
    """Remove duplicate placeholder images, ensure real images are used."""
    # Remove any remaining placeholder
    content = content.replace("![景点配图](./image-placeholder.jpg)", "")

    # If no images at all, don't show empty section
    if "待补充景点介绍。" in content and "![" not in content.split("待补充景点介绍。")[0]:
        pass  # No images, leave as is

    return content


def process_file(path: Path):
    content = path.read_text(encoding="utf-8")
    original = content

    content = clean_summary(content)
    content = clean_images_section(content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    count = 0
    for readme in BASE_DIR.rglob("*/README.md"):
        if process_file(readme):
            count += 1
    print(f"Cleaned {count} files")


if __name__ == "__main__":
    main()
