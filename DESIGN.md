# DESIGN.md — MorsePass v2 重写方案

> 状态：**待用户评审**（评审通过后方可进入开发）
> 日期：2026-09-28

---

## 1. 背景与目标

旧版 morsepass（github.com/luojun2057/morsepass）为平铺式原生 HTML/JS/CSS + PWA 的摩尔斯码训练网页，存在代码可维护性差、UI/交互不满意、发报输入体验差、音频延迟等问题。

**目标**：推倒重写为工程化的 Vue 3 单页应用，功能对齐旧版三大练习模式并引入主流 CW 训练软件（CW Player / LCWO / G4FON）的核心训练法，部署到 GitHub Pages，可离线使用（PWA）。

## 2. 需求范围

### 2.1 已确认决策

| 决策点 | 结论 |
|---|---|
| 重写方式 | 全部推倒重来，只保留产品思路 |
| 形态 | 纯前端 SPA，无后端 |
| 技术栈 | Vue 3 + Vite + TypeScript，无 UI 组件库（手写组件 + 原生 CSS） |
| 功能分期 | 先 P0+P1，验收后再做 P2 |
| UI | 浅色简洁工具风，重点色 + 加粗强调，卡片式布局 |
| 设备 | 桌面优先（电键输入为主），移动端可用 |
| 部署 | GitHub Pages，构建产物纯静态 |
| 验证 | AI 自主完成：单元测试 + E2E 测试 + 构建检查，无需用户手动验证核心逻辑 |

### 2.2 痛点修复清单（P0 核心验收标准）

| # | 痛点 | 新版方案 | 验收标准 |
|---|---|---|---|
| 1 | 电键=硬件模拟鼠标点击，鼠标必须停在固定位置 | **全局鼠标捕获**（见 §4.1） | 练习进行中，鼠标在页面任意非控件位置按下/抬起均触发发报；点击按钮/滑块等控件不误触发 |
| 2 | 输入多了时间线被顶出视野 | 固定尺寸 canvas 滚动渲染最近 10 秒 | 长时间练习页面高度不变，无需清空 |
| 3 | 解码结果想显示英文小写 | 解码输出统一小写，可切换 | 默认显示小写 |
| 4 | 正确率只统计"最近一段" | 双指标：**整场累计正确率**（主）+ 近 10 符实时正确率（辅） | 练习结束报告显示整场累计值，与逐符记录一致 |
| 5 | 音频与发报不同步 | 常驻振荡器 + 音量包络调度（§4.2） | keydown→出声延迟 < 30ms（受系统音频缓冲下限约束）；设置页显示实测 outputLatency |

## 3. 功能清单

### P0（本次必做）

| 模块 | 功能 |
|---|---|
| 发报训练 | 全局鼠标发报（电键模拟点击）、触屏发报、键盘按键发报（备选，可配置）；WPM / 容差 % / 音调 Hz / 音量设置；实时解码显示（小写）；固定滚动时间线（canvas，正确/超差着色）；整场统计 + 实时速度 + 双正确率；节奏错误分析；练习历史保存与回顾 |
| 听抄练习 | 素材播放（自由粘贴文本 / 随机字符组 / 单词 / 呼号 / Q码缩写）；Farnsworth 时序；听抄输入实时比对（正确/漏抄 `-`/多余 `[+N]`/错字高亮）；整场正确率 |
| 跟发练习 | 倒计时 5s → 参考电码播放 → 同步发报；实时解码比对；与发报共享输入设置 |
| 通用 | PWA 离线（vite-plugin-pwa）；设置持久化（localStorage）；响应式（桌面优先）；中文界面 |

### P1（本次做）

| 模块 | 功能 |
|---|---|
| Koch 课程 | 标准 Koch 字符序（LCWO 序），从 2 字符起步，5 字符组训练，正确率 ≥90%（可调）过关解锁新字符，进度持久化；与随机字符组训练共享解码统计 |
| Farnsworth | 字符速度（WPM）与有效速度（eWPM）分离，ARRL 间距公式 |
| 素材库 | 常用英文单词表（内置 ~300 通用 + ~200火腿常用词）；呼号生成器（真实格式 前缀+数字+后缀）；Q码/缩写库（~120 条）；混合模式 |
| 统计 | 历史记录列表 + 速度/正确率趋势图（手写 SVG 折线）；**弱项字符分析**（按字符统计错误率，提供"针对弱项加练"入口） |
| 音频 | QRM 噪声开关（白噪声 + 电平设置） |

### P2（P0+P1 验收后做，本设计预留接口）

Quiz 测验模式；QSO 通联模板；码表速查 + 文本↔摩尔斯互转器；练习音频导出 WAV；QSB 衰落；Echo 回声训练。

### 不做（P3，明确排除）

Web Serial 接物理电键、麦克风实时解码、双桨自动键（iambic）、竞赛 pileup 模拟。

## 4. 关键技术设计

### 4.1 电键输入方案（针对"电键模拟鼠标点击"）

**问题本质**：用户的物理电键经转接器输出为鼠标左键按下/抬起事件，事件发生时光标可在页面任意位置。因此**不能**把发报绑定在某个元素上，也不能只绑键盘键。

