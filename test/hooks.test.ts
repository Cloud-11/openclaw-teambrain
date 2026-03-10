import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
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
    const root = await mkdtemp(join(tmpdir(), "neige-hook-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/config/profiles/coder.profile.md"),
      "# Coder 档案\n擅长 C# 和 Lua",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/agents_workspace/coder/notes.md"),
      "下午 6 点重置逻辑要小心",
    );

    const config = normalizeNeigeConfig({
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

  it("会注入紧凑的写回协议，指导 Agent 调用 neige-state", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-protocol-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("neige-state");
    expect(result).toContain("set_project_state");
    expect(result).toContain("upsert_todo");
    expect(result).toContain("仅在任务状态真实变化时调用");
  });

  it("会按角色注入不同的写回职责提示", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-role-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
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

  it("会按配置映射注入自定义角色协议", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-custom-role-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
      agentMappings: {
        roles: {
          planner_agent: "planner",
        },
      },
      rolePolicies: {
        planner: {
          label: "Planner",
          writebackGuidance: [
            "Planner 负责拆解项目阶段和里程碑。",
            "Planner 优先统一维护 PROJECT_STATE.md。",
          ],
        },
      },
    });

    const prompt = await buildAgentPromptAddition({
      config,
      agentId: "planner_agent",
    });

    expect(prompt).toContain("Planner 仅在任务状态真实变化时调用");
    expect(prompt).toContain("Planner 负责拆解项目阶段和里程碑。");
    expect(prompt).toContain("Planner 优先统一维护 PROJECT_STATE.md。");
  });

  it("会通过 hook 注入硬性规则与当前状态摘要", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-required-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      "# 团队长期规则\n\n- [tests] 新功能必须补测试\n",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "# 项目状态：stardew-mod\n\n## 当前阶段\n开发中\n\n## 活跃任务\n- 修复崩溃\n\n## 最近更新\n已开始排查。\n",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
      "# TODO\n\n- [ ] 修复崩溃\n",
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("Hard Rules");
    expect(result).toContain("新功能必须补测试");
    expect(result).toContain("Current State");
    expect(result).toContain("开发中");
    expect(result).toContain("修复崩溃");
  });

  it("在预算很紧时会优先保留规则和状态，而不是技能内容", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-priority-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      "# 团队长期规则\n\n- [tests] 新功能必须补测试\n",
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "# 项目状态：stardew-mod\n\n## 当前阶段\n开发中\n\n## 活跃任务\n- 修复崩溃\n\n## 最近更新\n已开始排查。\n",
    );
    await writeUtf8(
      join(root, "my-dev-team/memory_global/skills/debug-wsl.md"),
      `# Skill: debug-wsl\n\n${"这是很长的技能内容。".repeat(200)}`,
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
      promptBudget: {
        maxTotalChars: 400,
        maxCharsPerSection: 300,
      },
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("Hard Rules");
    expect(result).toContain("Current State");
    expect(result).not.toContain("Skill: debug-wsl");
  });

  it("会注入团队拓扑中的汇报链信息", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-topology-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/config/team-topology.json"),
      JSON.stringify(
        {
          roles: {
            main: { reportsTo: null, handoffTargets: ["coder", "qa"] },
            coder: { reportsTo: "main", handoffTargets: ["qa"] },
          },
        },
        null,
        2,
      ),
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const result = await buildAgentPromptAddition({
      config,
      agentId: "coder",
    });

    expect(result).toContain("Reporting Chain");
    expect(result).toContain("reportsTo: main");
    expect(result).toContain("handoffTargets: qa");
  });
});

