import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { upsertTaskLinks } from "../src/task-links.ts";

describe("task links", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会创建新的 task-links 文件并写入 packet 引用", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-links-create-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const result = await upsertTaskLinks(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      packetId: "PKT-20260311-001",
    });

    const taskLinks = JSON.parse(await readFile(result.filePath, "utf8")) as {
      taskId: string;
      projectId: string;
      packetIds: string[];
      handoffIds: string[];
      updatedAt: string;
    };

    expect(taskLinks.taskId).toBe("TASK-20260311-001");
    expect(taskLinks.projectId).toBe("sandbox");
    expect(taskLinks.packetIds).toEqual(["PKT-20260311-001"]);
    expect(taskLinks.handoffIds).toEqual([]);
    expect(taskLinks.updatedAt).toBeDefined();
  });

  it("会保留已有引用并对重复 packet/handoff 去重", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-links-dedupe-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    await upsertTaskLinks(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
      packetId: "PKT-20260311-001",
    });
    await upsertTaskLinks(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
      packetId: "PKT-20260311-001",
      handoffId: "HO-20260311-001",
    });
    const result = await upsertTaskLinks(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
      handoffId: "HO-20260311-001",
    });

    const taskLinks = JSON.parse(await readFile(result.filePath, "utf8")) as {
      packetIds: string[];
      handoffIds: string[];
    };

    expect(taskLinks.packetIds).toEqual(["PKT-20260311-001"]);
    expect(taskLinks.handoffIds).toEqual(["HO-20260311-001"]);
  });
});
