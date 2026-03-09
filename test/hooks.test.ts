import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeTeamBrainConfig } from "../src/config.ts";
import { buildAgentPromptAddition } from "../src/hooks.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("buildAgentPromptAddition", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会根据 agentId 注入个人档案和项目草稿", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-hook-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/config/profiles/coder.profile.md"),
      "# Coder 档案\n擅长 C# 和 Lua",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/agents_workspace/coder/notes.md"),
      "下午 6 点重置逻辑要小心",
    );

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
      layers: {
        includePrivateWorkspace: true,
      },
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("擅长 C# 和 Lua");
    expect(result).toContain("下午 6 点重置逻辑要小心");
  });

  it("会注入紧凑的写回协议，指导 Agent 调用 teambrain-state", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-hook-protocol-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("teambrain-state");
    expect(result).toContain("set_project_state");
    expect(result).toContain("upsert_todo");
    expect(result).toContain("仅在任务状态真实变化时调用");
  });

  it("会按角色注入不同的写回职责提示", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-hook-role-"));
    tempDirs.push(root);

    const config = normalizeTeamBrainConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const mainPrompt = await buildAgentPromptAddition({
      config,
      agentId: "main",
    });
    const coderPrompt = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(mainPrompt).toContain("Main 负责汇总项目阶段");
    expect(mainPrompt).toContain("优先统一更新 PROJECT_STATE.md");
    expect(coderPrompt).toContain("Coder 在实现完成、阻塞变化");
    expect(coderPrompt).not.toContain("Main 负责汇总项目阶段");
  });
});
