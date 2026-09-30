# AGENTS.md — AI 协作指南

Wstudio Dashboard（原名 Dada Dashboard）——个人项目导航主页 + 自用业务工具集。纯前端 SPA，部署在 Cloudflare Pages/Workers。

## 技术栈

- Vue 3.5（`<script setup>`）+ Vite 8 + vue-router + lucide-vue-next（图标）
- Supabase（认证 + Postgres + RLS）：`src/lib/supabase.js`，环境变量 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（`.env.local`，不提交）
- 无 UI 框架：视觉是自研 **Apple 磨砂玻璃设计系统**，全部 token 在 `src/style.css`（light/dark 双主题，`data-theme` 驱动）

## 命令

```bash
npm run dev       # 开发
npm run build     # 构建（必须通过才能交付）
npm run preview   # 本地预览生产构建
```

部署：Cloudflare（Git 集成自动构建，`wrangler.jsonc` 声明静态资产目录 `dist`），push 到 main 即上线。

## 目录结构

```
src/
├── components/          # DashboardHeader / SearchBar / SiteGroup / SiteCard /
│                        # TagFilter / ThemePopover / SettingsPanel / FeatureShell /
│                        # AuthPanel / GlassDialog / AppToast / ExportMenu
│   └── inventory/       # 进销存分区组件（InvProducts/InvOrders/InvOverview/InvStock/InvReturns/InvDocuments/InvMovements）
├── composables/         # useAuth（认证）/ useTheme / useSettings / useNetworkMode /
│                        # useInventory（进销存数据层）/ useToast
├── lib/                 # supabase.js（客户端）/ tableExport.js（CSV/Excel/PDF 导出）
├── data/sites.js        # ★ 首页导航卡片配置（增删卡片只改这里）
├── views/               # HomeView / CheckInView（打卡）/ TimerView（计时器）/ InventoryView（进销存）
└── router.js            # / · /checkin · /timer · /inventory
```

## 关键约定（改动前必读）

1. **视觉**：所有新 UI 必须走 style.css 的玻璃 token（`--glass-*` / `--radius-*` / `--ease-glass`），不要引入其他风格或 UI 库。浅色深色都要适配。
2. **首页滚动 Header**（HomeView + SiteGroup）：单一 fixed 玻璃面板按 `activeSection` 数据驱动切换、Dashboard 头部用 `--collapse` 渐进折叠、分类状态存 `sectionTags[模块id]`。不要破坏这套结构，不要写死模块名。
3. **认证模型**（useAuth.js）：用户名+密码登录（内部映射 `用户名@attendance.local`）；注册后需管理员在 `profiles.approval_status` 审批；认证状态挂 `window.__dadaAuthState` 单例（防打包器复制模块导致状态分裂——勿改回模块内 ref）。
4. **进销存数据隔离**（useInventory + lib/inventoryApi）：登录用户走 Supabase，数据按**组织（店铺）**隔离——用户首次进入自动 `inventory_create_organization` 建店，隔离由 RLS 强制；**游客**走 `lib/inventoryLocal.js` localStorage 沙箱，可体验全部功能但数据不出本机。两个后端方法签名一一对应，新增功能两边都要实现。
5. **进销存写操作走线上 RPC**（`inventory_save_product` / `inventory_receive` / `inventory_stock_out` / `inventory_create_order` / `inventory_confirm_order_fulfillment` / `inventory_create_sale_return`），不要绕过 RPC 直写表（movements 等表无 INSERT 策略）。
6. **游客模式原则**：游客可浏览全部 UI、数据只存本地；点击需要云端数据/权限的功能时引导登录/注册。
7. **首页卡片**：`src/data/sites.js` 是唯一数据源（含内/外网地址、icon、accent、status、导出）。
8. 打包器会把模块复制进懒加载 chunk：进销存已在 router.js 中**静态导入**以共享 supabase 实例；新增页面若依赖认证状态，优先静态导入或使用 window 单例。

