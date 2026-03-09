# OpenClaw TeamBrain

[简体中文](./README.zh-CN.md) · English

`OpenClaw TeamBrain` is an external-brain plugin for OpenClaw. It helps a fixed multi-agent team work across many projects without polluting source repositories with AI state, logs, or vector data.

## Status

- V1 is available as a working standalone plugin skeleton
- Shared context is mounted through a `context-engine`
- Agent-specific context is appended through a lightweight prompt hook
- A `teambrain-state` tool can now write back `PROJECT_STATE.md` and `TODO.md`
- V2 now injects a compact write-back protocol for agents and respects runtime `tokenBudget`
- V3 adds role-aware write-back guidance and state-directory locking
- V4 makes role mapping and role protocol policies configurable
- Task 1 admin commands now cover init, switch, and health-check for local TeamBrain setup
- GitHub community, CI, release, and maintainer foundations are included

## Why TeamBrain

- **Clean repositories**: keep AI memory outside your business codebase
- **Project isolation**: one project's temporary context does not leak into another
- **Long-lived memory**: preserve team rules, project state, and agent profiles across sessions
- **Token-aware assembly**: prefer system-level additions over repetitive conversational stuffing

## Architecture

TeamBrain uses a hybrid runtime model:

- **Shared context** through `assemble()` in the `context-engine`
- **Per-agent context** through `before_prompt_build`
- **Prompt budgets** to cap each section and the total injected text
- **Runtime budget clamp** so `assemble(tokenBudget)` can shrink injected context on demand
- **Locked write-back** so concurrent agents do not stomp shared state files
- **Graceful degradation** when optional files are missing

Current V1 context sources:

- Team charter
- Global rules
- Project state board
- Project TODO
- Agent profile
- Agent private workspace notes

## Brain Layout

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

`agents_workspace` also supports sibling folder styles such as `coder_drafts` and `coder_logs`.

## OpenClaw Config

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

## Development

```bash
npm install
npm test
npm run typecheck
```

## Local Admin Commands

Initialize a minimal TeamBrain:

```bash
npm run teambrain:init -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

Switch or bootstrap a project workspace:

```bash
npm run teambrain:switch -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

Check current TeamBrain health:

```bash
npm run teambrain:health -- --brain-root ~/.openclaw/brains --team-id my-dev-team --project-id stardew-mod
```

These commands print structured JSON so they can be used manually or wrapped by later automation.

## State Write-back Tool

TeamBrain now exposes a tool named `teambrain-state`.

Supported actions:

- `set_project_state`
- `upsert_todo`
- `remove_todo`

Example payloads:

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

## Long-term Memory Tools

TeamBrain now also exposes:

- `teambrain-profile`
- `teambrain-rules`

Recommended usage:

- use `teambrain-profile` for L1 agent long-term profile updates
- use `teambrain-rules` for L4 team-wide long-term rules
- do not write temporary debugging notes or project-local noise into these files

Example payloads:

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

## V2 Collaboration Flow

Each agent now receives a compact write-back protocol through `before_prompt_build`.

- Use `teambrain-state` only when project state really changes
- Prefer one merged write-back instead of many tiny calls
- Keep shared board updates short; leave long drafts in private workspace files
- Let `set_project_state` carry stage, active tasks, and a short summary together

This keeps cross-agent coordination explicit without repeatedly stuffing long operational rules into every conversation turn.

## V3 Stability

TeamBrain now adds two stability guards for multi-agent collaboration:

- role-aware protocol text for `main`, `coder`, `writer`, and `qa`
- a shared state-directory lock before mutating `PROJECT_STATE.md` or `TODO.md`

This means concurrent agent write-backs are serialized at the project state layer, reducing accidental overwrites when several agents finish work around the same time.

## V4 Configurable Roles

Built-in roles such as `main`, `coder`, `writer`, and `qa` still work out of the box.

You can now also:

- map any agent id to a role with `agentMappings.roles`
- override a built-in role policy
- define a completely new role with `rolePolicies`

This keeps TeamBrain generic while letting each team customize protocol text without patching plugin source code.

## Current Non-Goals

At the current stabilization stage, TeamBrain intentionally does **not** try to solve everything.

Not in scope right now:

- vector retrieval / embeddings / RAG
- automatic multi-agent orchestration
- a dedicated graphical admin UI
- free-form rich state documents with arbitrary merge semantics

The current focus is a stable external-brain plugin with clear boundaries, controlled write-back, and predictable prompt budgets.

## Token Strategy

TeamBrain uses two budget layers:

- static plugin budget from `promptBudget.maxTotalChars`
- runtime clamp from `assemble({ tokenBudget })`

The effective shared-context size is the lower of those two limits. This makes the plugin safer to use with smaller models or tighter orchestration budgets.

## GitHub Operations

This repository now includes:

- issue forms for bugs and feature requests
- a pull request template
- CI for tests and type checks
- automatic PR labeling
- Release Drafter
- a tag/manual release workflow
- Dependabot updates

## Star History

```md
[![Star History Chart](https://api.star-history.com/svg?repos=cloud-11/openclaw-teambrain&type=Date)](https://star-history.com/#cloud-11/openclaw-teambrain&Date)
```

## Acknowledgements

- [OpenClaw](https://github.com/openclaw/openclaw) for the plugin runtime, slot system, and context-engine lifecycle
- [Star History](https://github.com/star-history/star-history) for the GitHub star history chart service
- GitHub community standards and automation patterns from GitHub Docs and GitHub Actions

## Roadmap

- long-term retrieval and vector indexing
- multi-agent project switching helpers
- optional CLI/admin commands for TeamBrain maintenance

## License

MIT
