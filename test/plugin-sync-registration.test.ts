import { describe, expect, it, vi } from "vitest";
import plugin from "../index.ts";

describe("plugin register sync contract", () => {
  it("register 应同步完成注册，而不是返回 Promise", () => {
    const registerContextEngine = vi.fn();
    const registerTool = vi.fn();
    const on = vi.fn();

    const result = plugin.register({
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

    expect(result).toBeUndefined();
    expect(registerContextEngine).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledTimes(10);
    expect(on).toHaveBeenCalledTimes(1);
  });
});
