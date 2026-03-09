# 贡献指南

感谢你关注 `OpenClaw TeamBrain`。

## 开始之前

- 先阅读 `README.zh-CN.md`
- 如果参与维护、发版或 issue 分流，请阅读 `docs/zh-CN/github-operations.md`
- 使用 Node.js `22+`
- 先执行 `npm install`

## 开发流程

1. 从 `main` 拉出主题分支
2. 保持改动聚焦且尽量小
3. 提交前运行：
   - `npm test`
   - `npm run typecheck`
4. 使用仓库自带 PR 模板发起合并请求

## PR 期望

- 说明问题背景和方案选择
- 标出是否涉及配置或文档修改
- 行为变更时补测试或更新测试
- 不要把无关重构混进同一个 PR

## Commit 风格

建议使用简洁、动作导向的提交信息，例如：

- `feat: add project-state prompt assembly`
- `docs: add GitHub maintainer playbook`
- `ci: add release drafter workflow`

## Bug 反馈

请使用 Bug Issue 表单，并尽量提供：

- 预期行为
- 实际行为
- 复现步骤
- OpenClaw 与 Node.js 版本

## 功能建议

请使用 Feature Request 表单，重点说明：

- 你要解决的问题
- 你要优化的工作流
- 为什么它应该进入 TeamBrain，而不是一次性的本地脚本

## 安全问题

不要公开提交安全漏洞，请遵循 `SECURITY.zh-CN.md`。

## 语言规范

- 面向用户的文档维护英文和简体中文两个版本
- 代码注释保持简洁，仅解释不明显的逻辑
