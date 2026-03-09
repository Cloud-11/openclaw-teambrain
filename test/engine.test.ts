import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeTeamBrainConfig } from "../src/config.ts";
import { createTeamBrainContextEngine } from "../src/engine.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("createTeamBrainContextEngine", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会把团队规则和项目状态装配到系统上下文里", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-engine-"));
    tempDirs.push(root);

    await writeUtf8(join(root, "my-dev-team/config/team-charter.md"), "# 团队宪法\n必须写单元测试");
    await writeUtf8(join(root, "my-dev-team/memory_global/global_rules.md"), "# 全局规则\n禁止高危命令");
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "# 项目状态\n当前阶段：修复崩溃",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
      "- 修复下午 6 点崩溃",
    );

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const engine = createTeamBrainContextEngine(config);
    const messages = [{ role: "user", content: "你好", timestamp: Date.now() }] as never[];
    const result = await engine.assemble({
      sessionId: "session-1",
      messages,
      tokenBudget: 8000,
    });

    expect(result.messages).toBe(messages);
    expect(result.systemPromptAddition).toContain("必须写单元测试");
    expect(result.systemPromptAddition).toContain("禁止高危命令");
    expect(result.systemPromptAddition).toContain("当前阶段：修复崩溃");
    expect(result.systemPromptAddition).toContain("修复下午 6 点崩溃");
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("在项目文件缺失时会优雅降级而不是抛错", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-engine-empty-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "empty-project",
    });

    const engine = createTeamBrainContextEngine(config);
    const result = await engine.assemble({
      sessionId: "session-empty",
      messages: [],
    });

    expect(result.messages).toEqual([]);
    expect(result.estimatedTokens).toBe(0);
    expect(result.systemPromptAddition).toBeUndefined();
  });

  it("会根据 assemble 的 tokenBudget 收紧最终上下文大小", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-engine-budget-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/config/team-charter.md"),
      `# 团队宪法\n${"必须写测试并同步状态。".repeat(80)}`,
    );
    await writeUtf8(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      `# 全局规则\n${"禁止高危命令并保持任务同步。".repeat(80)}`,
    );

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "budget-project",
      promptBudget: {
        maxTotalChars: 8000,
      },
    });

    const engine = createTeamBrainContextEngine(config);
    const result = await engine.assemble({
      sessionId: "session-budget",
      messages: [],
      tokenBudget: 80,
    });

    expect(result.systemPromptAddition).toBeDefined();
    expect(result.estimatedTokens).toBeLessThanOrEqual(80);
    expect(result.systemPromptAddition!.length).toBeLessThanOrEqual(320);
  });
});
