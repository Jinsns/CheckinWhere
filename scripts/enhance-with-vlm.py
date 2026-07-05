#!/usr/bin/env python3
"""
使用VLM增强景区README内容
分析图片内容，生成生动的描述
"""

import os
import sys
import json
import base64
from pathlib import Path
from openai import OpenAI

# VLM API配置
API_KEY = "ark-cc9cc5df-a4ca-4950-b1bb-d78ce1ea9bd5-8f374"
BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
MODEL = "ep-20250618181138-79q5w"  # 请替换为你的Endpoint ID

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

def image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def analyze_image(image_path, spot_name):
    """使用VLM分析图片内容"""
    print(f"  分析图片: {Path(image_path).name}")

    base64_image = image_to_base64(image_path)

    prompt = f"""
你是一位专业的旅游景区导游和摄影师。请详细分析这张关于"{spot_name}"的景区照片：

1. 首先描述图片中看到的具体内容（建筑、景观、人物、天气等）
2. 结合图片内容，用生动的语言描写这个景点的特色和美感
3. 描述最佳的观赏角度和拍照时机
4. 联想这个景点的历史背景或文化意义（如果能从图片中看出）

要求：
- 语言生动，有感染力，适合作为旅游文案
- 字数控制在200-300字
- 分点描述，但不要用序号
- 结合图片的光影、构图、色彩来描写
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"    VLM分析失败: {e}")
        return None

def generate_spot_intro(spot_name, spot_info, image_analyses):
    """根据图片分析和景点信息生成完整的景点介绍"""
    print(f"  生成景点介绍文案...")

    images_text = "\n\n".join([
        f"【图片{i+1}分析】\n{analysis}"
        for i, analysis in enumerate(image_analyses)
        if analysis
    ])

    prompt = f"""
你是一位资深的旅游作家。请为"{spot_name}"撰写一篇生动的景区介绍文章。

景点信息：
- 省份：{spot_info.get('province', '')}
- 城市：{spot_info.get('city', '')}
- 级别：国家AAAAA级旅游景区
- 获批批次：{spot_info.get('batch', '')}

以下是该景点几张实景照片的VLM分析结果：
{images_text}

请撰写一篇完整的景区介绍，要求：

1. 【开篇】用富有感染力的语言介绍景区整体印象
2. 【历史文化】介绍景区的历史背景、文化意义（如不知道可根据常识推断或略写）
3. 【核心景点详解】根据图片分析内容，详细介绍2-3个主要看点，每个配生动的描写
4. 【旅游贴士】最佳游览时间、拍照建议、注意事项
5. 【结语】温馨的总结和祝福

要求：
- 总字数800-1200字
- 语言优美，有画面感
- 避免空洞的套话，结合具体场景描写
- 使用markdown格式，适当使用emoji增加趣味性
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"    生成文案失败: {e}")
        return None

def process_spot(spot_path):
    """处理单个景区"""
    readme_path = spot_path / "README.md"
    images_dir = spot_path / "images"

    if not readme_path.exists():
        print(f"  跳过: 无README")
        return False

    # 读取现有README获取基本信息
    content = readme_path.read_text(encoding='utf-8')

    # 解析frontmatter
    frontmatter = {}
    if content.startswith('---'):
        end = content.find('---', 3)
        if end > 0:
            fm_text = content[3:end].strip()
            for line in fm_text.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    frontmatter[key.strip()] = value.strip()

    spot_name = frontmatter.get('name', spot_path.name)
    print(f"\n处理景区: {spot_name}")

    # 检查图片
    if not images_dir.exists():
        print(f"  跳过: 无图片目录")
        return False

    image_files = sorted(images_dir.glob("*.jpg")) + sorted(images_dir.glob("*.jpeg")) + sorted(images_dir.glob("*.png"))

    if len(image_files) == 0:
        print(f"  跳过: 无图片文件")
        return False

    # 分析前3张图片
    image_analyses = []
    for img_path in image_files[:3]:
        analysis = analyze_image(img_path, spot_name)
        image_analyses.append(analysis)

    if not any(image_analyses):
        print(f"  跳过: 图片分析全部失败")
        return False

    # 生成新的介绍文案
    new_intro = generate_spot_intro(spot_name, frontmatter, image_analyses)

    if not new_intro:
        print(f"  跳过: 生成文案失败")
        return False

    # 保留原frontmatter，替换正文
    fm_end = content.find('---', 3) + 3
    new_content = content[:fm_end] + '\n\n' + new_intro + '\n\n'

    # 备份原文件
    backup_path = readme_path.with_suffix('.md.bak.vlm')
    readme_path.rename(backup_path)

    # 写入新文件
    readme_path.write_text(new_content, encoding='utf-8')
    print(f"  ✅ 完成！新README已写入")

    return True

def main():
    if len(sys.argv) < 2:
        print("用法: python enhance-with-vlm.py <景区目录>")
        print("示例: python enhance-with-vlm.py data/scenic-spots/上海市/浦东新区/上海东方明珠广播电视塔")
        return

    spot_path = Path(sys.argv[1])

    if spot_path.name == "all":
        # 处理所有景区
        base_path = Path("data/scenic-spots")
        count = 0
        for province in base_path.iterdir():
            if province.is_dir():
                for city in province.iterdir():
                    if city.is_dir():
                        for spot in city.iterdir():
                            if spot.is_dir():
                                if process_spot(spot):
                                    count += 1
        print(f"\n完成！共处理 {count} 个景区")
    else:
        process_spot(spot_path)

if __name__ == "__main__":
    main()
