import type { TeamBrainConfig } from "./config.ts";
import { loadAgentSections, renderPromptSections } from "./files.ts";

export async function buildAgentPromptAddition(params: {
  config: TeamBrainConfig;
  agentId?: string;
}): Promise<string | undefined> {
  const sections = await loadAgentSections(params.config, params.agentId);
  return renderPromptSections("TeamBrain Agent 上下文", sections, params.config);
}
