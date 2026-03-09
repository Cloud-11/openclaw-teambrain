import { describe, expect, it } from "vitest";
import { normalizeTeamBrainConfig } from "../src/config.ts";

describe("normalizeTeamBrainConfig", () => {
  it("会补齐默认值并解析 brainRoot", () => {
    const config = normalizeTeamBrainConfig(
      {
        brainRoot: "./brains",
        teamId: "my-dev-team",
        projectId: "stardew-mod",
      },
      (input) => `D:/workspace/${input.replace(/^\.\/?/, "")}`,
    );

    expect(config.brainRoot).toBe("D:/workspace/brains");
    expect(config.layers.includeTeamCharter).toBe(true);
    expect(config.layers.includeGlobalRules).toBe(true);
    expect(config.layers.includeProfiles).toBe(true);
    expect(config.layers.includeProjectState).toBe(true);
    expect(config.layers.includeTodo).toBe(true);
    expect(config.layers.includePrivateWorkspace).toBe(false);
    expect(config.promptBudget.maxCharsPerSection).toBeGreaterThan(1000);
    expect(config.promptBudget.maxTotalChars).toBeGreaterThan(config.promptBudget.maxCharsPerSection);
  });

  it("会解析角色映射与自定义角色策略", () => {
    const config = normalizeTeamBrainConfig({
      brainRoot: "./brains",
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
            "Planner 负责拆解里程碑。",
            "Planner 优先维护 PROJECT_STATE.md。",
          ],
        },
      },
    });

    expect(config.agentMappings.roles.planner_agent).toBe("planner");
    expect(config.rolePolicies.planner?.label).toBe("Planner");
    expect(config.rolePolicies.planner?.writebackGuidance).toContain(
      "Planner 负责拆解里程碑。",
    );
  });
});
