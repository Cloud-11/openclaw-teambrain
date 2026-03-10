import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} required`);
  }

  return value.trim();
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

function buildId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function stateDir(config: NeigeConfig, projectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state");
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
}

function renderTaskCard(params: {
  taskId: string;
  projectId: string;
  title: string;
  owner: string;
  objective: string;
  definitionOfDone: string[];
  status?: string;
}): string {
  return [
    `# Task Card: ${params.taskId}`,
    "",
    "## 基本信息",
    `- Project: ${params.projectId}`,
    `- Owner: ${params.owner}`,
    "- Type: project-task",
    `- Status: ${params.status ?? "doing"}`,
    "",
    "## 标题",
    params.title,
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
  status?: string;
}): string {
  const header = "# TASKS";
  const line = `- [${entry.status ?? "doing"}] ${entry.taskId} | ${entry.title} | owner=${entry.owner}`;

  if (!existing) {
    return [header, "", line, ""].join("\n");
  }

  const normalized = existing.replace(/\r\n/g, "\n").trimEnd();
  return normalized.includes(entry.taskId) ? `${normalized}\n` : `${normalized}\n${line}\n`;
}

function renderCheckpoint(params: {
  checkpointId: string;
  taskId: string;
  projectId: string;
  owner: string;
  currentGoal: string;
  completed: string[];
  remaining: string[];
  nextAction: string;
}): string {
  return [
    `# Checkpoint: ${params.checkpointId}`,
    "",
    "## 基本信息",
    `- Task: ${params.taskId}`,
    `- Project: ${params.projectId}`,
    `- Owner: ${params.owner}`,
    "",
    "## 当前目标",
    params.currentGoal,
    "",
    "## 已完成",
    ...params.completed.map((item) => `- ${item}`),
    "",
    "## 未完成",
    ...params.remaining.map((item) => `- ${item}`),
    "",
    "## 下一步",
    params.nextAction,
    "",
  ].join("\n");
}

function renderCloseout(params: {
  closeoutId: string;
  taskId: string;
  projectId: string;
  owner: string;
  resultSummary: string[];
  verification: string[];
  knowledgeRecommendation: string;
}): string {
  return [
    `# Closeout: ${params.closeoutId}`,
    "",
    "## 基本信息",
    `- Task: ${params.taskId}`,
    `- Project: ${params.projectId}`,
    `- Owner: ${params.owner}`,
    `- Knowledge Recommendation: ${params.knowledgeRecommendation}`,
    "",
    "## 结果摘要",
    ...params.resultSummary.map((item) => `- ${item}`),
    "",
    "## 验证",
    ...params.verification.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export function createNeigeTaskTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-task",
    label: "Neige Task",
    description: "创建或更新 Task Card，并维护 TASKS.md 总览。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        title: { type: "string" },
        owner: { type: "string" },
        objective: { type: "string" },
        definitionOfDone: { type: "array", items: { type: "string" } },
      },
      required: ["action", "projectId", "title", "owner", "objective", "definitionOfDone"],
    },
    async execute(_id, params) {
      const projectId = requireString(params, "projectId");
      const title = requireString(params, "title");
      const owner = requireString(params, "owner");
      const objective = requireString(params, "objective");
      const definitionOfDone = readStringArray(params, "definitionOfDone");
      const taskId = buildId("TASK");
      const taskCardPath = join(stateDir(config, projectId), "task-cards", `${taskId}.md`);
      const tasksIndexPath = join(stateDir(config, projectId), "TASKS.md");

      await ensureDir(taskCardPath);
      await writeFile(
        taskCardPath,
        renderTaskCard({
          taskId,
          projectId,
          title,
          owner,
          objective,
          definitionOfDone,
        }),
        "utf8",
      );

      const existingIndex = await readOptionalUtf8(tasksIndexPath);
      await writeFile(
        tasksIndexPath,
        renderTasksIndex(existingIndex, { taskId, title, owner }),
        "utf8",
      );

      return toolResult(`已创建 ${taskCardPath}`, {
        taskId,
        filePath: taskCardPath,
      });
    },
  };
}

export function createNeigeCheckpointTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-checkpoint",
    label: "Neige Checkpoint",
    description: "创建长任务的 checkpoint 切片。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        taskId: { type: "string" },
        owner: { type: "string" },
        currentGoal: { type: "string" },
        completed: { type: "array", items: { type: "string" } },
        remaining: { type: "array", items: { type: "string" } },
        nextAction: { type: "string" },
      },
      required: [
        "action",
        "projectId",
        "taskId",
        "owner",
        "currentGoal",
        "completed",
        "remaining",
        "nextAction",
      ],
    },
    async execute(_id, params) {
      const projectId = requireString(params, "projectId");
      const taskId = requireString(params, "taskId");
      const owner = requireString(params, "owner");
      const currentGoal = requireString(params, "currentGoal");
      const completed = readStringArray(params, "completed");
      const remaining = readStringArray(params, "remaining");
      const nextAction = requireString(params, "nextAction");
      const checkpointId = buildId("CP");
      const filePath = join(stateDir(config, projectId), "checkpoints", `${checkpointId}.md`);

      await ensureDir(filePath);
      await writeFile(
        filePath,
        renderCheckpoint({
          checkpointId,
          taskId,
          projectId,
          owner,
          currentGoal,
          completed,
          remaining,
          nextAction,
        }),
        "utf8",
      );

      return toolResult(`已创建 ${filePath}`, {
        checkpointId,
        filePath,
      });
    },
  };
}

export function createNeigeCloseoutTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-closeout",
    label: "Neige Closeout",
    description: "创建任务 Closeout 收口文档，并保留知识建议。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        taskId: { type: "string" },
        owner: { type: "string" },
        resultSummary: { type: "array", items: { type: "string" } },
        verification: { type: "array", items: { type: "string" } },
        knowledgeRecommendation: { type: "string" },
      },
      required: [
        "action",
        "projectId",
        "taskId",
        "owner",
        "resultSummary",
        "verification",
        "knowledgeRecommendation",
      ],
    },
    async execute(_id, params) {
      const projectId = requireString(params, "projectId");
      const taskId = requireString(params, "taskId");
      const owner = requireString(params, "owner");
      const resultSummary = readStringArray(params, "resultSummary");
      const verification = readStringArray(params, "verification");
      const knowledgeRecommendation = requireString(params, "knowledgeRecommendation");
      const closeoutId = buildId("CO");
      const filePath = join(stateDir(config, projectId), "closeouts", `${closeoutId}.md`);

      await ensureDir(filePath);
      await writeFile(
        filePath,
        renderCloseout({
          closeoutId,
          taskId,
          projectId,
          owner,
          resultSummary,
          verification,
          knowledgeRecommendation,
        }),
        "utf8",
      );

      return toolResult(`已创建 ${filePath}`, {
        closeoutId,
        filePath,
        knowledgeRecommendation,
      });
    },
  };
}
