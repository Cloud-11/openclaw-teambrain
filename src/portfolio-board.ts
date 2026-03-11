import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

type PortfolioProjectState = {
  projectId: string;
  stage: string;
  activeTasks: string[];
  blockedItems: string[];
  openTodos: string[];
};

type PortfolioSummary = {
  generatedAt: string;
  projectCount: number;
  blockedProjectCount: number;
  activeTaskCount: number;
};

export type PortfolioBoardSnapshot = {
  summary: PortfolioSummary;
  projects: PortfolioProjectState[];
  filePath: string;
};

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function requireAction(params: Record<string, unknown>): "refresh" {
  const action = params.action;
  if (action !== "refresh") {
    throw new Error("action required");
  }

  return action;
}

function teamRoot(config: NeigeConfig): string {
  return join(config.brainRoot, config.teamId);
}

function projectsRoot(config: NeigeConfig): string {
  return join(teamRoot(config), "projects");
}

function portfolioBoardPath(config: NeigeConfig): string {
  return join(teamRoot(config), "memory_global", "PORTFOLIO_BOARD.md");
}

function parseSections(markdown?: string): Record<string, string[]> {
  if (!markdown) {
    return {};
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Record<string, string[]> = {};
  let currentHeading: string | undefined;

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^##\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1]!.trim();
      if (!sections[currentHeading]) {
        sections[currentHeading] = [];
      }
      continue;
    }

    if (!currentHeading) {
      continue;
    }

    sections[currentHeading]!.push(rawLine);
  }

  return sections;
}

function compactLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function parseMarkdownList(lines: string[]): string[] {
  return compactLines(lines)
    .map((line) => {
      const match = line.match(/^- (.+)$/);
      return match ? match[1]!.trim() : undefined;
    })
    .filter((line): line is string => Boolean(line));
}

function readFirstTextLine(lines: string[]): string | undefined {
  return compactLines(lines)[0];
}

function parseOpenTodos(markdown?: string): string[] {
  if (!markdown) {
    return [];
  }

  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^- \[ \] (.+)$/);
      return match ? match[1]!.trim() : undefined;
    })
    .filter((line): line is string => Boolean(line));
}

function formatInlineList(items: string[]): string {
  return items.length > 0 ? items.join("；") : "无";
}

function renderPortfolioBoard(snapshot: PortfolioBoardSnapshot): string {
  const blocks: string[] = [
    "# Portfolio Board",
    "",
    "## 汇总",
    `- 生成时间: ${snapshot.summary.generatedAt}`,
    `- 项目数: ${snapshot.summary.projectCount}`,
    `- 阻塞项目数: ${snapshot.summary.blockedProjectCount}`,
    `- 活跃任务数: ${snapshot.summary.activeTaskCount}`,
    "",
  ];

  for (const project of snapshot.projects) {
    blocks.push(`## 项目：${project.projectId}`);
    blocks.push(`- 当前阶段: ${project.stage}`);
    blocks.push(`- 活跃任务: ${formatInlineList(project.activeTasks)}`);
    blocks.push(`- 阻塞事项: ${formatInlineList(project.blockedItems)}`);
    blocks.push(`- 未完成 TODO: ${formatInlineList(project.openTodos)}`);
    blocks.push("");
  }

  return blocks.join("\n");
}

async function loadProjectState(
  config: NeigeConfig,
  projectId: string,
): Promise<PortfolioProjectState | undefined> {
  const stateDir = join(projectsRoot(config), projectId, "state");
  const projectState = await readOptionalUtf8(join(stateDir, "PROJECT_STATE.md"));
  if (!projectState) {
    return undefined;
  }

  const sections = parseSections(projectState);
  const todoMarkdown = await readOptionalUtf8(join(stateDir, "TODO.md"));

  return {
    projectId,
    stage: readFirstTextLine(sections["当前阶段"] ?? []) ?? "未知",
    activeTasks: parseMarkdownList(sections["活跃任务"] ?? []),
    blockedItems: parseMarkdownList(
      sections["阻塞事项"] ?? sections["Blocked"] ?? sections["Blockers"] ?? [],
    ),
    openTodos: parseOpenTodos(todoMarkdown),
  };
}

export async function buildPortfolioBoardSnapshot(
  config: NeigeConfig,
): Promise<PortfolioBoardSnapshot> {
  const entries = await readdir(projectsRoot(config), { withFileTypes: true }).catch((error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }

    throw error;
  });

  const projects = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((projectId) => projectId !== "_portfolio")
        .sort((left, right) => left.localeCompare(right))
        .map((projectId) => loadProjectState(config, projectId)),
    )
  ).filter((project): project is PortfolioProjectState => Boolean(project));

  const summary: PortfolioSummary = {
    generatedAt: new Date().toISOString(),
    projectCount: projects.length,
    blockedProjectCount: projects.filter((project) => project.blockedItems.length > 0).length,
    activeTaskCount: projects.reduce((total, project) => total + project.activeTasks.length, 0),
  };

  return {
    summary,
    projects,
    filePath: portfolioBoardPath(config),
  };
}

export async function refreshPortfolioBoard(
  config: NeigeConfig,
): Promise<PortfolioBoardSnapshot> {
  const snapshot = await buildPortfolioBoardSnapshot(config);
  await mkdir(join(snapshot.filePath, ".."), { recursive: true });
  await writeFile(snapshot.filePath, renderPortfolioBoard(snapshot), "utf8");
  return snapshot;
}

export function createNeigePortfolioTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-portfolio",
    label: "Neige Portfolio",
    description: "汇总所有项目状态，生成多项目 PORTFOLIO_BOARD.md 供总管统一汇报。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["refresh"],
        },
      },
      required: ["action"],
    },
    async execute(_id, params) {
      requireAction(params);
      const snapshot = await refreshPortfolioBoard(config);

      return toolResult(
        `已生成组合汇报：${snapshot.summary.projectCount} 个项目，${snapshot.summary.blockedProjectCount} 个阻塞项目，${snapshot.summary.activeTaskCount} 个活跃任务。`,
        {
          filePath: snapshot.filePath,
          projectCount: snapshot.summary.projectCount,
          blockedProjectCount: snapshot.summary.blockedProjectCount,
          activeTaskCount: snapshot.summary.activeTaskCount,
        },
      );
    },
  };
}
