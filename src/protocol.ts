import type { PromptSection } from "./files.ts";

function normalizeAgentLabel(agentId?: string): string {
  switch (agentId) {
    case "main":
      return "Main";
    case "coder":
      return "Coder";
    case "writer":
      return "Writer";
    case "qa":
      return "QA";
    default:
      return agentId ?? "当前 Agent";
  }
}

function buildRoleLines(agentLabel: string, agentId?: string): string[] {
  switch (agentId) {
    case "main":
      return [
        "- Main 负责汇总项目阶段、任务分派和最近更新。",
        "- Main 在任务重排或阶段切换后，优先统一更新 PROJECT_STATE.md。",
      ];
    case "coder":
      return [
        "- Coder 在实现完成、阻塞变化或接手新任务时，同步活跃任务和 TODO。",
        "- Coder 不把长篇调试过程写入共享白板，只写结果与下一步。",
      ];
    case "writer":
      return [
        "- Writer 在文档完成或需求变更后，同步相关 TODO 状态和简短摘要。",
      ];
    case "qa":
      return [
        "- QA 在验证通过、复现失败或发现阻塞时，同步测试结论和风险摘要。",
      ];
    default:
      return [`- ${agentLabel} 只同步结果、状态和下一步，不写入冗长过程。`];
  }
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
      ...buildRoleLines(agentLabel, agentId),
    ].join("\n"),
  };
}