## 设计语言（Apple 风格 · 必须遵守）

整个项目的视觉目标是「如果 Apple 做一个个人 Dashboard 会是什么样」，参考 macOS/iOS Control Center、visionOS、iOS Widget：

1. **Liquid Glass 磨砂玻璃**：半透明 + `backdrop-filter: blur(20~24px) saturate(160%)` + 轻白边框 + 柔和投影 + `inset 0 1px 0` 顶部高光。禁止不透明色块和粗边框。
2. **背景层**：固定的 radial-gradient 光球（蓝/紫/青，暗色降低透明度），页面滚动不动；内容浮在玻璃层之上，形成背景层/玻璃层/内容层/悬浮层四层结构。
3. **组件语言**：iOS 原生模式——胶囊按钮、Segmented Control（滑块动画 240~300ms）、Bottom Sheet（手机端弹层，圆角 26px + 顶部把手）、下拉菜单（点击外部/ESC 关闭）、iOS 开关（绿色 #34c759）。
4. **动效**：统一曲线 `cubic-bezier(0.22, 0.68, 0.32, 1)`（松开回弹用 `cubic-bezier(0.34, 1.56, 0.64, 1)`）；按压 scale(0.94~0.98)；入场 fade + translateY + stagger（每项 30~50ms，封顶 400ms）；尊重 `prefers-reduced-motion`。
5. **字体**：系统栈 `-apple-system, 'PingFang SC'...`，数字用 `font-variant-numeric: tabular-nums`；标题粗体负字距（-0.02~-0.03em）。
6. **移动端**：`viewport-fit=cover` + `env(safe-area-inset-*)` 全站处理；搜索聚焦有独立单行 Focus Mode；暗色模式不是纯黑（#0b0c10 起）。
7. 所有 token 只从 `src/style.css` 取（`--glass-*` / `--radius-*` / `--ease-glass` / `--pill-selected-*`），浅色深色都要适配，禁止引入 UI 框架。

## 测试与技能（Skills）

- **UI 验证用 browser-use skill**（`browser-use:control-browser`）：真实浏览器打开页面截图验证，本项目所有视觉/交互都经它实测。注意其坑：
  - Playwright locator click 常超时 → 改用 `cua.click` 坐标点击（先 evaluate 取 `getBoundingClientRect` 中心）
  - `screenshot({ clip })` 的坐标是**页面坐标**不是视口坐标；截当前视口用不带 clip 的 screenshot
  - dev server（5199）有顽固模块缓存，改代码后 reload 可能跑旧脚本；可靠做法是 `npm run build` + `vite preview` **全新端口**验证生产构建
  - IAB 里 rAF 回调可能不触发，节流逻辑用「时间戳限频直接执行 + rAF 兜底」混合模式
  - evaluate 沙箱里不能用动态 `import()`，要注入 `<script type="module">` 在页面主世界执行
- **验证流程**：`npm run build` → `vite preview` 新端口 → 浏览器实测（亮/暗 × 桌面/390px × 游客/登录四象限）→ 无 console 错误 → 再交付
- 组件上的函数 `:ref` 拿到的是组件实例，取 DOM 用 `el.$el || el`；此类错误在 onMounted 内抛出只会中断后续监听器注册，页面照常渲染，极难察觉

## 已知坑

- Cloudflare Workers 构建变量必须配 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（构建时注入，非运行时）
- iPhone Safari：`viewport-fit=cover` + `env(safe-area-inset-*)` 已全站处理；搜索聚焦有独立 Focus Mode（单行 [←][搜索][取消]），改动 Sticky Header 时勿破坏
- 退货记录可见性依赖 `supabase/inventory_returns_visibility_fix.sql`（可选执行）

## 当前状态

打卡 / 计时器（游客+云端双模式）/ 进销存（11 分区全量）/ 导出（CSV/Excel/PDF）均已上线。进销存仅剩经营控制、打印设置（super_admin 设置项）未迁移。详细功能说明见 README.md。
