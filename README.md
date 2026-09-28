# Dada Dashboard

> 我的个人项目、Web App、开发工具、AI 实验和常用服务的统一入口。
>
> BLNF Dashboard 的实用信息架构 × Apple / macOS / iOS 磨砂玻璃视觉语言 × Self-hosted Homepage。

![tech](https://img.shields.io/badge/Vue-3-42b883) ![tech](https://img.shields.io/badge/Vite-8-646cff) ![deploy](https://img.shields.io/badge/Cloudflare-Pages-f38020)

## 特性

- **Apple Glass Design System** —— 统一 CSS 变量驱动的玻璃层级（`--glass-bg / --glass-border / --glass-blur / --glass-shadow …`），背景光球 + 玻璃层 + 内容层 + 悬浮层四层空间结构
- **Light / Dark / 跟随系统** 三种主题，首帧前解析主题无白屏闪烁，`localStorage` 持久化
- **实时搜索**：名称 / 描述 / 标签 / 分组全匹配，空分组自动隐藏，数量实时变化，玻璃 Empty State
- **内网 / 外网** iOS Segmented Control，按模式优先取 `internalUrl` / `externalUrl`
- **分组 Tag 筛选**（每组独立，同 BLNF），胶囊选中态，移动端横向滚动
- **iOS Widget 式项目卡片**：48px 柔和渐变 Icon 底座、状态小圆点、Hover 上浮 + 鼠标柔光、按压 scale(0.98) 反馈
- **设置面板**：桌面右上 Popover / 手机 Bottom Sheet，含主题、卡片尺寸（舒适 / 紧凑）、动画开关
- **响应式**：320 / 375 / 390 / 430 / 768 / 1024 / 1440 全部无横向溢出，支持 `safe-area-inset`
- **动效系统**：入场 fade + stagger（封顶延迟）、`prefers-reduced-motion` 与设置内动画开关均可关闭
- **性能克制**：仅 3 个 `radial-gradient` 背景光球（无大尺寸 `filter: blur` DOM）、无 Canvas / WebGL / 粒子

## 快速开始

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # 产物输出到 dist/
npm run preview   # 本地预览生产构建
```

## 部署到 Cloudflare Pages

### 方式一：连接 Git 仓库（推荐，push 自动部署）

1. 把本项目推送到 GitHub / GitLab
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选择仓库
3. 构建配置：
   - **Framework preset**: `Vue`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Save and Deploy**，之后每次 push 自动重新部署

### 方式二：Wrangler CLI 直接上传

```bash
npm i -g wrangler
wrangler login
npm run build
wrangler pages deploy dist --project-name dada-dashboard
```

之后绑定自定义域名即可（Pages 项目 → Custom domains）。

## 添加 / 修改项目

全部项目配置都在 **`src/data/sites.js`**，新增项目只需要在对应 `group.items` 里加一条：

```js
{
  id: "my-app",                    // 唯一标识
  name: "我的应用",                 // 名称
  description: "一句话描述",        // 描述（可搜索）
  icon: "Rocket",                  // 任意 Lucide 图标名，见 https://lucide.dev/icons
  accent: "blue",                  // 图标底色：blue | purple | cyan | teal | green | orange | pink | indigo | slate
  tags: ["工具", "效率"],           // 标签（可搜索、用于组内筛选）
  url: "https://example.com",      // 默认地址
  internalUrl: "http://192.168.1.10:3000", // 内网模式优先使用
  externalUrl: "",                 // 外网模式优先使用
  status: "online",                // online | development | experimental | offline
  enabled: true,                   // false 可临时隐藏
}
```

**地址解析逻辑**：内网模式取 `internalUrl → url → externalUrl`，外网模式取 `externalUrl → url → internalUrl`；卡片始终新标签页打开（`target="_blank" rel="noopener noreferrer"`）。

## 设置与存储

| 设置 | 值 | localStorage Key |
| --- | --- | --- |
| 主题 | `system` / `light` / `dark` | `dada-dashboard:theme` |
| 卡片尺寸 / 动画 | `comfortable` / `compact`，`true` / `false` | `dada-dashboard:settings` |
| 网络模式 | `internal` / `external` | `dada-dashboard:network` |

## 目录结构

```
src/
├── components/
│   ├── DashboardHeader.vue   # 品牌区 + 主题/设置圆形玻璃按钮
│   ├── SearchBar.vue         # 大型磨砂搜索框，⌘K / Ctrl+K，ESC 清空
│   ├── NetworkSwitch.vue     # 内网/外网 iOS Segmented Control
│   ├── SiteGroup.vue         # 分组标题 + 数量胶囊 + Tag 行 + 卡片网格
│   ├── SiteCard.vue          # 玻璃项目卡片（Icon 底座/状态/Hover/柔光）
│   ├── TagFilter.vue         # 组内 Tag 胶囊筛选，横向滚动
│   ├── ThemePopover.vue      # macOS 风格主题菜单
│   └── SettingsPanel.vue     # 设置：桌面 Popover / 手机 Bottom Sheet
├── composables/
│   ├── useTheme.js           # 主题解析 + 系统偏好监听
│   ├── useSettings.js        # 卡片尺寸 / 动画开关
│   └── useNetworkMode.js     # 内外网模式 + 地址解析
├── data/sites.js             # ★ 所有项目配置
├── views/HomeView.vue        # 页面组装 + 搜索过滤 + Empty State + Footer
├── App.vue                   # 背景光球层
├── main.js
└── style.css                 # Apple Glass 设计系统（Design Tokens）
```

## 说明

- **Safari**：所有 `backdrop-filter` 均带 `-webkit-` 前缀，iOS / macOS Safari 下玻璃效果正常
- **图标**：卡片图标通过 Lucide 的 `icons` 动态映射解析（因此 `sites.js` 里可写任意 Lucide 图标名），未匹配时回退通用图标；这也是构建产物 JS 略大的原因，个人页面经 Cloudflare CDN 缓存后无感知
- **无后端**：纯静态站点，任何静态托管都能跑，Cloudflare Pages 为默认目标
