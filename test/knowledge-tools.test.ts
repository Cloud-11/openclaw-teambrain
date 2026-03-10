import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import {
  createNeigeCandidateTool,
  createNeigeHookPreviewTool,
  createNeigeSkillTool,
} from "../src/knowledge-tools.ts";

describe("knowledge tools", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("neige-candidate 会创建知识候选并支持更新状态", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-candidate-tool-"));
    tempDirs.push(root);

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeCandidateTool(config);
    const created = await tool.execute("call-1", {
      action: "create",
      projectId: "sandbox",
      agentId: "coder",
      roleId: "coder",
      title: "WSL 调试经验",
      summary: "统一路径和运行时来源",
      candidateType: "workflow-skill",
      signal: 2,
    });

    const candidateId = (created.details as { candidateId: string }).candidateId;
    const filePath = join(
      root,
      "my-dev-team/projects/sandbox/state/knowledge_candidates",
      `${candidateId}.json`,
    );

    await tool.execute("call-2", {
      action: "set_status",
      projectId: "sandbox",
      candidateId,
      status: "reviewing",
    });

    const content = JSON.parse(await readFile(filePath, "utf8")) as {
      title: string;
      status: string;
      signal: number;
    };

    expect(content.title).toBe("WSL 调试经验");
    expect(content.status).toBe("reviewing");
    expect(content.signal).toBe(2);
  });

  it("neige-skill 会从 candidate 提升 skill 并更新 registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-skill-tool-"));
    tempDirs.push(root);

    const candidateDir = join(root, "my-dev-team/projects/sandbox/state/knowledge_candidates");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      join(candidateDir, "KC-20260311-001.json"),
      JSON.stringify(
        {
          id: "KC-20260311-001",
          projectId: "sandbox",
          agentId: "coder",
          roleId: "coder",
          title: "WSL 调试经验",
          summary: "统一路径和运行时来源",
          candidateType: "workflow-skill",
          signal: 3,
          status: "reviewing",
          evidence: ["真实接入已完成"],
          boundaries: ["仅适用于 OpenClaw 插件开发"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeSkillTool(config);
    const result = await tool.execute("call-3", {
      action: "promote_candidate",
      candidateId: "KC-20260311-001",
      skillName: "openclaw-plugin-wsl-debug",
      skillTitle: "OpenClaw 插件 WSL 调试流程",
    });

    const skillId = (result.details as { skillId: string }).skillId;
    const skillPath = join(root, "my-dev-team/memory_global/skills", `${skillId}.json`);
    const registryPath = join(root, "my-dev-team/memory_global/skills/skill-registry.json");
    const candidatePath = join(candidateDir, "KC-20260311-001.json");

    const skill = JSON.parse(await readFile(skillPath, "utf8")) as { title: string };
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      entries: Array<{ id: string; name: string }>;
    };
    const candidate = JSON.parse(await readFile(candidatePath, "utf8")) as { status: string };

    expect(skill.title).toBe("OpenClaw 插件 WSL 调试流程");
    expect(registry.entries[0]?.name).toBe("openclaw-plugin-wsl-debug");
    expect(candidate.status).toBe("promoted");
  });

  it("neige-hook-preview 会返回当前角色的 hook 注入结果", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-hook-preview-tool-"));
    tempDirs.push(root);

    await mkdir(join(root, "my-dev-team/memory_global"), { recursive: true });
    await writeFile(
      join(root, "my-dev-team/memory_global/global_rules.md"),
      "# 团队长期规则\n\n- [tests] 新功能必须补测试\n",
      "utf8",
    );
    await mkdir(join(root, "my-dev-team/projects/sandbox/state"), { recursive: true });
    await writeFile(
      join(root, "my-dev-team/projects/sandbox/state/PROJECT_STATE.md"),
      "# 项目状态：sandbox\n\n## 当前阶段\n开发中\n\n## 活跃任务\n- 实现 triage\n\n## 最近更新\n已开始。\n",
      "utf8",
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "sandbox",
    });

    const tool = createNeigeHookPreviewTool(config);
    const result = await tool.execute("call-4", {
      action: "preview",
      agentId: "coder",
    });

    expect(result.content[0]?.text).toContain("Hard Rules");
    expect(result.content[0]?.text).toContain("Current State");
    expect(result.content[0]?.text).toContain("Role Policy");
  });
});
