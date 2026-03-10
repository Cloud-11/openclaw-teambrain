import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import {
  loadAgentSections,
  readOptionalUtf8,
  renderPromptSections,
  type PromptSection,
} from "./files.ts";
import { buildWritebackProtocolSection } from "./protocol.ts";

function teamRoot(config: NeigeConfig): string {
  return join(config.brainRoot, config.teamId);
}

function projectRoot(config: NeigeConfig): string {
  return join(teamRoot(config), "projects", config.projectId);
}

async function buildHardRulesSection(config: NeigeConfig): Promise<PromptSection | undefined> {
  const parts: string[] = [];

  if (config.layers.includeTeamCharter) {
    const charter = await readOptionalUtf8(join(teamRoot(config), "config", "team-charter.md"));
    if (charter) {
      parts.push(charter);
    }
  }

  if (config.layers.includeGlobalRules) {
    const rules = await readOptionalUtf8(join(teamRoot(config), "memory_global", "global_rules.md"));
    if (rules) {
      parts.push(rules);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return {
    title: "Hard Rules",
    content: parts.join("\n\n"),
  };
}

async function buildCurrentStateSection(config: NeigeConfig): Promise<PromptSection | undefined> {
  const parts: string[] = [];

  if (config.layers.includeProjectState) {
    const state = await readOptionalUtf8(join(projectRoot(config), "state", "PROJECT_STATE.md"));
    if (state) {
      parts.push(state);
    }
  }

  if (config.layers.includeTodo) {
    const todo = await readOptionalUtf8(join(projectRoot(config), "state", "TODO.md"));
    if (todo) {
      parts.push(todo);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return {
    title: "Current State",
    content: parts.join("\n\n"),
  };
}

async function buildApplicableSkillSections(config: NeigeConfig): Promise<PromptSection[]> {
  const skillsDir = join(teamRoot(config), "memory_global", "skills");

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).slice(0, 3);
    const sections: PromptSection[] = [];

    for (const file of files) {
      const content = await readOptionalUtf8(join(skillsDir, file.name));
      if (!content) {
        continue;
      }

      sections.push({
        title: "Applicable Skills",
        content,
      });
    }

    return sections;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw error;
  }
}

export async function buildAgentPromptAddition(params: {
  config: NeigeConfig;
  agentId?: string;
}): Promise<string | undefined> {
  const sections: PromptSection[] = [];

  const hardRules = await buildHardRulesSection(params.config);
  if (hardRules) {
    sections.push(hardRules);
  }

  const currentState = await buildCurrentStateSection(params.config);
  if (currentState) {
    sections.push(currentState);
  }

  if (params.agentId) {
    sections.push(buildWritebackProtocolSection(params.config, params.agentId));
  }

  sections.push(...(await loadAgentSections(params.config, params.agentId)));
  sections.push(...(await buildApplicableSkillSections(params.config)));

  return renderPromptSections("Neige Agent 上下文", sections, params.config);
}
