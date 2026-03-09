import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeTeamBrainConfig } from "../src/config.ts";
import { createTeamBrainWritebackTool } from "../src/writeback-tool.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("createTeamBrainWritebackTool", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会写入 PROJECT_STATE.md 并自动创建目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-writeback-state-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const tool = createTeamBrainWritebackTool(config);
    await tool.execute("call-1", {
      action: "set_project_state",
      stage: "开发中",
      activeTasks: ["修复 18:00 崩溃", "补单元测试"],
      summary: "Coder 已开始排查定时逻辑",
    });

    const content = await readFile(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "utf8",
    );

    expect(content).toContain("# 项目状态：stardew-mod");
    expect(content).toContain("## 当前阶段");
    expect(content).toContain("开发中");
    expect(content).toContain("- 修复 18:00 崩溃");
    expect(content).toContain("- 补单元测试");
    expect(content).toContain("Coder 已开始排查定时逻辑");
  });

  it("会新增并更新 TODO 项状态", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-writeback-todo-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const tool = createTeamBrainWritebackTool(config);
    await tool.execute("call-2", {
      action: "upsert_todo",
      text: "修复下午 6 点崩溃",
      done: false,
    });
    await tool.execute("call-3", {
      action: "upsert_todo",
      text: "修复下午 6 点崩溃",
      done: true,
    });

    const content = await readFile(join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"), "utf8");
    expect(content).toContain("# TODO");
    expect(content).toContain("- [x] 修复下午 6 点崩溃");
  });

  it("会删除 TODO 项", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-writeback-remove-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
      "# TODO\n\n- [ ] 修复下午 6 点崩溃\n- [ ] 补文档\n",
    );

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const tool = createTeamBrainWritebackTool(config);
    await tool.execute("call-4", {
      action: "remove_todo",
      text: "修复下午 6 点崩溃",
    });

    const content = await readFile(join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"), "utf8");
    expect(content).not.toContain("修复下午 6 点崩溃");
    expect(content).toContain("补文档");
  });

  it("遇到锁文件时会等待后再写入，避免并发覆盖", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-writeback-lock-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const stateDir = join(root, "my-dev-team/projects/stardew-mod/state");
    const lockDir = join(stateDir, ".teambrain.lock");
    await mkdir(lockDir, { recursive: true });

    const tool = createTeamBrainWritebackTool(config);
    const startedAt = Date.now();

    setTimeout(() => {
      void rm(lockDir, { recursive: true, force: true });
    }, 120);

    await tool.execute("call-5", {
      action: "upsert_todo",
      text: "等待锁释放后写入",
      done: false,
    });

    const elapsed = Date.now() - startedAt;
    const content = await readFile(join(stateDir, "TODO.md"), "utf8");

    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(content).toContain("等待锁释放后写入");
  });
});
