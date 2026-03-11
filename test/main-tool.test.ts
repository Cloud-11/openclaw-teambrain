import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { createNeigeMainTool } from "../src/main-tool.ts";

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
});
