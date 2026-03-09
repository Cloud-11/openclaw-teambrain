import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { normalizeTeamBrainConfig } from "./src/config.ts";
import { createTeamBrainContextEngine } from "./src/engine.ts";
import { buildAgentPromptAddition } from "./src/hooks.ts";
import { createTeamBrainProfileTool, createTeamBrainRulesTool } from "./src/memory-tools.ts";
import { createTeamBrainWritebackTool } from "./src/writeback-tool.ts";

function isTeamBrainActive(api: OpenClawPluginApi): boolean {
  return api.config.plugins?.slots?.contextEngine === "teambrain";
}

const plugin = {
  id: "teambrain",
  name: "OpenClaw TeamBrain",
  description: "将团队规则、项目白板和 Agent 私有上下文从代码仓库外部装配到 OpenClaw 中",
  version: "0.1.0",
  kind: "context-engine",
  async register(api: OpenClawPluginApi) {
    const config = normalizeTeamBrainConfig(api.pluginConfig ?? {}, api.resolvePath);

    api.registerContextEngine("teambrain", () => createTeamBrainContextEngine(config));
    api.registerTool(createTeamBrainWritebackTool(config));
    api.registerTool(createTeamBrainProfileTool(config));
    api.registerTool(createTeamBrainRulesTool(config));

    api.on("before_prompt_build", async (_event, ctx) => {
      if (!isTeamBrainActive(api)) {
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
