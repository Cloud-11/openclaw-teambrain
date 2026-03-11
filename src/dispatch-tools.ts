import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import { upsertTaskLinks } from "./task-links.ts";

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

function requireStringArray(params: Record<string, unknown>, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} required`);
  }

  const items = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error(`${key} required`);
  }

  return items;
}

function buildId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function stateDir(config: NeigeConfig, projectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state");
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
}

export function createNeigePacketTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-packet",
    label: "Neige Packet",
    description: "创建最小 Subagent Packet，并回写主任务 links 索引。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        taskId: { type: "string" },
        fromRole: { type: "string" },
        toRole: { type: "string" },
        mode: {
          type: "string",
          enum: ["spawn", "handoff-prep", "parallel-research", "isolated-exec"],
        },
        title: { type: "string" },
        objective: { type: "string" },
        contextSummary: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        allowedTools: { type: "array", items: { type: "string" } },
        expectedOutput: { type: "array", items: { type: "string" } },
        definitionOfDone: { type: "array", items: { type: "string" } },
      },
      required: [
        "action",
        "projectId",
        "taskId",
        "fromRole",
        "toRole",
        "mode",
        "title",
        "objective",
        "contextSummary",
        "constraints",
        "allowedTools",
        "expectedOutput",
        "definitionOfDone",
      ],
    },
    async execute(_id, rawParams) {
      const params = rawParams as Record<string, unknown>;
      const projectId = requireString(params, "projectId");
      const taskId = requireString(params, "taskId");
      const packetId = buildId("PKT");
      const filePath = join(stateDir(config, projectId), "subagent-packets", `${packetId}.json`);

      const payload = {
        packetId,
        taskId,
        projectId,
        fromRole: requireString(params, "fromRole"),
        toRole: requireString(params, "toRole"),
        mode: requireString(params, "mode"),
        title: requireString(params, "title"),
        objective: requireString(params, "objective"),
        contextSummary: requireStringArray(params, "contextSummary"),
        constraints: requireStringArray(params, "constraints"),
        allowedTools: requireStringArray(params, "allowedTools"),
        expectedOutput: requireStringArray(params, "expectedOutput"),
        definitionOfDone: requireStringArray(params, "definitionOfDone"),
        returnFormat: {
          status: "success | blocked | partial",
          result: "短摘要",
          notes: ["风险或边界"],
        },
        createdAt: nowIso(),
      };

      await ensureDir(filePath);
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

      const taskLinks = await upsertTaskLinks(config, {
        projectId,
        taskId,
        packetId,
      });

      return toolResult(`已创建 ${filePath}`, {
        packetId,
        filePath,
        taskLinksPath: taskLinks.filePath,
      });
    },
  };
}

export function createNeigeHandoffTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-handoff",
    label: "Neige Handoff",
    description: "创建最小 Handoff 记录，并回写主任务 links 索引。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        taskId: { type: "string" },
        fromRole: { type: "string" },
        toRole: { type: "string" },
        reason: { type: "string" },
        currentGoal: { type: "string" },
        currentStatus: { type: "string" },
        completed: { type: "array", items: { type: "string" } },
        remaining: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        requiredReads: { type: "array", items: { type: "string" } },
        expectedOutput: { type: "array", items: { type: "string" } },
      },
      required: [
        "action",
        "projectId",
        "taskId",
        "fromRole",
        "toRole",
        "reason",
        "currentGoal",
        "currentStatus",
        "completed",
        "remaining",
        "risks",
        "requiredReads",
        "expectedOutput",
      ],
    },
    async execute(_id, rawParams) {
      const params = rawParams as Record<string, unknown>;
      const projectId = requireString(params, "projectId");
      const taskId = requireString(params, "taskId");
      const handoffId = buildId("HO");
      const filePath = join(stateDir(config, projectId), "handoffs", `${handoffId}.json`);

      const payload = {
        handoffId,
        taskId,
        projectId,
        fromRole: requireString(params, "fromRole"),
        toRole: requireString(params, "toRole"),
        reason: requireString(params, "reason"),
        currentGoal: requireString(params, "currentGoal"),
        currentStatus: requireString(params, "currentStatus"),
        completed: requireStringArray(params, "completed"),
        remaining: requireStringArray(params, "remaining"),
        risks: requireStringArray(params, "risks"),
        requiredReads: requireStringArray(params, "requiredReads"),
        expectedOutput: requireStringArray(params, "expectedOutput"),
        createdAt: nowIso(),
      };

      await ensureDir(filePath);
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

      const taskLinks = await upsertTaskLinks(config, {
        projectId,
        taskId,
        handoffId,
      });

      return toolResult(`已创建 ${filePath}`, {
        handoffId,
        filePath,
        taskLinksPath: taskLinks.filePath,
      });
    },
  };
}
