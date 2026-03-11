import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";
import type { TaskLinks } from "./task-links.ts";

export type TaskLinksSummary = {
  taskId: string;
  projectId: string;
  exists: boolean;
  packetCount: number;
  handoffCount: number;
  latestPacketId?: string;
  latestHandoffId?: string;
  updatedAt?: string;
};

type ReadTaskLinksSummaryParams = {
  projectId: string;
  taskId: string;
};

function taskLinksPath(config: NeigeConfig, projectId: string, taskId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state", "task-links", `${taskId}.json`);
}

export async function readTaskLinksSummary(
  config: NeigeConfig,
  params: ReadTaskLinksSummaryParams,
): Promise<TaskLinksSummary> {
  const raw = await readOptionalUtf8(taskLinksPath(config, params.projectId, params.taskId));
  if (!raw) {
    return {
      taskId: params.taskId,
      projectId: params.projectId,
      exists: false,
      packetCount: 0,
      handoffCount: 0,
    };
  }

  const taskLinks = JSON.parse(raw) as TaskLinks;
  return {
    taskId: params.taskId,
    projectId: params.projectId,
    exists: true,
    packetCount: taskLinks.packetIds.length,
    handoffCount: taskLinks.handoffIds.length,
    latestPacketId: taskLinks.packetIds.at(-1),
    latestHandoffId: taskLinks.handoffIds.at(-1),
    updatedAt: taskLinks.updatedAt,
  };
}
