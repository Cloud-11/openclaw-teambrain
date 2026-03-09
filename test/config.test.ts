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
});
