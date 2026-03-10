import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { createNeigeReviewTool } from "../src/review-tools.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("review tools", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("neige-review 会写入 maker-checker 审核结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-review-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeReviewTool(config);
    const result = await tool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      maker: "coder",
      checker: "qa",
      verdict: "approved",
      resultSummary: ["代码通过验证", "状态写回正常"],
      findings: ["无阻塞项"],
    });

    const filePath = (result.details as { filePath: string }).filePath;
    await expectPathExists(filePath);

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("# Review:");
    expect(content).toContain("Task: TASK-20260311-001");
    expect(content).toContain("Maker: coder");
    expect(content).toContain("Checker: qa");
    expect(content).toContain("Verdict: approved");
    expect(content).toContain("代码通过验证");
  });
});
