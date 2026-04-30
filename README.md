# 住哪儿 · CheckinWhere

> 智能旅行住宿推荐工具 —— 根据你的景点行程，找到公共交通最便利的住宿位置。

**在线体验：[checkinwhere.site](https://checkinwhere.site)**

---

## 功能介绍

### 1. 城市定位

在左侧搜索栏输入城市名，地图将平滑定位到该城市，并展示**地名公告动画**：城市名以大字居中出现，随后飞向左上角以标签形式常驻，方便随时确认当前所在区域。

定位后，地图自动标注该城市各行政区的热门地点，按类别分为：

| 图标 | 类别 |
|------|------|
| 🎭 | 景点 |
| 🛎️ | 住宿 |
| 🍴 | 餐厅 |
| 🛍️ | 购物中心 |

标记按行政区均匀分布，悬停可查看地点名称。

---

### 2. 随机目的地选择

对于有「选择困难症」的旅行者，提供两种随机模式：

- **省市随机**：在 31 个省级行政区和下辖城市中随机抽取，适合规划城市游
- **坐标随机**：在中国大陆范围内随机落点，通过逆地理编码解析出具体地址，适合探索冷门小地方

点击「再随一次」可反复抽取，确认后自动定位地图。

---

### 3. 景点搜索与管理

点击「添加景点」输入框后，自动展示当前城市的**热门景点推荐**（按热度排序）。

直接输入关键词可搜索任意景点，点击 `+` 即可加入行程列表。已添加的景点会显示在侧栏，支持单独移除或一键清空。

---

### 4. 住宿智能推荐

添加多个景点后，点击「为我推荐住宿」，系统将：

1. 规划各景点之间的公共交通路线，提取途经的公交/地铁站点
2. 识别重要换乘站（多条地铁线路交汇处），优先在换乘站附近搜索住宿
3. 对候选住宿计算到所有景点的公交通勤时间
4. 按**时间均衡度**（标准差）和平均通勤时长排序
5. 返回最优的 15 家住宿，并展示到每个景点的详细路线

推荐结果可按价格区间筛选，点击住宿卡片可在地图上定位。

---

## 技术栈

```
前端框架     Next.js 15 (App Router) + TypeScript
UI 组件      Ant Design 5.x
地图         高德地图 JS API 2.0（客户端渲染）
地图数据     高德地图 REST API（服务端代理）
状态管理     React Context + useReducer
部署         PM2 + Nginx（百度云 Ubuntu 22.04）
CI/CD        GitHub Actions（push to main 自动构建部署）
```

### 高德 API 使用说明

| API | 用途 |
|-----|------|
| `geocode/geo` | 城市名 → 坐标 |
| `geocode/regeo` | 坐标 → 行政区（随机落点验证） |
| `place/text` | 关键词景点搜索、热门景点 |
| `place/around` | 周边 POI / 住宿搜索 |
| `direction/transit/integrated` | 公共交通路径规划 |
| `config/district` | 行政区划查询（周边标记分布） |

所有 REST API 均通过 Next.js API Route 在服务端调用，**客户端不暴露服务端 Key**。

---

## 本地开发

### 前提

- Node.js 18+
- 高德地图开发者账号（需申请两个 Key：Web 服务 API Key + JS API Key）

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/Jinsns/TravelWeb.git
cd TravelWeb

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的高德地图 Key

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 环境变量说明

```env
# 服务端调用（不暴露给客户端），申请"Web服务"类型
AMAP_KEY=你的Web服务API_Key

# 客户端地图渲染，申请"Web端(JS API)"类型，需配置域名白名单
NEXT_PUBLIC_AMAP_JS_KEY=你的JS_API_Key
```

---

## 部署

项目通过 GitHub Actions 自动部署。每次推送到 `main` 分支时，CI 会自动构建并通过 SSH 将产物部署到服务器，由 PM2 管理进程、Nginx 反向代理。

需在 GitHub 仓库 Secrets 中配置：

| Secret 名称 | 说明 |
|-------------|------|
| `SERVER_HOST` | 服务器公网 IP |
| `SERVER_USER` | SSH 用户名 |
| `SERVER_SSH_KEY` | SSH 私钥 |
| `AMAP_KEY` | 高德 Web 服务 Key |
| `NEXT_PUBLIC_AMAP_JS_KEY` | 高德 JS API Key |

---

## License

MIT
