import type { TeamBrainConfig } from "./config.ts";
import { loadAgentSections, renderPromptSections } from "./files.ts";
import { buildWritebackProtocolSection } from "./protocol.ts";

export async function buildAgentPromptAddition(params: {
  config: TeamBrainConfig;
  agentId?: string;
}): Promise<string | undefined> {
  const sections = await loadAgentSections(params.config, params.agentId);

  if (params.agentId) {
    sections.push(buildWritebackProtocolSection(params.agentId));
  }

  return renderPromptSections("TeamBrain Agent 上下文", sections, params.config);
}
