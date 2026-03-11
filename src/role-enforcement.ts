import type { NeigeConfig } from "./config.ts";

function resolveRoleId(config: NeigeConfig, agentId?: string): string | undefined {
  if (!agentId) {
    return undefined;
  }

  return config.agentMappings.roles[agentId] ?? agentId;
}

export type NeigeRoleAction = "spawn-subagent" | "initiate-handoff";

export function isNeigeToolAllowedForAgent(
  config: NeigeConfig,
  agentId: string | undefined,
  toolName: string,
): boolean {
  const roleId = resolveRoleId(config, agentId);
  if (!roleId) {
    return true;
  }

  const policy = config.rolePolicies[roleId];
  if (!policy) {
    return true;
  }

  const deniedTools = Array.isArray((policy as Record<string, unknown>).deniedTools)
    ? ((policy as Record<string, unknown>).deniedTools as unknown[])
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
    : [];

  const allowedTools = Array.isArray((policy as Record<string, unknown>).allowedTools)
    ? ((policy as Record<string, unknown>).allowedTools as unknown[])
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
    : [];

  if (deniedTools.includes(toolName)) {
    return false;
  }

  if (allowedTools.length > 0) {
    return allowedTools.includes(toolName);
  }

  return true;
}

export function isNeigeRoleActionAllowed(
  config: NeigeConfig,
  agentId: string | undefined,
  action: NeigeRoleAction,
): boolean {
  const roleId = resolveRoleId(config, agentId);
  if (!roleId) {
    return true;
  }

  const policy = config.rolePolicies[roleId];
  if (!policy) {
    return true;
  }

  if (action === "spawn-subagent") {
    return policy.canSpawnSubagent === true;
  }

  if (action === "initiate-handoff") {
    return policy.canInitiateHandoff === true;
  }

  return true;
}