**方案：练习会话内全局指针捕获**

```
练习进行中：
  window.addEventListener('pointerdown' / 'pointerup', handler, { capture: true })
  handler:
    if (target.closest('button, input, select, textarea, label, a, [data-no-key]'))
      → 交还默认行为（按钮可用，不误触）
    else
      → preventDefault()（抑制文本选择/拖拽）
      → 触发 key-down / key-up 事件（带 performance.now() 时间戳）
```

- 支持配置监听哪个鼠标键（默认左键 0；若转接器输出右键可切 2，并抑制 contextmenu）
- 触屏：pointerdown/up 同源支持，移动端整页（非控件区）即发报面
- 键盘按键保留为独立输入源（`keydown/keyup`，忽略 `e.repeat`），供无电键用户使用
- 输入源抽象为 `KeyInputSource` 接口（`onDown/onUp` 回调 + `activate/deactivate`），练习页面按设置装配，三类输入源可共存
- 练习中 body 加 `user-select: none`，避免拖选干扰

### 4.2 音频引擎（低延迟）

```
AudioContext（首次用户手势时创建并 resume，常驻）
  └─ OscillatorNode（sine，频率=toneHz，启动后不停）
       └─ GainNode（空闲时 0）
            key-down: cancelScheduledValues → setValueAtTime(当前值) → linearRampToValueAtTime(vol, now+attack=3ms)
            key-up:   linearRampToValueAtTime(0, now+release=5ms)
```

- 全部调度基于 `ctx.currentTime`，杜绝"每次按键新建振荡器"的启动延迟
- 挂起状态（浏览器自动播放策略）在练习启动手势中 resume，失败则提示点击
- 诊断面板显示 `ctx.baseLatency` / `ctx.outputLatency`（支持的浏览器）
- 播放（听抄/跟发）与发报共用同一引擎，播放按调度表逐符号排程（提前批量 schedule gain 包络）

### 4.3 解码器（纯逻辑，无 DOM 依赖）

- 状态机：down/up 时间戳 → 符号时长 → `dit`(<2×Td)/`dah`(≥2×Td)；up 后间隙计时 → 字符边界(3Td)/单词边界(7Td) → 查表出字符
- Td（dit 时长）= 1200 / 字符WPM (ms)；Farnsworth 时 eWPM 仅影响间隙期望值
- 节奏判定：|实测 − 期望| ≤ 期望 × 容差% 记为准确（仅用于评分着色，不影响解码）
- 输出统一小写（`toLowerCase`），可切换大写显示

### 4.4 时间线（固定画布）

- `<canvas>` 固定高度，requestAnimationFrame 渲染最近 10s 的信号带：高电平段=按下，颜色按节奏判定（绿=准确/红=超差）
- 横轴随时间推进左移，旧信号自然滚出视野，DOM/内存不随练习时长增长

### 4.5 比对算法（听抄/跟发）

- 参考文本与用户输入均归一化（大写比较、小写显示）
- 基于 LCS 的字符对齐 diff → 标注：正确（绿）/ 错字（红，附期望字）/ 漏抄（`-`）/ 多余（`[+N]` 语义同旧版，样式灰红）
- 整场正确率 = 对齐后正确字符数 / 参考字符数

### 4.6 Koch 课程

- 字符序（LCWO）：`K M R S U A P T L O W I . N J E F 0 Y , V G 5 / Q 9 Z H 3 8 B ? 4 2 7 C 1 D 6 X`
- 规则：当前课程含前 N 个字符（初始 2）；每次课程练习 ≥5 组 5 字符组；正确率 ≥90%（可调，含连续次数可调）→ 解锁下一字符；进度 localStorage 持久化
- 过关判定复用发报/听抄统计模块

### 4.7 数据模型（localStorage）

```ts
interface GlobalSettings {
  inputSource: { mouse: { button: 0 | 2 }; key: { code: string } | null };
  toneHz: number;            // 300–1000，默认 700
  volume: number;            // 0–1，默认 0.5
  displayCase: 'lower' | 'upper';
}
interface TimingSettings { wpmChar: number; wpmEff: number; tolerancePct: number; }
interface SessionRecord {
  id: string; date: ISO; mode: 'send'|'receive'|'follow'|'koch';
  wpmChar: number; wpmEff: number; toneHz: number; durationMs: number;
  charsTotal: number; charsCorrect: number; accuracyPct: number;
  symbolAccuracyPct: number;                    // 节奏准确率（send/follow）
  weakChars: { ch: string; correct: number; total: number }[];
}
interface KochProgress { unlocked: number; history: { date: ISO; accuracy: number; passed: boolean }[]; }
// keys: mp.settings / mp.timing.<page> / mp.history(上限200) / mp.koch
```

### 4.8 页面与路由

