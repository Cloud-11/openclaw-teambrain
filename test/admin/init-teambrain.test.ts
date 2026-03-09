import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeTeamBrain } from "../../src/admin/init-teambrain.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("initializeTeamBrain", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会创建最小 TeamBrain 目录与 UTF-8 模板文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-init-"));
    tempDirs.push(root);

    const result = await initializeTeamBrain({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const teamRoot = join(root, "my-dev-team");
    const configDir = join(teamRoot, "config");
    const memoryGlobalDir = join(teamRoot, "memory_global");
    const projectStateDir = join(teamRoot, "projects", "stardew-mod", "state");

    await expectPathExists(configDir);
    await expectPathExists(memoryGlobalDir);
    await expectPathExists(projectStateDir);

    const globalRulesPath = join(memoryGlobalDir, "global_rules.md");
    const projectStatePath = join(projectStateDir, "PROJECT_STATE.md");
    const todoPath = join(projectStateDir, "TODO.md");

    await expectPathExists(globalRulesPath);
    await expectPathExists(projectStatePath);
    await expectPathExists(todoPath);

    const globalRules = await readFile(globalRulesPath, "utf8");
    const projectState = await readFile(projectStatePath, "utf8");
    const todo = await readFile(todoPath, "utf8");

    expect(globalRules).toContain("团队");
    expect(projectState).toContain("项目状态：stardew-mod");
    expect(todo).toContain("# TODO");

    expect(result.teamRoot).toBe(teamRoot);
    expect(result.projectStateDir).toBe(projectStateDir);
    expect(result.createdFiles).toEqual(
      expect.arrayContaining([globalRulesPath, projectStatePath, todoPath]),
    );
  });
});
