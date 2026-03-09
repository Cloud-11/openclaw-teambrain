import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TeamBrainConfig } from "./config.ts";

export type PromptSection = {
  title: string;
  content: string;
};

function normalizeText(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function truncateText(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\n[内容已截断]`;
}

export async function readOptionalUtf8(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    const normalized = normalizeText(content);
    return normalized === "" ? undefined : normalized;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return undefined;
    }

    throw error;
  }
}

function teamRoot(config: TeamBrainConfig): string {
  return join(config.brainRoot, config.teamId);
}

function projectRoot(config: TeamBrainConfig): string {
  return join(teamRoot(config), "projects", config.projectId);
}

function resolveProfileId(config: TeamBrainConfig, agentId: string): string {
  return config.agentMappings.profiles[agentId] ?? agentId;
}

function resolveWorkspaceId(config: TeamBrainConfig, agentId: string): string {
  return config.agentMappings.workspaces[agentId] ?? agentId;
}

export async function loadSharedSections(config: TeamBrainConfig): Promise<PromptSection[]> {
  const sections: PromptSection[] = [];

  if (config.layers.includeTeamCharter) {
    const content = await readOptionalUtf8(join(teamRoot(config), "config", "team-charter.md"));
    if (content) {
      sections.push({
        title: "团队宪法",
        content,
      });
    }
  }

  if (config.layers.includeGlobalRules) {
    const content = await readOptionalUtf8(
      join(teamRoot(config), "memory_global", "global_rules.md"),
    );
    if (content) {
      sections.push({
        title: "团队长期规则",
        content,
      });
    }
  }

  if (config.layers.includeProjectState) {
    const content = await readOptionalUtf8(
      join(projectRoot(config), "state", "PROJECT_STATE.md"),
    );
    if (content) {
      sections.push({
        title: `项目状态 (${config.projectId})`,
        content,
      });
    }
  }

  if (config.layers.includeTodo) {
    const content = await readOptionalUtf8(join(projectRoot(config), "state", "TODO.md"));
    if (content) {
      sections.push({
        title: `项目待办 (${config.projectId})`,
        content,
      });
    }
  }

  return sections;
}

async function collectFilesRecursively(rootDir: string, depth: number): Promise<string[]> {
  if (depth < 0) {
    return [];
  }

  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(rootDir, entry.name);
        if (entry.isDirectory()) {
          return collectFilesRecursively(fullPath, depth - 1);
        }

        return [fullPath];
      }),
    );

    return nested.flat();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw error;
  }
}

export async function loadAgentSections(
  config: TeamBrainConfig,
  agentId?: string,
): Promise<PromptSection[]> {
  if (!agentId) {
    return [];
  }

  const sections: PromptSection[] = [];

  if (config.layers.includeProfiles) {
    const profileId = resolveProfileId(config, agentId);
    const content = await readOptionalUtf8(
      join(teamRoot(config), "config", "profiles", `${profileId}.profile.md`),
    );
    if (content) {
      sections.push({
        title: `个人档案 (${profileId})`,
        content,
      });
    }
  }

  if (!config.layers.includePrivateWorkspace) {
    return sections;
  }

  const workspaceId = resolveWorkspaceId(config, agentId);
  const candidateDirs = [
    join(projectRoot(config), "agents_workspace", workspaceId),
    join(projectRoot(config), "agents_workspace", `${workspaceId}_drafts`),
    join(projectRoot(config), "agents_workspace", `${workspaceId}_logs`),
  ];

  const workspaceFiles = (
    await Promise.all(candidateDirs.map((dir) => collectFilesRecursively(dir, 2)))
  )
    .flat()
    .slice(0, config.promptBudget.maxWorkspaceFiles);

  for (const filePath of workspaceFiles) {
    const content = await readOptionalUtf8(filePath);
    if (!content) {
      continue;
    }

    sections.push({
      title: `项目草稿 (${agentId})`,
      content: truncateText(content, config.promptBudget.maxWorkspaceFileChars),
    });
  }

  return sections;
}

export function renderPromptSections(
  heading: string,
  sections: PromptSection[],
  config: TeamBrainConfig,
  options?: {
    maxTotalChars?: number;
  },
): string | undefined {
  if (sections.length === 0) {
    return undefined;
  }

  const blocks: string[] = [`# ${heading}`];
  const maxTotalChars = options?.maxTotalChars ?? config.promptBudget.maxTotalChars;
  let remaining = maxTotalChars - blocks[0].length - 2;

  for (const section of sections) {
    if (remaining <= 0) {
      break;
    }

    const sectionText = `## ${section.title}\n${truncateText(
      section.content,
      config.promptBudget.maxCharsPerSection,
    )}`;

    if (sectionText.length <= remaining) {
      blocks.push(sectionText);
      remaining -= sectionText.length + 2;
      continue;
    }

    const truncated = truncateText(sectionText, Math.max(remaining, 120));
    blocks.push(truncated);
    remaining = 0;
  }

  return blocks.join("\n\n");
}

export function estimateTokensFromText(text?: string): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}
