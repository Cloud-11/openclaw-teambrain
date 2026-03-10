import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import {
  createTaskDraft,
  finalizeTaskDraft,
  type TaskDraftScope,
} from "../src/task-draft.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("task draft workflow", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会生成包含 triage 决策信息的 Task Draft", () => {
    const draft = createTaskDraft({
      request: "为当前项目实现初始化工具",
      projectId: "sandbox",
      scope: "project-scope",
      owner: "main",
      recommendedRole: "coder",
      triageReasons: ["请求需要进入正式项目追踪范围"],
    });

    expect(draft.scope).toBe("project-scope");
    expect(draft.owner).toBe("main");
    expect(draft.recommendedRole).toBe("coder");
    expect(draft.request).toContain("初始化工具");
    expect(draft.triageReasons).toContain("请求需要进入正式项目追踪范围");
  });

  it("会把 project-scope 的 Task Draft 定版为 Task Card 并写入状态层", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-draft-project-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const draft = createTaskDraft({
      request: "实现初始化工具",
      projectId: "sandbox",
      scope: "project-scope",
      owner: "main",
      recommendedRole: "coder",
      triageReasons: ["请求需要进入正式项目追踪范围"],
    });

    const result = await finalizeTaskDraft(config, draft, {
      owner: "coder",
      definitionOfDone: ["测试通过", "状态写回可用"],
    });

    await expectPathExists(result.taskCardPath);
    await expectPathExists(result.tasksIndexPath);

    const card = await readFile(result.taskCardPath, "utf8");
    const index = await readFile(result.tasksIndexPath, "utf8");

    expect(card).toContain("# Task Card:");
    expect(card).toContain("Project: sandbox");
    expect(card).toContain("Owner: coder");
    expect(index).toContain(result.taskId);
    expect(index).toContain("doing");
  });

  it("会把 adhoc-scope 的 Task Draft 写入 _adhoc 项目状态层", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-task-draft-adhoc-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const draft = createTaskDraft({
      request: "整理一份临时资料清单",
      scope: "adhoc-scope",
      owner: "main",
      triageReasons: ["请求有明确交付物，且值得留痕，但不需要正式项目追踪"],
    });

    const result = await finalizeTaskDraft(config, draft, {
      owner: "main",
      definitionOfDone: ["形成一份可复用清单"],
    });

    expect(result.scope as TaskDraftScope).toBe("adhoc-scope");
    expect(result.taskCardPath).toContain("_adhoc");
    expect(result.tasksIndexPath).toContain("_adhoc");
  });
});
