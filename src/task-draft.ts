import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

export type TaskDraftScope =
  | "session-scope"
  | "adhoc-scope"
  | "project-scope"
  | "team-scope";

export type TaskDraft = {
  draftId: string;
  request: string;
  scope: TaskDraftScope;
  projectId?: string;
  owner: string;
  recommendedRole?: string;
  triageReasons: string[];
  createdAt: string;
};

export type FinalizeTaskDraftOptions = {
  owner: string;
  definitionOfDone: string[];
  constraints?: string[];
  risks?: string[];
  nextAction?: string;
};

export type FinalizeTaskDraftResult = {
  taskId: string;
  scope: TaskDraftScope;
  stateProjectId: string;
  taskCardPath: string;
  tasksIndexPath: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function buildId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export function resolveTaskDraftStateProjectId(
  config: NeigeConfig,
  scope: TaskDraftScope,
  projectId?: string,
): string {
  if (scope === "project-scope") {
    return projectId?.trim() || config.projectId;
  }

  if (scope === "adhoc-scope") {
    return "_adhoc";
  }

  if (scope === "team-scope") {
    return "_team";
  }

  return "_session";
}

function getStateDir(config: NeigeConfig, stateProjectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", stateProjectId, "state");
}

function renderTaskCard(params: {
  taskId: string;
  stateProjectId: string;
  title: string;
  owner: string;
  objective: string;
  definitionOfDone: string[];
  constraints: string[];
  risks: string[];
  nextAction?: string;
  signal: number;
  createdAt: string;
  updatedAt: string;
}): string {
  const blocks = [
    `# Task Card: ${params.taskId}`,
    "",
    "## 基本信息",
    `- Project: ${params.stateProjectId}`,
    `- Owner: ${params.owner}`,
    "- Type: project-task",
    "- Status: doing",
    `- Signal: ${params.signal}`,
    "",
    "## 目标",
    params.objective,
    "",
    "## 完成标准",
    ...params.definitionOfDone.map((item) => `- ${item}`),
    "",
  ];

  if (params.constraints.length > 0) {
    blocks.push("## 约束");
    blocks.push(...params.constraints.map((item) => `- ${item}`));
    blocks.push("");
  }

  if (params.risks.length > 0) {
    blocks.push("## 风险");
    blocks.push(...params.risks.map((item) => `- ${item}`));
    blocks.push("");
  }

  if (params.nextAction) {
    blocks.push("## 下一步");
    blocks.push(params.nextAction);
    blocks.push("");
  }

  blocks.push("## 时间");
  blocks.push(`- Created At: ${params.createdAt}`);
  blocks.push(`- Updated At: ${params.updatedAt}`);
  blocks.push("");

  return blocks.join("\n");
}

function renderTasksIndex(existing: string | undefined, entry: {
  taskId: string;
  title: string;
  owner: string;
}): string {
  const header = "# TASKS";
  const line = `- [doing] ${entry.taskId} | ${entry.title} | owner=${entry.owner}`;

  if (!existing) {
    return [header, "", line, ""].join("\n");
  }

  const normalized = existing.replace(/\r\n/g, "\n").trimEnd();
  if (normalized.includes(entry.taskId)) {
    return `${normalized}\n`;
  }

  return `${normalized}\n${line}\n`;
}

export function createTaskDraft(params: {
  request: string;
  scope: TaskDraftScope;
  projectId?: string;
  owner: string;
  recommendedRole?: string;
  triageReasons: string[];
}): TaskDraft {
  return {
    draftId: buildId("DRAFT"),
    request: params.request.trim(),
    scope: params.scope,
    projectId: params.projectId?.trim(),
    owner: params.owner.trim(),
    recommendedRole: params.recommendedRole?.trim(),
    triageReasons: [...params.triageReasons],
    createdAt: nowIso(),
  };
}

export async function finalizeTaskDraft(
  config: NeigeConfig,
  draft: TaskDraft,
  options: FinalizeTaskDraftOptions,
): Promise<FinalizeTaskDraftResult> {
  const stateProjectId = resolveTaskDraftStateProjectId(config, draft.scope, draft.projectId);
  const stateDir = getStateDir(config, stateProjectId);
  const taskCardsDir = join(stateDir, "task-cards");
  const taskId = buildId("TASK");
  const taskCardPath = join(taskCardsDir, `${taskId}.md`);
  const tasksIndexPath = join(stateDir, "TASKS.md");
  const owner = options.owner.trim();
  const createdAt = nowIso();
  const updatedAt = createdAt;

  await mkdir(taskCardsDir, { recursive: true });

  const title = draft.request.slice(0, 40);
  await writeFile(
    taskCardPath,
    renderTaskCard({
      taskId,
      stateProjectId,
      title,
      owner,
      objective: draft.request,
      definitionOfDone: options.definitionOfDone,
      constraints: options.constraints?.map((item) => item.trim()).filter(Boolean) ?? [],
      risks: options.risks?.map((item) => item.trim()).filter(Boolean) ?? [],
      nextAction: options.nextAction?.trim() || undefined,
      signal: draft.scope === "project-scope" ? 2 : 1,
      createdAt,
      updatedAt,
    }),
    "utf8",
  );

  const existingIndex = await readOptionalUtf8(tasksIndexPath);
  await writeFile(
    tasksIndexPath,
    renderTasksIndex(existingIndex, {
      taskId,
      title,
      owner,
    }),
    "utf8",
  );

  return {
    taskId,
    scope: draft.scope,
    stateProjectId,
    taskCardPath,
    tasksIndexPath,
  };
}
