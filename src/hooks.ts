import type { NeigeConfig } from "./config.ts";
import { loadAgentSections, renderPromptSections } from "./files.ts";
import { buildWritebackProtocolSection } from "./protocol.ts";

export async function buildAgentPromptAddition(params: {
  config: NeigeConfig;
  agentId?: string;
}): Promise<string | undefined> {
  const sections = await loadAgentSections(params.config, params.agentId);

  if (params.agentId) {
    sections.push(buildWritebackProtocolSection(params.config, params.agentId));
  }

  return renderPromptSections("Neige Agent 上下文", sections, params.config);
}

