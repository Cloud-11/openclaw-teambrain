import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("branding", () => {
  it("package 与插件清单应统一使用 Neige 品牌名", async () => {
    const packageRaw = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const pluginRaw = await readFile(new URL("../openclaw.plugin.json", import.meta.url), "utf8");
    const packageJson = JSON.parse(packageRaw.replace(/^\uFEFF/, "")) as {
      name: string;
      description: string;
      openclaw?: { extensions?: string[] };
      scripts?: Record<string, string>;
    };
    const pluginManifest = JSON.parse(pluginRaw.replace(/^\uFEFF/, "")) as {
      id: string;
      name: string;
    };

    expect(packageJson.name).toBe("neige");
    expect(packageJson.description).toContain("Neige");
    expect(packageJson.scripts?.["neige:init"]).toBeDefined();
    expect(packageJson.scripts?.["neige:switch"]).toBeDefined();
    expect(packageJson.scripts?.["neige:health"]).toBeDefined();
    expect(pluginManifest.id).toBe("neige");
    expect(pluginManifest.name).toBe("Neige");
  });
});
