# TASK.md — MorsePass v2 任务拆解

> 依赖 DESIGN.md 评审通过后执行。每项完成后勾选。
> 每阶段完成即汇报，阶段间设确认检查点。

## 阶段 A：脚手架与核心逻辑（P0）

- [x] A1. Vite + Vue3 + TS 脚手架：目录结构、`vite.config.ts`（base 可配）、ESLint 可选、`.gitignore`、README
- [x] A2. `core/morse/codec.ts`：字符↔摩尔斯码表（字母/数字/常用标点/prosign）+ 回转测试
- [x] A3. `core/morse/timing.ts`：Td 计算、dit/dah 边界、容差判定、Farnsworth 间距（ARRL 公式）+ 测试
- [x] A4. `core/morse/decoder.ts`：down/up 时间戳状态机（去抖 5ms、字符/单词边界、小写输出）+ 合成序列测试（SOS、多词、容差着色）
- [x] A5. `core/practice/material.ts`：生成器（随机字符组/单词表/呼号/Q码缩写/混合/自由文本），种子随机 + 测试
- [x] A6. `core/practice/compare.ts`：LCS 对齐 diff（正确/错字/漏抄/多余）+ 全情形测试
- [x] A7. `core/practice/stats.ts`：整场累计 + 近10符滑动窗 + 弱项字符统计 + 测试
- [x] A8. `core/storage/persist.ts`：localStorage 适配（settings/timing/history/koch，history 上限 200）+ mock 测试

## 阶段 B：音频与输入（P0）

- [x] B1. `core/audio/engine.ts`：常驻振荡器 + 包络调度、手势 resume、延迟诊断数据 + mock AudioContext 测试
- [x] B2. `core/input/keying.ts`：KeyInputSource 抽象 + 鼠标全局捕获（控件排除/preventDefault/contextmenu 抑制）+ 键盘源（ignore repeat）+ 触屏源 + 单测
- [x] B3. `composables/useKeyer` + `useSettings`：装配输入源→音频引擎→解码器链路

## 阶段 C：发报训练页（P0）

- [x] C1. `SendView` 骨架：参数区（WPM/容差/音调/音量/输入源/按键配置）、开始/结束
- [x] C2. `TimelineCanvas`：固定画布 rAF 渲染最近 10s，准确绿/超差红，永不撑高
- [x] C3. 实时解码显示（默认小写）+ 实时 WPM + 双正确率徽章
- [x] C4. 整场统计报告（结束弹出/内嵌）+ 节奏错误分析文案
- [x] C5. 练习历史（本页 5 条 + 全量进 /stats）
- [x] C6. 单测补充 + 页面 E2E（pointer 序列→解码→统计断言）

## 阶段 D：听抄与跟发（P0）

- [x] D1. `ReceiveView`：素材区（粘贴 + P1 生成器占位 tab）+ 播放调度 + 听抄输入 + `ResultDiff` 比对展示 + 整场正确率
- [x] D2. `FollowView`：5s 倒计时 → 播放 + 同步发报 → 解码比对 → 统计
- [x] D3. 播放调度器（逐符号 gain 排程、Farnsworth 间隙、可中途停止、进度高亮）
- [x] D4. E2E：听抄短文本高 WPM 播放→输入→断言比对；跟发冒烟

## 阶段 E：通用能力（P0）

- [x] E1. 路由 + 顶部导航 + 浅色主题令牌（tokens.css）
- [x] E2. 设置持久化贯通（各页参数独立保存）
- [x] E3. PWA（vite-plugin-pwa，图标、manifest、离线缓存）+ 构建级验证（manifest/sw/图标 200 断言；Lighthouse 冒烟未单独跑）
- [x] E4. `vite build + preview` 资源 200 断言（base 路径验证）

## 阶段 F：Koch 课程与统计（P1）

- [x] F1. `core/practice/koch.ts`：LCWO 字符序、过关规则（≥90%，5 组/课，连续达标次数可调）+ 测试
- [x] F2. `KochView`：进度显示 + 听抄式训练 + 解锁流转 + 进度持久化
- [x] F3. 素材库扩充接线：单词表 / 呼号生成 / Q码库接入听抄与 Koch
- [x] F4. `StatsView`：历史列表 + SVG 趋势折线（速度/正确率）+ 弱项字符分析 + "针对弱项加练"入口
- [x] F5. QRM 噪声（白噪声节点 + 电平滑块，发送/播放链路可选叠加）

## 阶段 G：收尾与发布（P0+P1 验收）

