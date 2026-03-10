import type { NeigeConfig } from "./config.ts";
import { estimateTokensFromText, loadSharedSections, renderPromptSections } from "./files.ts";

function resolveMaxChars(config: NeigeConfig, tokenBudget?: number): number {
  if (typeof tokenBudget !== "number" || !Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    return config.promptBudget.maxTotalChars;
  }

  return Math.max(120, Math.min(config.promptBudget.maxTotalChars, Math.floor(tokenBudget * 4)));
}

export function createNeigeContextEngine(config: NeigeConfig) {
  return {
    info: {
      id: "neige",
      name: "Neige",
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
      const systemPromptAddition = renderPromptSections("Neige 共享上下文", sections, config, {
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
        reason: "Neige 仅负责外部上下文装配，不接管会话压缩",
      };
    },
  };
}

