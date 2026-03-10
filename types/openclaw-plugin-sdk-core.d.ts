declare module "openclaw/plugin-sdk/core" {
  export type PluginToolResult = {
    content: Array<{ type: string; text: string }>;
    details?: unknown;
  };

  export type PluginTool = {
    name: string;
    label: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (id: string, params: Record<string, unknown>) => Promise<PluginToolResult>;
  };

  export type PluginToolContext = {
    agentId?: string;
    sessionKey?: string;
    workspaceDir?: string;
    agentDir?: string;
  };

  export type PluginToolFactory = (
    ctx: PluginToolContext,
  ) => PluginTool | PluginTool[] | null | undefined;

  export type OpenClawPluginApi = {
    config: {
      plugins?: {
        slots?: {
          contextEngine?: string;
        };
      };
    };
    pluginConfig?: Record<string, unknown>;
    resolvePath: (input: string) => string;
    registerContextEngine: (id: string, factory: () => unknown) => void;
    registerTool: (
      tool: PluginTool | PluginToolFactory,
      opts?: { optional?: boolean; name?: string; names?: string[] },
    ) => void;
    on: (
      hookName: "before_prompt_build",
      handler: (
        event: { prompt: string; messages: unknown[] },
        ctx: { agentId?: string },
      ) => Promise<{ appendSystemContext?: string } | undefined> | { appendSystemContext?: string } | undefined,
    ) => void;
  };
}
