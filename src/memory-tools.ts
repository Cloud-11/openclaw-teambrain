import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { TeamBrainConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

type ProfileAction = "upsert_section";
type ProfileMode = "replace" | "append";
type RulesAction = "upsert_rule" | "remove_rule";

type ProfileSection = {
  section: string;
  items: string[];
};

type RuleEntry = {
  ruleId: string;
  text: string;
};

function getProfilesDir(config: TeamBrainConfig): string {
  return join(config.brainRoot, config.teamId, "config", "profiles");
}

function getProfilePath(config: TeamBrainConfig, agentId: string): string {
  return join(getProfilesDir(config), `${agentId}.profile.md`);
}

function getGlobalRulesPath(config: TeamBrainConfig): string {
  return join(config.brainRoot, config.teamId, "memory_global", "global_rules.md");
}

function readString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = readString(params, key);
  if (!value) {
    throw new Error(`${key} required`);
  }

  return value;
}

function readStringArray(params: Record<string, unknown>, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function requireProfileAction(params: Record<string, unknown>): ProfileAction {
  const action = readString(params, "action");
  if (action === "upsert_section") {
    return action;
  }

  throw new Error("action 必须是 upsert_section");
}

function requireRulesAction(params: Record<string, unknown>): RulesAction {
  const action = readString(params, "action");
  if (action === "upsert_rule" || action === "remove_rule") {
    return action;
  }

  throw new Error("action 必须是 upsert_rule / remove_rule");
}

function readMode(params: Record<string, unknown>): ProfileMode {
  const mode = readString(params, "mode");
  return mode === "append" ? "append" : "replace";
}

function parseProfile(markdown?: string): ProfileSection[] {
  if (!markdown) {
    return [];
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: ProfileSection[] = [];
  let current: ProfileSection | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      current = {
        section: line.slice(3).trim(),
        items: [],
      };
      sections.push(current);
      continue;
    }

    if (current && line.startsWith("- ")) {
      const item = line.slice(2).trim();
      if (item !== "") {
        current.items.push(item);
      }
    }
  }

  return sections;
}

function renderProfile(agentId: string, sections: ProfileSection[]): string {
  const blocks = [`# ${agentId} 个人档案`, ""];

  for (const section of sections) {
    blocks.push(`## ${section.section}`);
    if (section.items.length === 0) {
      blocks.push("- 暂无");
    } else {
      blocks.push(...section.items.map((item) => `- ${item}`));
    }
    blocks.push("");
  }

  return blocks.join("\n");
}

function mergeProfileItems(existing: string[], incoming: string[], mode: ProfileMode): string[] {
  if (mode === "replace") {
    return [...incoming];
  }

  return [...new Set([...existing, ...incoming])];
}

function parseRules(markdown?: string): RuleEntry[] {
  if (!markdown) {
    return [];
  }

  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^- \[([^\]]+)\] (.+)$/);
      if (!match) {
        return undefined;
      }

      return {
        ruleId: match[1]!.trim(),
        text: match[2]!.trim(),
      };
    })
    .filter((entry): entry is RuleEntry => Boolean(entry));
}

function renderRules(entries: RuleEntry[]): string {
  const blocks = ["# 团队长期规则", ""];

  for (const entry of entries) {
    blocks.push(`- [${entry.ruleId}] ${entry.text}`);
  }

  blocks.push("");
  return blocks.join("\n");
}

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

export function createTeamBrainProfileTool(config: TeamBrainConfig): PluginTool {
  return {
    name: "teambrain-profile",
    label: "TeamBrain Profile",
    description: "受控更新 Agent 长期个人档案，按标准 section 追加或覆盖。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["upsert_section"],
        },
        agentId: { type: "string" },
        section: { type: "string" },
        items: {
          type: "array",
          items: { type: "string" },
        },
        mode: {
          type: "string",
          enum: ["replace", "append"],
        },
      },
      required: ["action", "agentId", "section", "items"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      requireProfileAction(params);
      const agentId = requireString(params, "agentId");
      const sectionName = requireString(params, "section");
      const items = readStringArray(params, "items");
      const mode = readMode(params);
      const filePath = getProfilePath(config, agentId);

      await mkdir(getProfilesDir(config), { recursive: true });

      const sections = parseProfile(await readOptionalUtf8(filePath));
      const index = sections.findIndex((section) => section.section === sectionName);
      if (index >= 0) {
        sections[index] = {
          section: sectionName,
          items: mergeProfileItems(sections[index]!.items, items, mode),
        };
      } else {
        sections.push({
          section: sectionName,
          items: [...items],
        });
      }

      await writeFile(filePath, renderProfile(agentId, sections), "utf8");

      return toolResult(`已更新 ${filePath}`, {
        action: "upsert_section",
        agentId,
        section: sectionName,
        mode,
      });
    },
  };
}

export function createTeamBrainRulesTool(config: TeamBrainConfig): PluginTool {
  return {
    name: "teambrain-rules",
    label: "TeamBrain Rules",
    description: "受控更新团队长期规则条目，支持 upsert 与删除。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["upsert_rule", "remove_rule"],
        },
        ruleId: { type: "string" },
        text: { type: "string" },
      },
      required: ["action", "ruleId"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = requireRulesAction(params);
      const ruleId = requireString(params, "ruleId");
      const filePath = getGlobalRulesPath(config);

      await mkdir(join(config.brainRoot, config.teamId, "memory_global"), { recursive: true });

      const entries = parseRules(await readOptionalUtf8(filePath));
      const index = entries.findIndex((entry) => entry.ruleId === ruleId);

      if (action === "upsert_rule") {
        const text = requireString(params, "text");
        if (index >= 0) {
          entries[index] = { ruleId, text };
        } else {
          entries.push({ ruleId, text });
        }
      }

      if (action === "remove_rule" && index >= 0) {
        entries.splice(index, 1);
      }

      await writeFile(filePath, renderRules(entries), "utf8");

      return toolResult(`已更新 ${filePath}`, {
        action,
        ruleId,
      });
    },
  };
}
