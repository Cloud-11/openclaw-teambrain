import type { TeamBrainConfig } from "./config.ts";
import { estimateTokensFromText, loadSharedSections, renderPromptSections } from "./files.ts";

function resolveMaxChars(config: TeamBrainConfig, tokenBudget?: number): number {
  if (typeof tokenBudget !== "number" || !Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    return config.promptBudget.maxTotalChars;
  }

  return Math.max(120, Math.min(config.promptBudget.maxTotalChars, Math.floor(tokenBudget * 4)));
}

export function createTeamBrainContextEngine(config: TeamBrainConfig) {
  return {
    info: {
      id: "teambrain",
      name: "OpenClaw TeamBrain",
      version: "0.1.0",
    },
    async ingest() {
      return { ingested: false };
    },
    async assemble(params: {
      sessionId: string;
      messages: unknown[];
      tokenBudget?: number;
    }) {
      const sections = await loadSharedSections(config);
      const systemPromptAddition = renderPromptSections("TeamBrain 共享上下文", sections, config, {
        maxTotalChars: resolveMaxChars(config, params.tokenBudget),
      });

      return {
        messages: params.messages,
        estimatedTokens: estimateTokensFromText(systemPromptAddition),
        systemPromptAddition,
      };
    },
    async compact() {
      return {
        ok: true,
        compacted: false,
        reason: "TeamBrain 仅负责外部上下文装配，不接管会话压缩",
      };
    },
  };
}