| 路由 | 页面 | 内容 |
|---|---|---|
| `/send` | 发报训练 | 参数区 + 实时解码 + 时间线 + 整场统计 + 历史记录 |
| `/receive` | 听抄练习 | 素材选择/粘贴 + 参数 + 播放控制 + 输入比对 + 统计 |
| `/follow` | 跟发练习 | 同听抄 + 发报面 + 实时解码比对 |
| `/koch` | Koch 课程 | 课程进度 + 训练（听抄式）+ 过关状态 |
| `/stats` | 统计 | 历史列表 + 趋势折线 + 弱项分析 |
| `/tools` | 工具（P2 预留） | 码表 / 互转器 |

- 顶部导航栏；每页参数就地展示（同旧版习惯），持久化
- 浅色主题令牌：bg `#f6f7f9` / 卡片 `#ffffff` / 文字 `#1f2329` / 重点色 `#2f6fed` / 成功 `#2e9e5b` / 危险 `#d64545` / 边框 `#e5e8ec`；强调一律"重点色+加粗"，不用大面积色块

### 4.9 目录结构

```
morsepass/
├─ index.html / package.json / vite.config.ts / tsconfig.json
├─ .github/workflows/deploy.yml        # push main → build → GitHub Pages
├─ src/
│  ├─ main.ts / App.vue / router/index.ts
│  ├─ core/                            # 纯 TS 逻辑层（无 DOM/Vue 依赖，可单测）
│  │  ├─ morse/{codec,decoder,timing,farnsworth}.ts
│  │  ├─ audio/engine.ts
│  │  ├─ input/keying.ts               # KeyInputSource + 三种输入源
│  │  ├─ practice/{material,stats,compare,koch}.ts
│  │  └─ storage/persist.ts
│  ├─ composables/                     # useKeyer / useSession / useSettings
│  ├─ components/                      # TimelineCanvas / ParamRow / AccuracyPanel / ResultDiff ...
│  ├─ views/{SendView,ReceiveView,FollowView,KochView,StatsView}.vue
│  └─ styles/{tokens.css,base.css}
├─ tests/                              # Vitest 单测（core 层全覆盖）
└─ e2e/                                # Playwright E2E
```

## 5. 验证与测试策略（AI 自主验证）

| 层级 | 工具 | 覆盖 |
|---|---|---|
| 单元测试 | Vitest | codec 全字符表回转；decoder 状态机（合成时间戳序列 → SOS/单词边界/容差判定）；Farnsworth 公式；素材生成器（种子随机确定性）；比对 diff 各情形；统计（累计 vs 滑动窗）；Koch 过关逻辑；存储适配器（mock localStorage） |
| 音频调度 | Vitest（mock AudioContext 假时钟） | 包络调度调用序列、attack/release 时值、挂起恢复逻辑（真实听感由用户人工确认） |
| E2E | Playwright（Chromium） | 发报：注入 pointerdown/up 序列 → 断言解码显示小写、时间线画布尺寸不变、整场统计正确；听抄：高 WPM 短文本播放（禁自动播放策略）→ 输入 → 断言比对标注；跟发/Koch 冒烟；PWA/构建：`build + preview` 断言 base 路径资源 200 |
| 构建门禁 | `vue-tsc --noEmit` + vite build | 类型零错误、构建通过 |
| 人工确认项 | 用户 | 真实电键手感、音频延迟主观感受、UI 审美——发布预览链接后由用户验收 |

- 测试钩子：组件带 `data-testid`；素材生成器暴露种子注入；`window.__mp_test__` 提供 AudioContext stub 入口
- Playwright 浏览器安装走国内镜像（`PLAYWRIGHT_DOWNLOAD_HOST`），失败时降级为"仅单测 + 构建检查"并在报告中注明

## 6. 部署方案

- GitHub Actions：push 到 main → `npm ci && npm run build` → `actions/upload-pages-artifact` + `deploy-pages`
- Vite `base` 按仓库名设为 `/morsepass/`（若改仓库名需同步改 base，集中在 `vite.config.ts` 一处，读环境变量可覆盖）
- PWA：`vite-plugin-pwa`（Workbox precache 全量静态资源），scope 含子路径

## 7. 风险预演

| 风险 | 影响 | 缓解 |
|---|---|---|
| 浏览器自动播放策略拦截 AudioContext | 静音 | 练习启动必经用户点击，此时 resume；失败给提示条 |
| 电键转接器抖动（接触弹跳） | 误判碎点 | 解码器加 5ms 最小符号宽度去抖（可调） |
| 键盘长按自动重复 | 误触发 | 忽略 `e.repeat` |
| GitHub Pages 子路径资源 404 | 白页 | base 集中配置 + preview 冒烟断言 |
| 切换窗口/失焦时间戳断层 | 统计失真 | visibilitychange 时暂停会话计时（提示） |
| localStorage 清空丢进度 | 数据丢失 | 历史支持导出 JSON（P2 一并做导出/导入） |

## 8. 待确认项（进入开发前需明确）

1. **项目目录**：默认建在 `C:\xiangmu\morsepass`（与 vaccine-news 同级），是否 OK？
2. **仓库名**：新建仓库仍叫 `morsepass`（覆盖旧仓库推送）还是 `morsepass-v2`？影响 Pages base。
3. 素材默认英文（单词/呼号/Q码），不做中文电码本——确认？
4. Koch 过关线默认 90%、每次课程 5 组——用默认即可？
