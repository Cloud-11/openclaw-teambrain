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
  signal: number;
}): string {
  return [
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
  ].join("\n");
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
      signal: draft.scope === "project-scope" ? 2 : 1,
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
