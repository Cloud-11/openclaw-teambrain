import type { TeamBrainConfig } from "./config.ts";
import { estimateTokensFromText, loadSharedSections, renderPromptSections } from "./files.ts";

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
      const systemPromptAddition = renderPromptSections("TeamBrain 共享上下文", sections, config);

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
