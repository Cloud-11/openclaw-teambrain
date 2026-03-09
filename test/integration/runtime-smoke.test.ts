import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRegisteredTeamBrainHarness,
  getRegisteredTool,
} from "../helpers/teambrain-runtime-harness.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("teambrain runtime smoke", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会串通插件注册、共享上下文、Agent hook 和三个写回工具", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-runtime-smoke-"));
    tempDirs.push(root);

    await writeUtf8(join(root, "my-dev-team/memory_global/global_rules.md"), "# 团队长期规则\n\n- [tests] 新功能必须补测试\n");
    await writeUtf8(
      join(root, "my-dev-team/projects/stardew-mod/state/PROJECT_STATE.md"),
      "# 项目状态：stardew-mod\n\n## 当前阶段\n开发中\n\n## 活跃任务\n- 修复崩溃\n\n## 最近更新\n已开始排查。\n",
    );
    await writeUtf8(join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"), "# TODO\n\n- [ ] 修复崩溃\n");
    await writeUtf8(
      join(root, "my-dev-team/config/profiles/coder.profile.md"),
      "# coder 个人档案\n\n## 擅长\n- C#\n",
    );

    const harness = await createRegisteredTeamBrainHarness({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "stardew-mod",
    });

    const assembled = await harness.contextEngine.assemble({
      sessionId: "session-1",
      messages: [{ role: "user", content: "你好" }],
      tokenBudget: 1000,
    });
    expect(assembled.systemPromptAddition).toContain("新功能必须补测试");
    expect(assembled.systemPromptAddition).toContain("修复崩溃");

    const promptHookResult = await harness.runBeforePromptBuild({
      agentId: "coder",
    });
    expect(promptHookResult?.appendSystemContext).toContain("C#");
    expect(promptHookResult?.appendSystemContext).toContain("teambrain-state");

    await getRegisteredTool(harness, "teambrain-profile").execute("call-1", {
      action: "upsert_section",
      agentId: "coder",
      section: "待提升",
      items: ["异步优化"],
      mode: "replace",
    });
    await getRegisteredTool(harness, "teambrain-rules").execute("call-2", {
      action: "upsert_rule",
      ruleId: "exception-handling",
      text: "所有新代码必须包含异常处理。",
    });
    await getRegisteredTool(harness, "teambrain-state").execute("call-3", {
      action: "upsert_todo",
      text: "补集成 smoke 测试",
      done: true,
    });

    const profile = await readFile(
      join(root, "my-dev-team/config/profiles/coder.profile.md"),
      "utf8",
    );
    const rules = await readFile(join(root, "my-dev-team/memory_global/global_rules.md"), "utf8");
    const todo = await readFile(
      join(root, "my-dev-team/projects/stardew-mod/state/TODO.md"),
      "utf8",
    );

    expect(profile).toContain("## 待提升");
    expect(profile).toContain("异步优化");
    expect(rules).toContain("exception-handling");
    expect(todo).toContain("- [x] 补集成 smoke 测试");
  });
});
