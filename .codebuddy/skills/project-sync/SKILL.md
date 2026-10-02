---
name: project-sync
description: 项目工作流同步技能（Git + ima 知识库双轨 + WorkBuddy 项目协作层）。当用户表达以下意图时使用："开启项目 X"（自动建 Gitee/GitHub 私有仓 + ima 项目主页）、"基于/继续 X 项目开展工作"（冷启动恢复上下文、输出开工简报、任务分支就位）、"上传 Git / 同步"（分类分流提交到任务分支、更新项目状态与双索引）、"合并 feat/xxx / 允许合并"（变更报告确认后进 main）、"X 文件在哪 / 查索引"、"我的项目总览"。适用于多电脑共用项目、代码走 Git 分支、素材走知识库的场景。
---

# project-sync：项目工作流同步



版本 v1.4（2026-10-02）：新增「ima 同名另存与镜像刷新策略」（实测修正：同名保存另存不覆盖，追加 _YYMMDDHHMMSS 后缀）。

## 核心模型

每个项目由三文件一注册管理：

||||
|---|---|---|
|PROJECT.md|项目仓库根|项目状态权威源（阶段/待办/进展/分支映射/待合并清单）|
|ima-index.yaml|项目仓库根|素材索引权威源（Git↔ima 文件映射，含 sha256 变更检测）|
|《X-项目主页》|ima 知识库|冷启动唯一入口（镜像，每次同步后刷新）|
|projects.yaml|本技能目录|全局项目注册表（设备本地一份）|


分支策略：任务分支制——一事一支（feat/英文短名），所有提交进任务分支，main 只进用户授权合并的成果。

## 私密性强制条款（不可覆盖）

- 远端仓库一律私有：建仓必须 private=true（Gitee）/ --private（GitHub）；任何情况下不得创建公开仓库，即使用户口误"建个仓库"也默认私有并提示；
- ima 仅用个人（私有）知识库：项目主页、资料目录只写入用户个人知识库；绝不对 ima 内项目文件使用"分享"生成公开链接；
- WorkBuddy 项目同样确认为私有/仅自己可见（含协作伙伴时按最小授权）；
- 若发现项目已存在于公开仓库/公开知识库，同步前必须提醒用户转私有。
## 触发流程

### 1. 开启项目 X

- 查 projects.yaml 确认平台与默认配置（默认 Gitee；已有项目按实际远端）；
- 建远端私有仓（高危动作，先列出仓库名/平台/可见性，等用户放行）：Gitee POST https://gitee.com/api/v5/user/repos（access_token、name、private=true）或 GitHub gh repo create X --private；
- 本地 git init + 关联 remote + 首次 commit 到 main；
- 生成三文件骨架（模板见 references/project-md.md、references/index-schema.md）；
- ima 写入《X-项目主页》；
- 登记 projects.yaml（项目名/平台/repo/本地路径/ima 前缀）；
- 建议用户在 WorkBuddy 创建同名项目并注入项目指令（协作层）；
- 输出就位确认：repo 地址 + ima 位置 + 建议首个任务分支。
### 2. 继续项目 X / 基于 X 继续

- 快速模式（本地已有仓，注册表可查）：git pull --rebase → 读 PROJECT.md + ima-index.yaml；
- 冷启动模式（本地无仓）：优先查 projects.yaml 注册表（repo 地址电话簿）→ git clone → 读两文件；注册表查不到时，ima 知识库检索《X-项目主页》兜底；
输出开工简报（固定格式）：

【X 项目 · 开工简报】
当前阶段：…
最近进展：最近 3 条
待办：…
进行中分支：feat/xxx（来自电脑A，2026-10-01）→ 可接续
待合并分支：feat/yyy（3 commits，待验收）
建议：新任务建 feat/zzz / 接续 feat/xxx

分支就位后开始工作。

### 3. 上传 Git / 同步

