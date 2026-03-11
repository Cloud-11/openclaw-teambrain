import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

export type TaskLinks = {
  taskId: string;
  projectId: string;
  packetIds: string[];
  handoffIds: string[];
  updatedAt: string;
};

type UpsertTaskLinksParams = {
  projectId: string;
  taskId: string;
  packetId?: string;
  handoffId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function stateDir(config: NeigeConfig, projectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state");
}

function taskLinksPath(config: NeigeConfig, projectId: string, taskId: string): string {
  return join(stateDir(config, projectId), "task-links", `${taskId}.json`);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export async function upsertTaskLinks(
  config: NeigeConfig,
  params: UpsertTaskLinksParams,
): Promise<{ filePath: string; taskLinks: TaskLinks }> {
  const filePath = taskLinksPath(config, params.projectId, params.taskId);
  await mkdir(join(filePath, ".."), { recursive: true });

  const existingRaw = await readOptionalUtf8(filePath);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as TaskLinks)
    : {
        taskId: params.taskId,
        projectId: params.projectId,
        packetIds: [] as string[],
        handoffIds: [] as string[],
        updatedAt: nowIso(),
      };

  const taskLinks: TaskLinks = {
    taskId: params.taskId,
    projectId: params.projectId,
    packetIds: dedupe([
      ...existing.packetIds,
      ...(params.packetId ? [params.packetId] : []),
    ]),
    handoffIds: dedupe([
      ...existing.handoffIds,
      ...(params.handoffId ? [params.handoffId] : []),
    ]),
    updatedAt: nowIso(),
  };

  await writeFile(filePath, JSON.stringify(taskLinks, null, 2), "utf8");
  return { filePath, taskLinks };
}
