import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { normalizeNeigeConfig } from "./src/config.ts";
import { createNeigeContextEngine } from "./src/engine.ts";
import { buildAgentPromptAddition } from "./src/hooks.ts";
import {
  createNeigeCheckpointTool,
  createNeigeCloseoutTool,
  createNeigeTaskTool,
} from "./src/collaboration-tools.ts";
import { createNeigeProfileTool, createNeigeRulesTool } from "./src/memory-tools.ts";
import {
  createNeigeCandidateTool,
  createNeigeHookPreviewTool,
  createNeigeSkillTool,
} from "./src/knowledge-tools.ts";
import { isNeigeToolAllowedForAgent } from "./src/role-enforcement.ts";
import { createNeigeReviewTool } from "./src/review-tools.ts";
import { createNeigeWritebackTool } from "./src/writeback-tool.ts";

function isNeigeActive(api: OpenClawPluginApi): boolean {
  return api.config.plugins?.slots?.contextEngine === "neige";
}

function registerRoleScopedTool(
  api: OpenClawPluginApi,
  config: ReturnType<typeof normalizeNeigeConfig>,
  toolName: string,
  createTool: () => Parameters<OpenClawPluginApi["registerTool"]>[0] extends infer _T ? any : never,
) {
  api.registerTool(
    (ctx) => {
      if (!isNeigeToolAllowedForAgent(config, ctx.agentId, toolName)) {
        return null;
      }

      return createTool();
    },
    { name: toolName },
  );
}

const plugin = {
  id: "neige",
  name: "Neige",
  description: "将团队规则、项目白板和 Agent 私有上下文从代码仓库外部装配到 OpenClaw 中，形成长期协作系统",
  version: "0.1.0",
  kind: "context-engine",
  register(api: OpenClawPluginApi) {
    const config = normalizeNeigeConfig(api.pluginConfig ?? {}, api.resolvePath);

    api.registerContextEngine("neige", () => createNeigeContextEngine(config));
    registerRoleScopedTool(api, config, "neige-state", () => createNeigeWritebackTool(config));
    registerRoleScopedTool(api, config, "neige-profile", () => createNeigeProfileTool(config));
    registerRoleScopedTool(api, config, "neige-rules", () => createNeigeRulesTool(config));
    registerRoleScopedTool(api, config, "neige-task", () => createNeigeTaskTool(config));
    registerRoleScopedTool(api, config, "neige-checkpoint", () => createNeigeCheckpointTool(config));
    registerRoleScopedTool(api, config, "neige-closeout", () => createNeigeCloseoutTool(config));
    registerRoleScopedTool(api, config, "neige-candidate", () => createNeigeCandidateTool(config));
    registerRoleScopedTool(api, config, "neige-skill", () => createNeigeSkillTool(config));
    registerRoleScopedTool(api, config, "neige-hook-preview", () => createNeigeHookPreviewTool(config));
    registerRoleScopedTool(api, config, "neige-review", () => createNeigeReviewTool(config));

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