- 写前重读（多设备并发保护）：先 git pull --rebase，重读 PROJECT.md 与 ima-index.yaml 最新状态，再基于最新状态执行后续步骤——防止覆盖其他设备刚提交的进展/索引；
- git status 扫描变更；
- 按 references/classify-rules.md 分流；
- Git 类：add + commit（规范中文消息）+ push 当前任务分支；
- ima 文本类：写入 ima（前缀 X/）→ 索引记 status: synced；覆盖 ima 已有同名文件前须确认；
- ima 二进制类：出待传清单（目标 ima 路径 + 命名规则 + WorkBuddy 产物区上传指引），用户知会"已传"后索引闭环 status: synced；
- 自动追加 PROJECT.md 进展（一行摘要 + 日期 + 设备标识，保留最近 10 条；满额归档至 progress-archive.md）；
- 刷新 ima《X-项目主页》与《X-资料目录》镜像（按「ima 同名另存与镜像刷新策略」执行：REPLACE 优先；另存新版时更新索引内 ima_path 并在汇总表提示清理旧版）；
- 输出同步汇总表：文件 / 去向（git·ima·待传）/ 状态 / 分支 / commit 短哈希。
### 4. 合并 feat/xxx / 允许合并（授权动作，必经确认）

- 输出变更对照报告：commit 列表 + 文件变更摘要 + 提示验收要点；
- 用户确认后执行；
- 先把 main 最新变更 rebase 进待合并分支；冲突即停，输出冲突清单，不擅自改；
- merge 到 main + push；
- 删除任务分支（远端 + 本地）；
- 更新 PROJECT.md（进展归档、分支映射清理、待合并移除）+ 刷新 ima 主页（按镜像刷新策略）；
- 输出合并报告。
变体："发 PR"——不本地合并，push 分支后给出平台 PR 创建链接。

### 5. X 文件在哪 / 查索引

读 ima-index.yaml，直接回答：文件位置（Git 或 ima 路径）、同步状态、最后同步时间。

### 6. 我的项目总览

扫 projects.yaml 中各项目 → 读各仓 PROJECT.md → 输出一表：项目 / 阶段 / 进行中分支 / 待合并分支 / 最近进展。

## 确认机制

- 全自动：commit、push 任务分支、写 ima 新文件、更新三文件与镜像；
- 必拦确认：新建远端仓库、删除文件、覆盖 ima 已有同名文件、合并到 main；
- 用户明说"本轮免确认"→ 全程直通（合并 main 除外）；
- 每次同步后必给汇总表（信任但验证）。
## 敏感措辞规范（强制）

投诉材料、POV、竞品相关项目：PROJECT.md、ima 主页、commit message 一律中性措辞（如"合规调研""数据整理"）；敏感细节只存在于文件本体，文件本体只进私有仓或 ima 私有知识库，绝不出现在简报/主页/索引的描述性文字里。

## 凭证安全（强制）

- GITEE_TOKEN、GitHub PAT：仅从环境变量或系统凭据管理器读取；
- 绝不写入仓库、skill 文件、日志或对话输出；
- token 失效时提示用户更新，不代管明文。
## 部署层级（v1.3 新增）

- 首选·项目级：本技能随项目仓库 .codebuddy/skills/project-sync/ 分发（可提交版本控制、随 clone 共享），WorkBuddy 按项目级 > 用户级优先自动加载——多设备部署从"安装"简化为"clone 即就位"（试点验证中）；
- 兜底·用户级：从 ima 知识库取装（前缀 project-sync/，5 文件，projects-yaml.md 需解包为 .yaml；同名多版本时取时间戳后缀最大的最新版）到 ~/.codebuddy/skills/；
- 两级并存时同名技能项目级优先；接入新项目时，若仓库含 .codebuddy/skills/project-sync/ 则跳过用户级安装。
## ima 同名另存与镜像刷新策略（v1.4，实测事实）

已验证事实（2026-10-02 试点发现）：ima 保存接口对同名文件默认另存不覆盖，自动追加 _YYMMDDHHMMSS 时间戳后缀（实证：project-sync/SKILL.md 与 project-sync/SKILL_261002002753.md 并存）。"重写/更新镜像"在此行为下不成立，一律按以下策略执行：

