# ima-index.yaml Schema

素材索引权威源，位于项目仓库根。镜像页《X-资料目录.md》（ima 侧，人类可读）由每次同步自动从本文件生成。

## 字段定义

project: morsepass                    # 项目名（与 projects.yaml 一致）
remote:                               # 远端信息
  platform: github                    # github | gitee
  url: git@github.com:luojun2057/morsepass.git
ima:                                  # ima 知识库信息
  kb_id: "001a9b3079006664"           # 知识库 ID
  root_prefix: "morsepass/"           # 该项目在 ima 的路径前缀
rules:                                # 项目级分类规则（覆盖默认规则）
  - pattern: "docs/design/**"         # glob
    target: ima                       # git | ima
files:                                # 已登记文件（target: ima 的必须记录；git 类可选记录）
  - path: docs/design/iambic-mode-a.md   # 仓库内相对路径
    sha256: ab12cd34…                 # 内容哈希（变更检测依据）
    target: ima                       # 去向
    ima_path: morsepass/docs/iambic-mode-a.md  # ima 侧当前生效文件名（另存新版时更新）
    status: synced                    # synced | pending-manual
    synced_at: "2026-10-01"           # 最后同步日期
    device: SCB-159                   # 来源设备标识

## 维护规则

|||
|---|---|
|新文件走 ima|追加 files 条目，文本类 status: synced，二进制类 status: pending-manual|
|用户知会"已传"|对应条目改 status: synced + 更新 synced_at|
|文件内容变更|sha256 变化 → 重新走同步流程，更新哈希与状态|
|ima 另存新版|更新 ima_path 为当前生效文件名（时间戳后缀最大者），旧文件列入待清理清单|
|文件删除|高危动作，确认后移除条目并同步删 ima 侧（须确认）|
|用户改判|在 rules 追加对应 glob 规则|


## 变更检测

同步时对 files 中每条计算当前 sha256，与记录值比对：不一致 → 该文件需重新同步；一致 → 跳过（幂等，防重复上传）。

## 镜像页生成

《X-资料目录.md》按以下结构生成并写入 ima：

# X 项目 · 资料目录
> 自动生成，随每次同步更新，勿手改
## 分类目录
- [docs] iambic-mode-a.md — synced（2026-10-01）
- [papers] L-04.pdf — pending-manual（待手动上传）


刷新规则（v1.4，实测修正）：ima 同名保存默认另存（追加 _YYMMDDHHMMSS 后缀），"重写"不成立——刷新一律按 SKILL.md「ima 同名另存与镜像刷新策略」执行：REPLACE 策略优先；不可用时改用带日期文件名（X-资料目录-YYYYMMDD.md）；另存新版后更新本文件 ima_path 字段并在汇总表列出待清理旧版。