- [x] G1. 全量回归：`vue-tsc` + vitest（70/70）+ E2E（4/4）全绿
- [x] G2. GitHub Actions 部署工作流（Pages）
- [x] G3. README（使用说明 + 部署说明）+ 交付摘要
- [ ] G4. 用户人工验收（电键手感 / 音频延迟 / UI）→ 收集反馈进 P2 迭代

## 阶段 H：P2 功能（验收反馈迭代）

- [x] H1. Koch 课程中途停止修复：三态按钮（开始 / 结束并评分 + 放弃本轮）、评分定时器可取消（sessionSeq 失效）、卸载清理
- [x] H2. 码表互转器：`core/morse/convert.ts`（文本↔摩尔斯，" / " 分词、全角点划兼容、□ 占位）+ 工具页 + 测试
- [x] H3. WAV 导出：`core/audio/wav.ts`（16bit 单声道 PCM，与播放一致的 4ms/5ms 包络，采样率可选）+ 工具页 + 下载 E2E
- [x] H4. QSO 模板生成：CQ 呼叫 / 回应呼叫 / 信号报告 / 设备天气 / 致谢结束，素材生成器新增 tab + 测试
- [x] H5. QSB 衰落：engine 串接 qsbGain 节点，播放链路随机慢速起伏（发报按键不受影响），挑战页开关
- [x] H6. 听选 Quiz：`core/practice/quiz.ts`（出题 + 干扰项）+ 挑战页（四选一、计分）+ E2E
- [x] H7. Echo 回发：播放 → 自动进入复述 → 字符凑齐 1.2s 自动评分（手动兜底）→ LCS 差异反馈 + 测试
- [x] H8. 音量滑块修复：ParamSlider 增加 scale（0-1 ↔ 0-100），四处视图拖动音量不再被钳到最大
- [x] H9. 全量回归：vue-tsc 干净 + vitest（107/107）+ E2E（10/10）全绿

## 阶段 I：对照发报按组验证 + 素材扩展（用户需求迭代）

- [x] I1. 词级比对 `compareByWords`：`core/practice/compare.ts` 追加词级 LCS 对齐；`strict`（呼号/通联/数字组全等配对）与 `fuzzy`（字符 LCS 相似度 ≥0.6 配对，容忍文章中间错漏）双模式；连续 ≥2 词匹配标记 `block`（大片对得上高亮）；多余输入收进 `extraWords`
- [x] I2. 素材扩展：`MaterialKind` 新增 `digits`（4 字一组纯数字，组宽 2-8 可调）与 `article`（大段英文文章，≥20 词，fuzzy 验证）；素材选择器新增 tab 与提示
- [x] I3. 发报对照页 chips UI：逐组结果色块（match/wrong/missed/extra + block 深色底）、组/词正确率与对错漏多徽章、图例、折叠逐字符 diff
- [x] I4. 测试与回归：compare.spec 9 个词级用例、material 数字组/文章用例、E2E 数字组生成用例；vue-tsc 干净 + vitest（118/118）+ E2E（11/11）全绿

## 阶段 J：布局改版 + 音频包络修复（原型确认后实施）

- [x] J1. 发报页分区模型：设置区/功能区分离——练习中设置区折叠为摘要条（点开可调参数）；功能区左右分栏（左素材卡：已发高亮+当前位置下划线+自动滚动跟随+进度；右实时发报+比对 chips）；自由模式单栏居中放大；⛶ 全屏练习（Fullscreen API）；结束练习弹出报告弹窗
- [x] J2. 听抄页：移除素材预览卡；设置区合并素材生成+播放设置，右侧听抄输入功能区
- [x] J3. 播放声音修复：`scheduleTones` 缺平台保持段导致符号期间音量持续衰减 + 消音仅 2ms——抽出 `buildGainSchedule` 梯形包络纯函数（attack 5ms → hold → release 6ms，短符号 clamp），发报/播放/WAV 三处统一；wav.ts 升级升余弦整形（ARRL 5ms / W8JI 6-7ms 依据）
- [x] J4. 测试与回归：buildMaterialSpans 5 用例、gain.spec 6 用例；E2E 适配分区布局（未开始无时间线画布、stop 后功能区卸载）；vue-tsc 干净 + vitest（129/129）+ E2E（11/11）全绿；原型 prototype-layout.html 先行确认，用户听验通过

## 阶段 K：自动键（iambic 双桨，设计方案确认后实施）

