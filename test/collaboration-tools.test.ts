import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import {
  createNeigeCheckpointTool,
  createNeigeCloseoutTool,
  createNeigeTaskTool,
} from "../src/collaboration-tools.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("collaboration tools", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("neige-task 会创建 Task Card 并更新 TASKS.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeTaskTool(config);
    const result = await tool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      title: "实现 triage 路由",
      owner: "main",
      objective: "实现总管最小 triage 决策器",
      definitionOfDone: ["测试通过", "返回 scope 与推荐角色"],
    });

    const filePath = (result.details as { filePath: string }).filePath;
    const indexPath = join(root, "my-dev-team/projects/sandbox/state/TASKS.md");

    await expectPathExists(filePath);
    await expectPathExists(indexPath);

    const card = await readFile(filePath, "utf8");
    const index = await readFile(indexPath, "utf8");

    expect(card).toContain("# Task Card:");
    expect(card).toContain("实现 triage 路由");
    expect(index).toContain("实现 triage 路由");
  });

  it("neige-checkpoint 会写入 checkpoint 文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-checkpoint-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeCheckpointTool(config);
    const result = await tool.execute("call-2", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      owner: "coder",
      currentGoal: "完成最小 triage 实现",
      completed: ["已完成失败测试"],
      remaining: ["补实现", "跑全量验证"],
      nextAction: "实现 triage.ts",
    });

    const filePath = (result.details as { filePath: string }).filePath;
    await expectPathExists(filePath);

    const checkpoint = await readFile(filePath, "utf8");
    expect(checkpoint).toContain("# Checkpoint:");
    expect(checkpoint).toContain("TASK-20260311-001");
    expect(checkpoint).toContain("实现 triage.ts");
  });

  it("neige-closeout 会写入 closeout 文件，并保留知识建议", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-closeout-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeCloseoutTool(config);
    const result = await tool.execute("call-3", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      owner: "coder",
      resultSummary: ["完成 triage.ts", "测试已通过"],
      verification: ["npm test", "npm run typecheck"],
      knowledgeRecommendation: "candidate",
    });

    const filePath = (result.details as { filePath: string }).filePath;
    await expectPathExists(filePath);

    const closeout = await readFile(filePath, "utf8");
    expect(closeout).toContain("# Closeout:");
    expect(closeout).toContain("Knowledge Recommendation: candidate");
    expect(closeout).toContain("完成 triage.ts");
  });
});
