import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";

export type SessionRefKind =
  | "main-session"
  | "task-session"
  | "subagent-session"
  | "handoff-session"
  | "adhoc-session";

export type SessionRef = {
  sessionKey: string;
  agentId: string;
  roleId: string;
  kind: SessionRefKind;
  linkedTaskId: string;
  purpose: string;
  taskOwner?: string;
  taskScope?: string;
  linkedAt: string;
  createdAt: string;
  endedAt: string | null;
};

type AttachSessionRefParams = {
  projectId: string;
  taskId: string;
  sessionRef: SessionRef;
};

type SessionTaskIndexEntry = {
  sessionKey: string;
  taskId: string;
  projectId: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function stateDir(config: NeigeConfig, projectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state");
}

function taskSessionRefsPath(config: NeigeConfig, projectId: string, taskId: string): string {
  return join(stateDir(config, projectId), "session-refs", `${taskId}.json`);
}

function sessionTaskIndexPath(config: NeigeConfig, projectId: string): string {
  return join(stateDir(config, projectId), "session-index.json");
}

function dedupeSessionRefs(items: SessionRef[]): SessionRef[] {
  const seen = new Set<string>();
  const result: SessionRef[] = [];
  for (const item of items) {
    if (seen.has(item.sessionKey)) {
      continue;
    }
    seen.add(item.sessionKey);
    result.push(item);
  }
  return result;
}

function dedupeIndexEntries(items: SessionTaskIndexEntry[]): SessionTaskIndexEntry[] {
  const seen = new Set<string>();
  const result: SessionTaskIndexEntry[] = [];
  for (const item of items) {
    const key = `${item.sessionKey}|${item.taskId}|${item.projectId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function createSessionRef(params: {
  sessionKey: string;
  agentId: string;
  roleId: string;
  kind: SessionRefKind;
  linkedTaskId: string;
  purpose: string;
  taskOwner?: string;
  taskScope?: string;
  linkedAt?: string;
  createdAt?: string;
  endedAt?: string | null;
}): SessionRef {
  return {
    sessionKey: params.sessionKey.trim(),
    agentId: params.agentId.trim(),
    roleId: params.roleId.trim(),
    kind: params.kind,
    linkedTaskId: params.linkedTaskId.trim(),
    purpose: params.purpose.trim(),
    taskOwner: params.taskOwner?.trim() || undefined,
    taskScope: params.taskScope?.trim() || undefined,
    linkedAt: params.linkedAt ?? nowIso(),
    createdAt: params.createdAt ?? nowIso(),
    endedAt: params.endedAt ?? null,
  };
}

export async function attachSessionRefToTask(
  config: NeigeConfig,
  params: AttachSessionRefParams,
): Promise<{ filePath: string }> {
  const filePath = taskSessionRefsPath(config, params.projectId, params.taskId);
  await mkdir(join(filePath, ".."), { recursive: true });

  const existingRaw = await readOptionalUtf8(filePath);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as {
        taskId: string;
        projectId: string;
        sessionRefs: SessionRef[];
      })
    : {
        taskId: params.taskId,
        projectId: params.projectId,
        sessionRefs: [] as SessionRef[],
      };

  const sessionRefs = dedupeSessionRefs([...existing.sessionRefs, params.sessionRef]);
  await writeFile(
    filePath,
    JSON.stringify(
      {
        taskId: params.taskId,
        projectId: params.projectId,
        sessionRefs,
      },
      null,
      2,
    ),
    "utf8",
  );

  return { filePath };
}

export async function upsertSessionTaskIndex(
  config: NeigeConfig,
  params: AttachSessionRefParams,
): Promise<{ filePath: string }> {
  const filePath = sessionTaskIndexPath(config, params.projectId);
  await mkdir(join(filePath, ".."), { recursive: true });

  const existingRaw = await readOptionalUtf8(filePath);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as { entries: SessionTaskIndexEntry[] })
    : { entries: [] as SessionTaskIndexEntry[] };

  const entries = dedupeIndexEntries([
    ...existing.entries,
    {
      sessionKey: params.sessionRef.sessionKey,
      taskId: params.taskId,
      projectId: params.projectId,
    },
  ]);

  await writeFile(filePath, JSON.stringify({ entries }, null, 2), "utf8");
  return { filePath };
}
