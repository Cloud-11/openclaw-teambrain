import { describe, expect, it, vi } from "vitest";
import plugin from "../index.ts";

describe("plugin register", () => {
  it("会注册 Neige context-engine 和九个 Neige 工具", async () => {
    const registerContextEngine = vi.fn();
    const registerTool = vi.fn();
    const on = vi.fn();

    await plugin.register({
      config: {
        plugins: {
          slots: {
            contextEngine: "neige",
          },
        },
      },
      pluginConfig: {
        brainRoot: "./brains",
        teamId: "my-dev-team",
        projectId: "stardew-mod",
      },
      resolvePath: (input: string) => input,
      registerContextEngine,
      registerTool,
      on,
    });

    expect(registerContextEngine).toHaveBeenCalledTimes(1);
    expect(registerContextEngine.mock.calls[0]?.[0]).toBe("neige");
    expect(registerTool).toHaveBeenCalledTimes(9);
    expect(registerTool.mock.calls.map((call) => call[1]?.name)).toEqual([
      "neige-state",
      "neige-profile",
      "neige-rules",
      "neige-task",
      "neige-checkpoint",
      "neige-closeout",
      "neige-candidate",
      "neige-skill",
      "neige-hook-preview",
    ]);
  });
});
