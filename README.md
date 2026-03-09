# OpenClaw TeamBrain

[简体中文](./README.zh-CN.md) · English

`OpenClaw TeamBrain` is an external-brain plugin for OpenClaw. It helps a fixed multi-agent team work across many projects without polluting source repositories with AI state, logs, or vector data.

## Status

- V1 is available as a working standalone plugin skeleton
- Shared context is mounted through a `context-engine`
- Agent-specific context is appended through a lightweight prompt hook
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

- write-back tools for `PROJECT_STATE.md` and `TODO.md`
- long-term retrieval and vector indexing
- multi-agent project switching helpers
- optional CLI/admin commands for TeamBrain maintenance

## License

MIT
