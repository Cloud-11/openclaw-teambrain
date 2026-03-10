import type { PluginTool } from "openclaw/plugin-sdk/core";
import plugin from "../../index.ts";

type TeamBrainHarnessConfig = {
  brainRoot: string;
  teamId: string;
  projectId: string;
};

type BeforePromptBuildResult = {
  appendSystemContext?: string;
};

type ContextEngineLike = {
  assemble: (params: {
    sessionId: string;
    messages: unknown[];
    tokenBudget?: number;
  }) => Promise<{
    messages: unknown[];
    estimatedTokens: number;
    systemPromptAddition?: string;
  }>;
};

type BeforePromptBuildHandler = (
  event: { prompt: string; messages: unknown[] },
  ctx: { agentId?: string },
) => Promise<BeforePromptBuildResult | undefined> | BeforePromptBuildResult | undefined;

export type TeamBrainRuntimeHarness = {
  registeredTools: PluginTool[];
  contextEngine: ContextEngineLike;
  runBeforePromptBuild: (ctx: { agentId?: string }) => Promise<BeforePromptBuildResult | undefined>;
};

export async function createRegisteredTeamBrainHarness(
  config: TeamBrainHarnessConfig,
): Promise<TeamBrainRuntimeHarness> {
  const registeredTools: PluginTool[] = [];
  let contextEngineFactory: (() => ContextEngineLike) | undefined;
  let beforePromptBuildHandler: BeforePromptBuildHandler | undefined;

  await plugin.register({
      config: {
        plugins: {
          slots: {
            contextEngine: "neige",
          },
        },
      },
    pluginConfig: config,
    resolvePath: (input: string) => input,
    registerContextEngine: (_id, factory) => {
      contextEngineFactory = factory as () => ContextEngineLike;
    },
    registerTool: (tool) => {
      registeredTools.push(tool);
    },
    on: (_hookName, handler) => {
      beforePromptBuildHandler = handler as BeforePromptBuildHandler;
    },
  });

  if (!contextEngineFactory) {
    throw new Error("未注册 TeamBrain context-engine");
  }

  if (!beforePromptBuildHandler) {
    throw new Error("未注册 before_prompt_build hook");
  }

  return {
    registeredTools,
    contextEngine: contextEngineFactory(),
    runBeforePromptBuild: (ctx) =>
      Promise.resolve(beforePromptBuildHandler?.({ prompt: "", messages: [] }, ctx)),
  };
}

export function getRegisteredTool(
  harness: TeamBrainRuntimeHarness,
  toolName: string,
): PluginTool {
  const tool = harness.registeredTools.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`未找到工具：${toolName}`);
  }

  return tool;
}
