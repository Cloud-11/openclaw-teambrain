import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { runNeigeMainAction } from "../src/main-runtime.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("main runtime", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会把 session-scope 请求留在当前会话，不创建 Task Card", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-main-session-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const result = await runNeigeMainAction(config, {
      action: "intake",
      request: "帮我快速总结一下两个方案的差别",
      signals: {
        isSimpleQuestion: true,
      },
    });

    if (result.mode !== "session-response") {
      throw new Error(`unexpected mode: ${result.mode}`);
    }

    expect(result.mode).toBe("session-response");
    expect(result.triage.scope).toBe("session-scope");
    expect(result.taskDraft).toBeUndefined();
    expect(result.taskCard).toBeUndefined();
    await expect(
      stat(join(root, "my-dev-team/projects/_session/state/task-cards")),
    ).rejects.toBeDefined();
  });

  it("会把 project-scope 请求定版为 Task Card，并在提供 session 信息时回写 SessionRef", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-main-project-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const result = await runNeigeMainAction(config, {
      action: "intake",
      request: "为 sandbox 实现初始化工具，并交给 coder 推进",
      signals: {
        hasExplicitDeliverable: true,
        requiresTracking: true,
        activeProjectId: "sandbox",
        requiresSpecialistRole: true,
        preferredRole: "coder",
      },
      taskOwner: "coder",
      definitionOfDone: ["测试通过", "真实运行时可调用"],
      constraints: ["不要破坏现有 sandbox 状态", "保持 UTF-8 文本写入"],
      risks: ["真实 Gateway 可能与隔离副本不同步"],
      nextAction: "继续做真实 WSL/OpenClaw 复测",
      session: {
        sessionKey: "agent:main:main",
        agentId: "main",
        roleId: "main",
        kind: "main-session",
        purpose: "主线协调与总管 intake",
      },
    });

    if (result.mode !== "task-created") {
      throw new Error(`unexpected mode: ${result.mode}`);
    }

    expect(result.mode).toBe("task-created");
    expect(result.triage.scope).toBe("project-scope");
    expect(result.taskDraft?.recommendedRole).toBe("coder");
    expect(result.taskCard?.stateProjectId).toBe("sandbox");
    expect(result.sessionRef).toBeDefined();

    const card = await readFile(result.taskCard!.taskCardPath, "utf8");
    const taskSessions = JSON.parse(await readFile(result.sessionRef!.taskSessionsPath, "utf8")) as {
      sessionRefs: Array<{
        sessionKey: string;
        linkedTaskId: string;
        taskOwner?: string;
        taskScope?: string;
        linkedAt?: string;
      }>;
    };
    const sessionIndex = JSON.parse(await readFile(result.sessionRef!.sessionIndexPath, "utf8")) as {
      entries: Array<{ sessionKey: string; taskId: string; projectId: string }>;
    };

    expect(card).toContain("Project: sandbox");
    expect(card).toContain("Owner: coder");
    expect(card).toContain("## 约束");
    expect(card).toContain("不要破坏现有 sandbox 状态");
    expect(card).toContain("## 风险");
    expect(card).toContain("真实 Gateway 可能与隔离副本不同步");
    expect(card).toContain("## 下一步");
    expect(card).toContain("继续做真实 WSL/OpenClaw 复测");
    expect(taskSessions.sessionRefs).toHaveLength(1);
    expect(taskSessions.sessionRefs[0]?.sessionKey).toBe("agent:main:main");
    expect(taskSessions.sessionRefs[0]?.linkedTaskId).toBe(result.taskCard!.taskId);
    expect(taskSessions.sessionRefs[0]?.taskOwner).toBe("coder");
    expect(taskSessions.sessionRefs[0]?.taskScope).toBe("project-scope");
    expect(taskSessions.sessionRefs[0]?.linkedAt).toBeDefined();
    expect(sessionIndex.entries).toEqual([
      {
        sessionKey: "agent:main:main",
        taskId: result.taskCard!.taskId,
        projectId: "sandbox",
      },
    ]);
  });

  it("会刷新 portfolio board 并返回真实落盘路径", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-main-portfolio-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/projects/alpha/state/PROJECT_STATE.md"),
      ["# 项目状态：alpha", "", "## 当前阶段", "开发中", "", "## 活跃任务", "- 实现登录", ""].join(
        "\n",
      ),
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/beta/state/PROJECT_STATE.md"),
      ["# 项目状态：beta", "", "## 当前阶段", "验证中", "", "## 阻塞事项", "- 缺少测试账号", ""].join(
        "\n",
      ),
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "alpha",
    });

    const result = await runNeigeMainAction(config, {
      action: "portfolio",
    });

    expect(result.mode).toBe("portfolio-refreshed");
    expect(result.portfolio).toBeDefined();

    const board = await readFile(result.portfolio!.filePath, "utf8");
    expect(board).toContain("# Portfolio Board");
    expect(board).toContain("- 项目数: 2");
    expect(board).toContain("## 项目：alpha");
    expect(board).toContain("## 项目：beta");
  });
});
