# OpenClaw TeamBrain

简体中文 · [English](./README.md)

`OpenClaw TeamBrain` 是一个面向 OpenClaw 的外部团队大脑插件，用来支撑固定多 Agent 团队在多个项目之间长期协作，同时保持业务代码仓库纯净。

## 当前状态

- V1 已具备可运行的独立插件骨架
- 共享上下文通过 `context-engine` 装配
- Agent 私有上下文通过轻量 prompt hook 挂载
- 已提供 `teambrain-state` 工具，可写回 `PROJECT_STATE.md` 和 `TODO.md`
- GitHub 社区治理、CI、发布和维护者流程底座已补齐

## 为什么要用 TeamBrain

- **代码仓库纯净**：AI 记忆不写回业务仓库
- **项目隔离**：项目 A 的临时上下文不会污染项目 B
- **长期记忆**：保留团队规则、项目状态和个人档案
- **更省 token**：优先走系统级上下文追加，而不是每轮对话重复灌长文本

## 架构概览

TeamBrain 采用混合运行时设计：

- **共享上下文**：通过 `context-engine` 的 `assemble()`
- **个人上下文**：通过 `before_prompt_build`
- **预算控制**：限制单节和总注入字符数
- **优雅降级**：缺少可选文件时不报致命错误

V1 当前支持的上下文来源：

- 团队宪法
- 全局规则
- 项目状态看板
- 项目 TODO
- Agent 个人档案
- Agent 私有项目草稿

## 大脑目录约定

```text
~/.openclaw/brains/my-dev-team/
├── config/
│   ├── team-charter.md
│   └── profiles/
│       └── coder.profile.md
├── memory_global/
│   └── global_rules.md
└── projects/
    └── stardew-mod/
        ├── state/
        │   ├── PROJECT_STATE.md
        │   └── TODO.md
        └── agents_workspace/
            └── coder/
                └── notes.md
```

`agents_workspace` 也兼容 `coder_drafts`、`coder_logs` 这类兄弟目录命名。

## OpenClaw 配置示例

```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/openclaw-teambrain"]
    },
    "slots": {
      "contextEngine": "teambrain"
    },
    "entries": {
      "teambrain": {
        "enabled": true,
        "config": {
          "brainRoot": "~/.openclaw/brains",
          "teamId": "my-dev-team",
          "projectId": "stardew-mod",
          "layers": {
            "includeProfiles": true,
            "includePrivateWorkspace": true
          },
          "promptBudget": {
            "maxCharsPerSection": 3000,
            "maxTotalChars": 12000,
            "maxWorkspaceFiles": 3,
            "maxWorkspaceFileChars": 1200
          }
        }
      }
    }
  }
}
```

## 开发

```bash
npm install
npm test
npm run typecheck
```

## 状态写回工具

TeamBrain 现在提供一个 `teambrain-state` 工具。

支持的动作：

- `set_project_state`
- `upsert_todo`
- `remove_todo`

示例参数：

```json
{
  "action": "set_project_state",
  "stage": "开发中",
  "activeTasks": ["修复 18:00 崩溃", "补单元测试"],
  "summary": "Coder 已开始排查定时逻辑"
}
```

```json
{
  "action": "upsert_todo",
  "text": "修复下午 6 点崩溃",
  "done": true
}
```

## GitHub 运维底座

当前仓库已经包含：

- Bug / Feature 的 Issue 表单
- PR 模板
- 测试与类型检查 CI
- 自动 PR 标签
- Release Draft 自动生成
- Tag / 手动触发发布工作流
- Dependabot 依赖更新

## GitHub Star 历史图

```md
[![Star History Chart](https://api.star-history.com/svg?repos=cloud-11/openclaw-teambrain&type=Date)](https://star-history.com/#cloud-11/openclaw-teambrain&Date)
```

## 致谢

- [OpenClaw](https://github.com/openclaw/openclaw)：提供插件运行时、slot 体系和 context-engine 生命周期
- [Star History](https://github.com/star-history/star-history)：提供 GitHub Star 历史图服务
- GitHub 官方社区规范与 Actions 生态：为本仓库的标准化治理提供参考

## 路线图

- 增加长期检索与向量索引
- 增加多项目切换辅助工具
- 增加 TeamBrain 运维命令

## 许可证

MIT
