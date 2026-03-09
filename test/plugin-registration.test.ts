import { describe, expect, it, vi } from "vitest";
import plugin from "../index.ts";

describe("plugin register", () => {
  it("会注册 context-engine 和三个 TeamBrain 工具", async () => {
    const registerContextEngine = vi.fn();
    const registerTool = vi.fn();
    const on = vi.fn();

    await plugin.register({
      config: {
        plugins: {
          slots: {
            contextEngine: "teambrain",
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
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(registerTool.mock.calls.map((call) => call[0]?.name)).toEqual([
      "teambrain-state",
      "teambrain-profile",
      "teambrain-rules",
    ]);
  });
});
