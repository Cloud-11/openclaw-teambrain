# GitHub 运维指南

本文定义了如何配置 GitHub，确保这个项目未来可以通过仓库约定和 GitHub CLI 实现比较完整的自动化维护。

## 1. 账号侧准备

建议仓库拥有者先完成以下配置：

- 打开 GitHub 双因素认证
- 安装 GitHub CLI
- 执行 `gh auth login`
- 配置 SSH 推送权限，最好再加上提交签名

只要这台机器上的 `gh` 已经完成认证，后续我就可以比较完整地协助处理：

- Issue 分流
- PR 审查流程
- 标签与里程碑维护
- Release 创建
- 仓库设置核对

## 2. 仓库侧初始化

创建 GitHub 仓库之后，建议立即做这几步：

1. 添加远程仓库
2. 推送 `main`
3. 确认仓库链接、`LICENSE` 和联系邮箱都正确

推荐的仓库设置：

- 默认分支：`main`
- 允许 squash merge：开
- 允许 rebase merge：开
- 允许 merge commit：关
- 自动删除已合并分支：开
- Discussions：可选，但推荐

## 3. 分支保护 / Ruleset

建议给 `main` 加上以下规则：

- 必须通过 PR 合并
- 至少 1 个审批
- 必须解决所有 review conversation
- 必须通过状态检查：
  - `Test (Node 22)`
  - `Test (Node 24)`
- 禁止 force push
- 禁止删除分支

如果你希望强制 `@cloud-11` 参与评审，就在分支保护里打开 code owner review。

## 4. Secrets 与 Environment

仓库 secrets：

- `NPM_TOKEN`：用于 npm 发布

建议增加的 environment：

- `release`
  - 可选要求人工审批后再放行正式发布

## 5. 日常维护流程

### Issue 分流

- 对 Bug 先确认是否可复现
- 缺信息就要求补充复现步骤
- 按类型和范围打标签
- 适合新人切入的任务打上 `good first issue`

### Pull Request

- 先检查 PR 模板是否填写完整
- 先看 CI，再看代码
- 审核范围、文档和发布影响
- 小而聚焦的 PR 优先 squash merge

### 发布

- 更新 `package.json` 版本
- 更新 `CHANGELOG.md`
- 创建 `vX.Y.Z` tag
- 推送 tag
- 由 `Release` 工作流自动创建 GitHub Release，并按需发布 npm

## 6. 建议创建的标签

建议的标签集合：

- `bug`
- `enhancement`
- `documentation`
- `github`
- `plugin-core`
- `release`
- `tests`
- `dependencies`
- `needs-triage`
- `good first issue`
- `help wanted`
- `breaking`

## 7. 我后续可以接管哪些 GitHub 事务

只要本机 `gh` 已认证，我可以比较稳定地协助你处理：

- 创建和编辑 Issue
- 评论和分流 Issue
- 创建和审查 PR
- 草拟 Release Notes
- 创建 Release
- 同步 labels 和 milestones

仍然建议你亲自做最终决策的事项：

- npm 包名与发布 scope
- 仓库归属到个人账号还是组织