- [x] K1. 设置层：`keyerMode`（手动/自动）+ `paddleDitKey`/`paddleDahKey` 双桨键盘绑定 + `paddleReverse` 点划互换 + `keyerStyle`（Mode A/B）；`SessionRecord.keyerMode` 快照
- [x] K2. 引擎层：`core/keyer/auto.ts` AutoKeyer 状态机（虚拟手）——`nextElement` 纯函数（双桨交替/单桨重复/对方切换/Mode A 松手即停/Mode B 挤压记忆补发）；点 1Td、划 3Td、间隙 1Td；间隙中松手 Mode A 取消排队元素（Curtis A 精确语义）、Mode B 补发照常；练习中调速实时生效
- [x] K3. 输入层：createMouseSource 改用 mousedown/mouseup（Chromium 鼠标为单一 pointer，多按钮按压时 pointerdown 不重复派发，无法区分双桨）；useKeyer 按 keyerMode 装配双桨（鼠标左=划/右=点 + 键盘双桨键，reverse 交换映射）；触屏双桨本轮不做
- [x] K4. UI：发报页电键卡加 手动键/自动键 tabs（练习中随设置区折叠锁定）；自动键 tab：点桨/划桨行（默认 鼠标右=点、左=划 + 键盘绑定）+ ⇄点划互换 + iambic Mode A/B 选择；摘要条带模式；跟发页经共享引擎自动获得
- [x] K5. 测试与回归：autokeyer.spec 18 用例（nextElement 分支 + fake timers 时序 + Mode A/B 对照 + 调速/中断/停后忽略）；E2E autokeyer 5 用例（右点左划/按住重复/挤压 A=a B=r/互换/键盘双桨）；vue-tsc 干净 + vitest（147/147）+ E2E（16/16）全绿

## 阶段 L：时间线可视化修复（点划粘连）

- [x] L1. 根因：`TimelineRecord.t` 是符号「抬起时刻」，渲染却当「按下时刻」用——每条色带右移自身时长，划→点必重叠（粘连）、点→划间隙虚增 2Td；`computeTimelineWindow` 同步修正（lastEnd = 抬起时刻）
- [x] L2. 色带画回真实按压区间 `[t−时长, t]`，间隙还原为真实值；最小条宽 2px→1px（不再吃掉快速发报的真实间隙）
- [x] L3. 窗口按点长自适应：`timelineWindowMs(wpm)`（140Td 宽 + 25Td 尾部）替代固定 10s——发越快画布分辨率越高，间隙像素占比与速度无关
- [x] L4. 抬起基线（key-up 电平线，CW Player 等 keying 波形画法）+ 字符间隙标记（相邻符号间隙 ≥ 2Td 淡色标出，用户确认加）
- [x] L5. 各视图传 wpm（SendView×2 / FollowView / KochView）；timelineWindowMs 3 用例 + 窗口语义断言更新；keying.spec 事件名补正（mousedown/mouseup，上轮 pointer 遗留导致误报绿）；TSC 干净 + vitest 150/150 + E2E 16/16

## 阶段 M：空闲压缩 + 节奏问题汇总（用户使用反馈）

- [x] M1. 空闲间隙压缩：`compressIdleGaps` 纯函数——相邻符号空闲 >3s 压缩为 600ms 显示宽度，恢复发报后之前的节奏不滚出视野；`mapRealTime` 供网格线映射（压缩区间内跳过）
- [x] M2. 画布集成：窗口/色带/字符间隙标记全部走压缩映射；≥3s 的停顿作为「场次分隔」不再标字符间隙色
- [x] M3. 节奏问题汇总：`core/practice/rhythm.ts` `analyzeRhythmIssues` 纯函数——8 类问题（点/划、字符内间隔/字符间隔 各自太短/太长）按次数降序，含平均偏差%；间隔期望按 <2Td→1Td、2~5Td→3Td、≥5Td→7Td 分类；useKeyer 报告接入
- [x] M4. ReportCard 报告卡：汇总表格（问题类型/次数/平均偏差，偏差正红负蓝）；全容差内时提示「可以尝试提高速度」
- [x] M5. 测试：compressIdleGaps 5 用例 + mapRealTime 3 用例 + rhythm 9 用例；TSC 干净 + vitest 167/167 + E2E 16/16 全绿

## 验收标准（阶段 G 出口）

1. 五大痛点修复项全部满足 DESIGN.md §2.2 验收标准
2. P0+P1 功能全可用，单测覆盖 core 全模块，E2E 主流程通过
3. GitHub Pages 可访问，PWA 可安装离线使用
4. 用户人工验收通过
