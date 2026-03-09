declare module "openclaw/plugin-sdk/core" {
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
    on: (
      hookName: "before_prompt_build",
      handler: (
        event: { prompt: string; messages: unknown[] },
        ctx: { agentId?: string },
      ) => Promise<{ appendSystemContext?: string } | undefined> | { appendSystemContext?: string } | undefined,
    ) => void;
  };
}
