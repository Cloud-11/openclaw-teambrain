import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { createNeigeHandoffTool, createNeigePacketTool } from "../src/dispatch-tools.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("dispatch tools", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("neige-packet 会写入 packet 文件并同步 task-links", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-packet-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigePacketTool(config, "main");
    const result = await tool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-001",
      fromRole: "main",
      toRole: "coder",
      mode: "spawn",
      title: "补 WP-12 最小工具化",
      objective: "只做文件层闭环",
      contextSummary: ["已有 task card", "尚未接 runtime dispatch"],
      constraints: ["不要接 sessions_spawn"],
      allowedTools: ["neige-task", "neige-checkpoint"],
      expectedOutput: ["生成文件", "更新索引"],
      definitionOfDone: ["测试通过", "task-links 已更新"],
    });

    const details = result.details as {
      packetId: string;
      filePath: string;
      taskLinksPath: string;
    };

    await expectPathExists(details.filePath);
    await expectPathExists(details.taskLinksPath);

    const packet = JSON.parse(await readFile(details.filePath, "utf8")) as {
      packetId: string;
      taskId: string;
      mode: string;
      definitionOfDone: string[];
    };
    const taskLinks = JSON.parse(await readFile(details.taskLinksPath, "utf8")) as {
      packetIds: string[];
      handoffIds: string[];
    };

    expect(packet.packetId).toBe(details.packetId);
    expect(packet.taskId).toBe("TASK-20260311-001");
    expect(packet.mode).toBe("spawn");
    expect(packet.definitionOfDone).toContain("测试通过");
    expect(taskLinks.packetIds).toEqual([details.packetId]);
    expect(taskLinks.handoffIds).toEqual([]);
  });

  it("neige-handoff 会写入 handoff 文件并保留已有 packet 引用", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-handoff-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const packetTool = createNeigePacketTool(config, "main");
    const packetResult = await packetTool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
      fromRole: "main",
      toRole: "research",
      mode: "parallel-research",
      title: "先调研方案",
      objective: "输出结构化事实",
      contextSummary: ["已有范围", "需要补资料"],
      constraints: ["不要改代码"],
      allowedTools: ["read"],
      expectedOutput: ["结论摘要"],
      definitionOfDone: ["形成结论"],
    });
    const packetDetails = packetResult.details as { packetId: string };

    const handoffTool = createNeigeHandoffTool(config, "main");
    const handoffResult = await handoffTool.execute("call-2", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-002",
      fromRole: "main",
      toRole: "coder",
      reason: "从调研转入实现",
      currentGoal: "完成最小 packet/handoff 工具",
      currentStatus: "doing",
      completed: ["范围已收敛"],
      remaining: ["补实现", "跑测试"],
      risks: ["真实 runtime 未接入"],
      requiredReads: ["PROJECT_STATE.md", "TASK-20260311-002"],
      expectedOutput: ["提交代码", "更新状态"],
    });

    const handoffDetails = handoffResult.details as {
      handoffId: string;
      filePath: string;
      taskLinksPath: string;
    };

    await expectPathExists(handoffDetails.filePath);
    await expectPathExists(handoffDetails.taskLinksPath);

    const handoff = JSON.parse(await readFile(handoffDetails.filePath, "utf8")) as {
      handoffId: string;
      currentStatus: string;
      requiredReads: string[];
    };
    const taskLinks = JSON.parse(await readFile(handoffDetails.taskLinksPath, "utf8")) as {
      packetIds: string[];
      handoffIds: string[];
    };

    expect(handoff.handoffId).toBe(handoffDetails.handoffId);
    expect(handoff.currentStatus).toBe("doing");
    expect(handoff.requiredReads).toContain("PROJECT_STATE.md");
    expect(taskLinks.packetIds).toEqual([packetDetails.packetId]);
    expect(taskLinks.handoffIds).toEqual([handoffDetails.handoffId]);
  });

  it("coder 不能创建 packet，且不会写入任何文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-packet-tool-denied-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigePacketTool(config, "coder");
    await expect(
      tool.execute("call-1", {
        action: "create",
        projectId: "sandbox",
        taskId: "TASK-20260311-003",
        fromRole: "coder",
        toRole: "qa",
        mode: "spawn",
        title: "尝试自行派发",
        objective: "这次应该被拦截",
        contextSummary: ["coder 不应 spawn subagent"],
        constraints: ["不要写任何文件"],
        allowedTools: ["read"],
        expectedOutput: ["不会执行"],
        definitionOfDone: ["不会落盘"],
      }),
    ).rejects.toThrow(/spawn/i);

    await expect(
      stat(join(root, "my-dev-team/projects/sandbox/state/subagent-packets")),
    ).rejects.toBeDefined();
    await expect(
      stat(join(root, "my-dev-team/projects/sandbox/state/task-links")),
    ).rejects.toBeDefined();
  });

  it("coder 可以创建 handoff，但 qa 默认不可以", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-handoff-tool-policy-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const coderTool = createNeigeHandoffTool(config, "coder");
    const coderResult = await coderTool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      taskId: "TASK-20260311-004",
      fromRole: "coder",
      toRole: "main",
      reason: "需要主控接手",
      currentGoal: "上浮阻塞",
      currentStatus: "blocked",
      completed: ["实现已完成"],
      remaining: ["等待主控决策"],
      risks: ["需要重新排期"],
      requiredReads: ["TASK-20260311-004"],
      expectedOutput: ["确认下一步"],
    });

    const coderDetails = coderResult.details as { filePath: string; taskLinksPath: string };
    await expectPathExists(coderDetails.filePath);
    await expectPathExists(coderDetails.taskLinksPath);

    const qaTool = createNeigeHandoffTool(config, "qa");
    await expect(
      qaTool.execute("call-2", {
        action: "create",
        projectId: "sandbox",
        taskId: "TASK-20260311-005",
        fromRole: "qa",
        toRole: "main",
        reason: "尝试交接",
        currentGoal: "这次应该被拦截",
        currentStatus: "blocked",
        completed: ["复现问题"],
        remaining: ["等待处理"],
        risks: ["仍有失败用例"],
        requiredReads: ["TASK-20260311-005"],
        expectedOutput: ["不会落盘"],
      }),
    ).rejects.toThrow(/handoff/i);
  });
});
