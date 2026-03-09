import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeTeamBrainConfig } from "../src/config.ts";
import {
  createTeamBrainProfileTool,
  createTeamBrainRulesTool,
} from "../src/memory-tools.ts";

describe("memory tools", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("teambrain-profile 会按标准 section 写入并支持 append", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-profile-tool-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const tool = createTeamBrainProfileTool(config);
    await tool.execute("call-1", {
      action: "upsert_section",
      agentId: "coder",
      section: "擅长",
      items: ["C#", "Lua"],
      mode: "replace",
    });
    await tool.execute("call-2", {
      action: "upsert_section",
      agentId: "coder",
      section: "擅长",
      items: ["Python"],
      mode: "append",
    });

    const content = await readFile(
      join(root, "my-dev-team/config/profiles/coder.profile.md"),
      "utf8",
    );

    expect(content).toContain("# coder 个人档案");
    expect(content).toContain("## 擅长");
    expect(content).toContain("- C#");
    expect(content).toContain("- Lua");
    expect(content).toContain("- Python");
  });

  it("teambrain-rules 会受控更新并删除长期规则条目", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-rules-tool-"));
    tempDirs.push(root);

    await mkdir(join(root, "my-dev-team/memory_global"), { recursive: true });
    await writeFile(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      "# 团队长期规则\n\n- [tests] 新功能必须补测试\n",
      "utf8",
    );

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const tool = createTeamBrainRulesTool(config);
    await tool.execute("call-3", {
      action: "upsert_rule",
      ruleId: "exception-handling",
      text: "所有新代码必须包含异常处理。",
    });
    await tool.execute("call-4", {
      action: "remove_rule",
      ruleId: "tests",
    });

    const content = await readFile(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      "utf8",
    );

    expect(content).toContain("- [exception-handling] 所有新代码必须包含异常处理。");
    expect(content).not.toContain("- [tests] 新功能必须补测试");
  });
});
