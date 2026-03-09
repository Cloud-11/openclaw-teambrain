import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTeamBrainHealth } from "../../src/admin/health-check.ts";

describe("checkTeamBrainHealth", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会返回缺失目录、缺失文件和建议动作", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-health-"));
    tempDirs.push(root);

    await mkdir(join(root, "my-dev-team/projects/stardew-mod/state"), { recursive: true });
    await writeFile(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "# 项目状态：stardew-mod\n",
      "utf8",
    );

    const result = await checkTeamBrainHealth({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    expect(result.ok).toBe(false);
    expect(result.missingDirectories).toContain(join(root, "my-dev-team/config"));
    expect(result.missingDirectories).toContain(
      join(root, "my-dev-team/projects/stardew-mod/agents_workspace"),
    );
    expect(result.missingFiles).toContain(join(root, "my-dev-team/memory_global/global_rules.md"));
    expect(result.missingFiles).toContain(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
    );
    expect(result.suggestions).toContain("运行初始化工具补齐 TeamBrain 目录和模板文件。");
  });
});
