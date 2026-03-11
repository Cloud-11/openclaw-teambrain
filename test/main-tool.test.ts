import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { createNeigeMainTool } from "../src/main-tool.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("main tool", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会接收 reliability 参数并把拦截结果透传给调用方", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-main-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeMainTool(config);
    const result = await tool.execute("call-1", {
      action: "intake",
      request: "推进 sandbox 可靠性层",
      signals: {
        hasExplicitDeliverable: true,
        requiresTracking: true,
        activeProjectId: "sandbox",
      },
      reliability: {
        breakerOpen: true,
      },
    });

    const details = result.details as {
      mode: string;
      reliability?: { code: string };
    };

    expect(details.mode).toBe("reliability-blocked");
    expect(details.reliability?.code).toBe("breaker-open");
    await expect(
      stat(join(root, "my-dev-team/projects/sandbox/state/task-cards")),
    ).rejects.toBeDefined();
  });

  it("会通过 neige-main 返回 task-links 摘要", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-main-tool-links-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/projects/sandbox/state/task-links/TASK-20260311-005.json"),
      JSON.stringify(
        {
          taskId: "TASK-20260311-005",
          projectId: "sandbox",
          packetIds: ["PKT-20260311-001"],
          handoffIds: ["HO-20260311-001", "HO-20260311-002"],
          updatedAt: "2026-03-11T12:00:00.000Z",
        },
        null,
        2,
      ),
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeMainTool(config);
    const result = await tool.execute("call-2", {
      action: "task-links",
      projectId: "sandbox",
      taskId: "TASK-20260311-005",
    });

    const details = result.details as {
      mode: string;
      taskLinks?: {
        packetCount: number;
        handoffCount: number;
        latestHandoffId?: string;
      };
    };

    expect(details.mode).toBe("task-links-summary");
    expect(details.taskLinks?.packetCount).toBe(1);
    expect(details.taskLinks?.handoffCount).toBe(2);
    expect(details.taskLinks?.latestHandoffId).toBe("HO-20260311-002");
  });
});
