import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRegisteredNeigeHarness, getResolvedToolNames } from "../test/helpers/neige-runtime-harness.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("role policy enforcement", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("会按 role policy 隐藏不允许的插件工具", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-role-enforcement-"));
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

    const harness = await createRegisteredNeigeHarness(
      {
        brainRoot: root,
        teamId: "my-dev-team",
        projectId: "sandbox",
      },
      {
        rolePolicies: {
          coder: {
            label: "Coder",
            writebackGuidance: ["Coder 只负责实现和任务级状态更新。"],
            deniedTools: ["neige-rules"],
          },
        },
      },
    );

    const coderTools = getResolvedToolNames(harness, { agentId: "coder" });
    const mainTools = getResolvedToolNames(harness, { agentId: "main" });

    expect(coderTools).not.toContain("neige-rules");
    expect(coderTools).toContain("neige-state");
    expect(mainTools).toContain("neige-rules");
  });
});
