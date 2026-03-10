import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import {
  attachSessionRefToTask,
  createSessionRef,
  upsertSessionTaskIndex,
} from "../src/session-refs.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("session refs", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会创建最小 SessionRef 对象", () => {
    const ref = createSessionRef({
      sessionKey: "agent:main:main",
      agentId: "main",
      roleId: "main",
      kind: "main-session",
      linkedTaskId: "TASK-20260311-001",
      purpose: "主线协调与汇总",
    });

    expect(ref.sessionKey).toBe("agent:main:main");
    expect(ref.agentId).toBe("main");
    expect(ref.roleId).toBe("main");
    expect(ref.kind).toBe("main-session");
    expect(ref.linkedTaskId).toBe("TASK-20260311-001");
    expect(ref.endedAt).toBeNull();
  });

  it("会把多个 SessionRef 关联到同一 Task 并保存在状态层", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-session-refs-task-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const first = createSessionRef({
      sessionKey: "agent:main:main",
      agentId: "main",
      roleId: "main",
      kind: "main-session",
      linkedTaskId: "TASK-20260311-001",
      purpose: "主线协调",
    });
    const second = createSessionRef({
      sessionKey: "agent:coder:subagent:abc123",
      agentId: "coder",
      roleId: "coder",
      kind: "subagent-session",
      linkedTaskId: "TASK-20260311-001",
      purpose: "并行实现",
    });

    const result = await attachSessionRefToTask(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      sessionRef: first,
    });
    await attachSessionRefToTask(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      sessionRef: second,
    });

    await expectPathExists(result.filePath);

    const content = JSON.parse(await readFile(result.filePath, "utf8")) as {
      taskId: string;
      projectId: string;
      sessionRefs: Array<{ sessionKey: string }>;
    };

    expect(content.taskId).toBe("TASK-20260311-001");
    expect(content.projectId).toBe("sandbox");
    expect(content.sessionRefs.map((entry) => entry.sessionKey)).toEqual([
      "agent:main:main",
      "agent:coder:subagent:abc123",
    ]);
  });

  it("会维护 session -> task/project 的索引", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-session-index-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const result = await upsertSessionTaskIndex(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      sessionRef: createSessionRef({
        sessionKey: "agent:main:main",
        agentId: "main",
        roleId: "main",
        kind: "main-session",
        linkedTaskId: "TASK-20260311-001",
        purpose: "主线协调",
      }),
    });

    await expectPathExists(result.filePath);

    const content = JSON.parse(await readFile(result.filePath, "utf8")) as {
      entries: Array<{ sessionKey: string; taskId: string; projectId: string }>;
    };

    expect(content.entries).toEqual([
      {
        sessionKey: "agent:main:main",
        taskId: "TASK-20260311-001",
        projectId: "sandbox",
      },
    ]);
  });
});