- REPLACE 优先：执行环境的 ima 保存接口若支持覆盖/替换策略参数，必须显式传入——镜像页、项目主页等高频更新文件强制要求；REPLACE 可用性须在设备端首用时验证一次；
- 读取最新版：另存行为下，同名文件以时间戳后缀数字最大者为最新（无后缀的原始文件名最旧）；安装任务取装、冷启动检索一律按此规则取文件；
- 版本化文件名兜底：REPLACE 不可用且更新频繁的文件（镜像页/资料目录），改用带日期文件名（X-资料目录-YYYYMMDD.md）自然按日归档，避免单日内堆积；
- 待清理提示：每次另存新版后，在同步汇总表中列出被取代的旧文件名清单，提示用户在 ima App 手动删除；
- ima-index.yaml 的 ima_path 记录当前生效文件名，另存新版时同步更新该字段。
### 设备端验证记录（SCB-159，2026-10-02）

- **REPLACE 可用性：已实证可用**。`add_knowledge` 显式传 `duplicate_name_strategy=DUPLICATE_NAME_STRATEGY_REPLACE` 时**真覆盖**：同名条目标题不变（不追加 `_YYMMDDHHMMSS`）、条目数不增、`media_id` 换为新值、旧 `media_id` 失效、内容已更新。→ 镜像页 / 项目主页 / 资料目录刷新可直接走 **REPLACE**，无需退化为带日期文件名。
- **默认策略对照**：不传该参数时默认 `SAVE`（另存 + 时间戳后缀），即 v1.4 已实证的旧行为。
- **项目级技能加载路径**（依据本机 CLI 明文源码 `cli/dist/codebuddy.js` 的 `getSourcePaths`）：`project` → `.codebuddy/skills, .codebuddy/commands`；`user` → `~/.codebuddy/skills`（本机实测 `~/.workbuddy/skills/` 亦被扫描）。故仓库内项目级副本放 `<仓库根>/.codebuddy/skills/project-sync/` 正确。
- **注意**：技能索引是**会话启动快照**，会话中途新增/替换技能不会被已开会话感知；项目级优先级验证必须在**新开会话**（且不装用户级同名技能）中进行。
- **push 通道**：本机 git 走 HTTPS 推 GitHub 会被网络层间歇重置（`Recv failure`/`Empty reply`/`Failed to connect`），**不是**沙箱策略也**不是**凭据问题（同时刻 python TLS 到 github.com 正常）。重试若被 timeout 杀掉，进程**可能已在服务端完成**——先查远端 ref 再判定失败。彻底绕行见技能 `github-push-via-api`（REST API 原样复刻 commit，tree/commit 双哈希可校验一致；分支已存在时走 PATCH 快进）；合并阶段更新 main 用同一脚本 `--branch main` 即可。
- **本机 .git 引用异常（2026-10-02 实测复现）**：嵌套形式的引用（`refs/heads/<带斜杠分支>`、`refs/remotes/origin/**`）在 git 写入后会被**外部异步删除**，`git update-ref` 会**静默失败**（退出码 0 但 ref 不存在）；`refs/heads/main` 不受影响。故本机执行分支制流程时：① 提交后立即用 python 写引用文件（**必须完整 40 位 sha**）；② 关键节点 `git bundle create --all` 兜底；③ 收尾用 `.git/packed-refs` 固化。commit 对象不会丢。
- **ima 技能回同步**：本地技能更新后，用 `ima-kb-write` 对 `project-sync/SKILL.md`、`references/*`、`projects-yaml.md`（.yaml 需 .md 包装）逐一 **REPLACE**；已实证连续 REPLACE 后知识库条目数不增长。ima 侧历史另存副本（`SKILL_YYMMDDHHMMSS.md` 等 11 个）属待清理项，需在 ima App 手动删除。

## References

- 分类分流规则：references/classify-rules.md
- ima-index.yaml schema：references/index-schema.md
- PROJECT.md 模板与规范：references/project-md.md
