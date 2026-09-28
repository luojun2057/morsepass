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

## 验收标准（阶段 G 出口）

1. 五大痛点修复项全部满足 DESIGN.md §2.2 验收标准
2. P0+P1 功能全可用，单测覆盖 core 全模块，E2E 主流程通过
3. GitHub Pages 可访问，PWA 可安装离线使用
4. 用户人工验收通过
