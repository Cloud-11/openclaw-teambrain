import type { PromptSection } from "./files.ts";

function normalizeAgentLabel(agentId?: string): string {
  if (!agentId) {
    return "当前 Agent";
  }

  return agentId;
}

export function buildWritebackProtocolSection(agentId?: string): PromptSection {
  const agentLabel = normalizeAgentLabel(agentId);

  return {
    title: "协作写回协议",
    content: [
      `- ${agentLabel} 仅在任务状态真实变化时调用 \`teambrain-state\`。`,
      "- 优先合并一次写回，避免连续重复更新相同状态。",
      "- `set_project_state`：阶段切换、活跃任务变更、最近更新摘要。",
      "- `upsert_todo`：新增待办或更新完成状态。",
      "- `remove_todo`：删除失效、重复或已取消的待办。",
      "- 写回共享白板时只保留简短结果，不写入长篇草稿或调试日志。",
    ].join("\n"),
  };
}
