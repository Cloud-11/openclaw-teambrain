import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { upsertTaskLinks } from "../src/task-links.ts";
import { readTaskLinksSummary } from "../src/task-links-summary.ts";

describe("task links summary", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会在 task-links 不存在时返回空摘要", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-links-summary-empty-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const summary = await readTaskLinksSummary(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
    });

    expect(summary.exists).toBe(false);
    expect(summary.packetCount).toBe(0);
    expect(summary.handoffCount).toBe(0);
    expect(summary.latestPacketId).toBeUndefined();
    expect(summary.latestHandoffId).toBeUndefined();
  });

  it("会返回 packet/handoff 数量和最新引用", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-links-summary-"));
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
      handoffId: "HO-20260311-001",
    });

    const summary = await readTaskLinksSummary(config, {
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
    });

    expect(summary.exists).toBe(true);
    expect(summary.packetCount).toBe(1);
    expect(summary.handoffCount).toBe(1);
    expect(summary.latestPacketId).toBe("PKT-20260311-001");
    expect(summary.latestHandoffId).toBe("HO-20260311-001");
    expect(summary.updatedAt).toBeDefined();
  });
});
