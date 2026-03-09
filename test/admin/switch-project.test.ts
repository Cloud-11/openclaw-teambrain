import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { switchTeamBrainProject } from "../../src/admin/switch-project.ts";

async function expectPathExists(path: string): Promise<void> {
  await expect(stat(path)).resolves.toBeDefined();
}

describe("switchTeamBrainProject", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会补齐项目目录，但不会覆盖已有 PROJECT_STATE.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-switch-"));
    tempDirs.push(root);

    const projectStateDir = join(root, "my-dev-team/projects/stardew-mod/state");
    await mkdir(projectStateDir, { recursive: true });
    await writeFile(
      join(projectStateDir, "PROJECT_STATE.md"),
      "# 项目状态：stardew-mod\n\n## 当前阶段\n修复中\n",
      "utf8",
    );

    const result = await switchTeamBrainProject({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    await expectPathExists(join(root, "my-dev-team/projects/stardew-mod/state"));
    await expectPathExists(join(root, "my-dev-team/projects/stardew-mod/agents_workspace"));
    await expectPathExists(join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"));

    const projectState = await readFile(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "utf8",
    );

    expect(projectState).toContain("修复中");
    expect(result.projectRoot).toBe(join(root, "my-dev-team/projects/stardew-mod"));
    expect(result.createdFiles).toContain(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
    );
  });
});
