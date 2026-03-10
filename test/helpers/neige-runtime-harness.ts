import type { PluginTool, PluginToolFactory } from "openclaw/plugin-sdk/core";
import plugin from "../../index.ts";

type NeigeHarnessConfig = {
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

type ToolRegistration = {
  tool: PluginTool | PluginToolFactory;
  opts?: { optional?: boolean; name?: string; names?: string[] };
};

export type NeigeRuntimeHarness = {
  registrations: ToolRegistration[];
  contextEngine: ContextEngineLike;
  runBeforePromptBuild: (ctx: { agentId?: string }) => Promise<BeforePromptBuildResult | undefined>;
};

export async function createRegisteredNeigeHarness(
  config: NeigeHarnessConfig,
  pluginConfigOverride?: Record<string, unknown>,
): Promise<NeigeRuntimeHarness> {
  const registrations: ToolRegistration[] = [];
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
    pluginConfig: {
      ...config,
      ...(pluginConfigOverride ?? {}),
    },
    resolvePath: (input: string) => input,
    registerContextEngine: (_id, factory) => {
      contextEngineFactory = factory as () => ContextEngineLike;
    },
    registerTool: (tool, opts) => {
      registrations.push({ tool, opts });
    },
    on: (_hookName, handler) => {
      beforePromptBuildHandler = handler as BeforePromptBuildHandler;
    },
  });

  if (!contextEngineFactory) {
    throw new Error("未注册 Neige context-engine");
  }

  if (!beforePromptBuildHandler) {
    throw new Error("未注册 before_prompt_build hook");
  }

  return {
    registrations,
    contextEngine: contextEngineFactory(),
    runBeforePromptBuild: (ctx) =>
      Promise.resolve(beforePromptBuildHandler?.({ prompt: "", messages: [] }, ctx)),
  };
}

export function getResolvedTools(
  harness: NeigeRuntimeHarness,
  ctx: { agentId?: string } = {},
): PluginTool[] {
  const tools: PluginTool[] = [];
  for (const registration of harness.registrations) {
    const resolved =
      typeof registration.tool === "function"
        ? registration.tool({
            agentId: ctx.agentId,
          })
        : registration.tool;
    if (!resolved) {
      continue;
    }
    const list = Array.isArray(resolved) ? resolved : [resolved];
    tools.push(...list);
  }
  return tools;
}

export function getResolvedToolNames(
  harness: NeigeRuntimeHarness,
  ctx: { agentId?: string } = {},
): string[] {
  return getResolvedTools(harness, ctx).map((tool) => tool.name);
}

export function getRegisteredTool(
  harness: NeigeRuntimeHarness,
  toolName: string,
  ctx: { agentId?: string } = {},
): PluginTool {
  const tool = getResolvedTools(harness, ctx).find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`未找到工具：${toolName}`);
  }

  return tool;
}
