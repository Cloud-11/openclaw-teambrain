# Neige

简体中文 · [English](./README.md)

`Neige` 是一个构建在 OpenClaw 之上的长期多 Agent 协作系统，用来支撑固定团队在多个项目之间长期协作，同时保持业务代码仓库纯净。

## 当前状态

- V1 已具备可运行的独立插件骨架
- 共享上下文通过 `context-engine` 装配
- Agent 私有上下文通过轻量 prompt hook 挂载
- 已提供 `neige-state` 工具，可写回 `PROJECT_STATE.md` 和 `TODO.md`
- V2 已增加紧凑写回协议注入，并支持运行时 `tokenBudget` 限流
- V3 已增加角色化写回协议和共享状态目录锁
- V4 已支持角色映射和角色协议策略配置化
- Task 1 已补齐本地初始化、项目切换和健康检查命令入口
- GitHub 社区治理、CI、发布和维护者流程底座已补齐

## 为什么要用 Neige

- **代码仓库纯净**：AI 记忆不写回业务仓库
- **项目隔离**：项目 A 的临时上下文不会污染项目 B
- **长期记忆**：保留团队规则、项目状态和个人档案
- **更省 token**：优先走系统级上下文追加，而不是每轮对话重复灌长文本

## 架构概览

TeamBrain 采用混合运行时设计：

- **共享上下文**：通过 `context-engine` 的 `assemble()`
- **个人上下文**：通过 `before_prompt_build`
- **预算控制**：限制单节和总注入字符数
- **运行时预算收紧**：`assemble(tokenBudget)` 可进一步压缩共享上下文
- **加锁写回**：多个 Agent 并发更新时，避免共享状态文件互相覆盖
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
      "paths": ["/path/to/openclaw-neige"]
    },
    "slots": {
      "contextEngine": "neige"
    },
    "entries": {
      "neige": {
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
          },
          "agentMappings": {
            "roles": {
              "planner_agent": "planner"
            }
          },
          "rolePolicies": {
            "planner": {
              "label": "Planner",
              "writebackGuidance": [
                "Planner 负责拆解项目阶段和里程碑。",
                "Planner 优先统一维护 PROJECT_STATE.md。"
              ]
            }
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

## 本地管理命令

初始化一个最小 Neige 工作区：

```bash
npm run neige:init -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

切换或补齐某个项目目录：

```bash
npm run neige:switch -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

检查当前 Neige 健康状态：

```bash
npm run neige:health -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

这些命令会输出结构化 JSON，既可以手工使用，也方便后续被自动化脚本封装。

## 状态写回工具

Neige 现在提供一个 `neige-state` 工具。

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

## 长期记忆工具

Neige 现在还提供：

- `neige-profile`
- `neige-rules`

推荐用法：

- `neige-profile` 用于更新 L1 队员长期个人档案
- `neige-rules` 用于更新 L4 团队长期规则
- 不要把临时调试笔记或项目局部噪声写进这些长期记忆文件

示例参数：

```json
{
  "action": "upsert_section",
  "agentId": "coder",
  "section": "擅长",
  "items": ["C#", "Lua"],
  "mode": "append"
}
```

```json
{
  "action": "upsert_rule",
  "ruleId": "exception-handling",
  "text": "所有新代码必须包含异常处理。"
}
```

## V2 协作流

现在每个 Agent 都会通过 `before_prompt_build` 收到一段紧凑的写回协议。

- 只有在项目状态真的变化时才调用 `neige-state`
- 优先一次合并写回，而不是拆成很多小调用
- 共享白板只写短摘要，长草稿继续放在私有工作区
- 尽量用一次 `set_project_state` 同时携带阶段、活跃任务和最近更新

这样可以把多 Agent 协作协议稳定地挂进系统提示里，同时避免每轮对话重复塞入冗长规则。

## V3 稳定性增强

Neige 现在又增加了两层稳定性保护：

- 针对 `main`、`coder`、`writer`、`qa` 的角色化写回职责提示
- 在修改 `PROJECT_STATE.md` 和 `TODO.md` 之前先获取共享状态目录锁

这意味着多个 Agent 几乎同时完成任务时，写回会在项目白板层面串行化，明显降低互相覆盖共享状态的概率。

## V4 可配置角色

内置的 `main`、`coder`、`writer`、`qa` 角色仍然开箱即用。

现在你还可以：

- 通过 `agentMappings.roles` 把任意 agent id 映射到某个角色
- 覆盖内置角色的协议策略
- 通过 `rolePolicies` 定义全新的角色

这样 Neige 仍然保持通用插件形态，但每个团队都可以不用改源码，直接按自己的组织结构定制协作协议。

## 当前非目标

在当前“稳定化阶段”，Neige **故意不试图一次解决所有问题**。

当前明确不做：

- 向量检索 / Embedding / RAG
- 自动多 Agent 编排
- 独立图形化管理 UI
- 具备任意合并语义的自由格式复杂状态文档

当前最重要的目标仍然是：把外部大脑插件的边界、受控写回和 prompt 预算机制先做稳。

## Token 策略

Neige 现在有两层预算：

- 插件静态预算：`promptBudget.maxTotalChars`
- 运行时动态预算：`assemble({ tokenBudget })`

最终共享上下文会取两者中更小的那个限制，这样在小模型或更紧的编排预算下也能更稳地运行。

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
[![Star History Chart](https://api.star-history.com/svg?repos=cloud-11/neige&type=Date)](https://star-history.com/#cloud-11/neige&Date)
```

## 致谢

- [OpenClaw](https://github.com/openclaw/openclaw)：提供插件运行时、slot 体系和 context-engine 生命周期
- [Star History](https://github.com/star-history/star-history)：提供 GitHub Star 历史图服务
- GitHub 官方社区规范与 Actions 生态：为本仓库的标准化治理提供参考

## 路线图

- 增加长期检索与向量索引
- 增加多项目切换辅助工具
- 增加 Neige 运维命令

## 许可证

MIT
