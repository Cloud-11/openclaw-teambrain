import { join } from "node:path";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8, type PromptSection } from "./files.ts";

export type TeamTopologyRole = {
  reportsTo?: string | null;
  handoffTargets?: string[];
};

export type TeamTopology = {
  roles: Record<string, TeamTopologyRole>;
};

function teamRoot(config: NeigeConfig): string {
  return join(config.brainRoot, config.teamId);
}

export async function loadTeamTopology(config: NeigeConfig): Promise<TeamTopology | undefined> {
  const raw = await readOptionalUtf8(join(teamRoot(config), "config", "team-topology.json"));
  if (!raw) {
    return undefined;
  }

  const parsed = JSON.parse(raw) as TeamTopology;
  return parsed;
}

export async function buildReportingChainSection(
  config: NeigeConfig,
  agentId?: string,
): Promise<PromptSection | undefined> {
  if (!agentId) {
    return undefined;
  }

  const topology = await loadTeamTopology(config);
  if (!topology) {
    return undefined;
  }

  const roleId = config.agentMappings.roles[agentId] ?? agentId;
  const entry = topology.roles?.[roleId];
  if (!entry) {
    return undefined;
  }

  const lines = [
    `role: ${roleId}`,
    `reportsTo: ${entry.reportsTo ?? "none"}`,
    `handoffTargets: ${(entry.handoffTargets ?? []).join(", ") || "none"}`,
  ];

  return {
    title: "Reporting Chain",
    content: lines.join("\n"),
  };
}
