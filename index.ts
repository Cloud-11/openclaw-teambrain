import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { normalizeNeigeConfig } from "./src/config.ts";
import { createNeigeContextEngine } from "./src/engine.ts";
import { buildAgentPromptAddition } from "./src/hooks.ts";
import { createNeigeProfileTool, createNeigeRulesTool } from "./src/memory-tools.ts";
import { createNeigeWritebackTool } from "./src/writeback-tool.ts";

function isNeigeActive(api: OpenClawPluginApi): boolean {
  return api.config.plugins?.slots?.contextEngine === "neige";
}

const plugin = {
  id: "neige",
  name: "Neige",
  description: "将团队规则、项目白板和 Agent 私有上下文从代码仓库外部装配到 OpenClaw 中，形成长期协作系统",
  version: "0.1.0",
  kind: "context-engine",
  async register(api: OpenClawPluginApi) {
    const config = normalizeNeigeConfig(api.pluginConfig ?? {}, api.resolvePath);

    api.registerContextEngine("neige", () => createNeigeContextEngine(config));
    api.registerTool(createNeigeWritebackTool(config));
    api.registerTool(createNeigeProfileTool(config));
    api.registerTool(createNeigeRulesTool(config));

    api.on("before_prompt_build", async (_event, ctx) => {
      if (!isNeigeActive(api)) {
        return;
      }

      const appendSystemContext = await buildAgentPromptAddition({
        config,
        agentId: ctx.agentId,
      });

      return appendSystemContext ? { appendSystemContext } : undefined;
    });
  },
};

export default plugin;

