import type { TeamBrainConfig } from "./config.ts";
import type { PromptSection } from "./files.ts";

function resolveRoleId(config: TeamBrainConfig, agentId?: string): string | undefined {
  if (!agentId) {
    return undefined;
  }

  return config.agentMappings.roles[agentId] ?? agentId;
}

function normalizeAgentLabel(config: TeamBrainConfig, agentId?: string): string {
  const roleId = resolveRoleId(config, agentId);
  return config.rolePolicies[roleId ?? ""]?.label ?? agentId ?? "当前 Agent";
}

function normalizeGuidanceLine(line: string): string {
  const trimmed = line.trim();
  return trimmed.startsWith("- ") ? trimmed : `- ${trimmed}`;
}

function buildRoleLines(config: TeamBrainConfig, agentLabel: string, agentId?: string): string[] {
  const roleId = resolveRoleId(config, agentId);
  const policy = roleId ? config.rolePolicies[roleId] : undefined;

  if (policy?.writebackGuidance.length) {
    return policy.writebackGuidance.map(normalizeGuidanceLine);
  }

  return [`- ${agentLabel} 只同步结果、状态和下一步，不写入冗长过程。`];
}

export function buildWritebackProtocolSection(
  config: TeamBrainConfig,
  agentId?: string,
): PromptSection {
  const agentLabel = normalizeAgentLabel(config, agentId);

  return {
    title: "协作写回协议",
    content: [
      `- ${agentLabel} 仅在任务状态真实变化时调用 \`teambrain-state\`。`,
      "- 优先合并一次写回，避免连续重复更新相同状态。",
      "- `set_project_state`：阶段切换、活跃任务变更、最近更新摘要。",
      "- `upsert_todo`：新增待办或更新完成状态。",
      "- `remove_todo`：删除失效、重复或已取消的待办。",
      "- 写回共享白板时只保留简短结果，不写入长篇草稿或调试日志。",
      ...buildRoleLines(config, agentLabel, agentId),
    ].join("\n"),
  };
}
